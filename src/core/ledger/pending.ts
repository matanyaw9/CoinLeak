// What happens to a stored pending row that a download does not repeat
// exactly (spec 04): it settles with drift onto a close completed row, or,
// when the download covers its date, it becomes gone. Plus the user's delete.

import type { Agorot, IsoDate } from "@shared/types";
import { transaction, type Db } from "../db";
import { applyCardBills } from "./card-bills";
import { daysApart } from "./dates";
import { normalizeDescription } from "./dedup";
import { assertIds } from "./validate";

export const DRIFT_DAYS = 7;
/** 5 ILS: an amount change this small is always close enough. */
export const DRIFT_FLOOR: Agorot = 500;
/** Otherwise up to a tenth (10%) of the pending amount. */
const DRIFT_DIVISOR = 10;

/** What drift matching compares between a stored row and a downloaded one. */
export interface DriftFacts {
  date: IsoDate;
  amount: Agorot;
  description: string;
  installment: { number: number; total: number } | null;
}

/** A stored pending row (gone or not) that the download did not repeat exactly. */
export interface OpenRow extends DriftFacts {
  id: number;
  gone: boolean;
}

export interface PendingPlan {
  /** Stored row id to the index in `completed` of the row it becomes. */
  settle: Map<number, number>;
  /** Stored rows that become gone. */
  gone: number[];
}

/**
 * `completed` holds the download's completed rows of the same account that
 * matched no stored row exactly. Each pairs with at most one open row,
 * closest first: smallest amount change, then fewest days, then lowest id.
 * An open row that finds no pair is gone when its date is in the window;
 * a row that is already gone stays as it is.
 */
export function planPending(open: OpenRow[], completed: DriftFacts[], windowStart: IsoDate | null): PendingPlan {
  const pairs: { id: number; index: number; diff: number; days: number }[] = [];
  for (const row of open) {
    completed.forEach((c, index) => {
      if (isClose(row, c)) {
        pairs.push({ id: row.id, index, diff: Math.abs(row.amount - c.amount), days: daysApart(row.date, c.date) });
      }
    });
  }
  pairs.sort((a, b) => a.diff - b.diff || a.days - b.days || a.id - b.id || a.index - b.index);

  const settle = new Map<number, number>();
  const taken = new Set<number>();
  for (const p of pairs) {
    if (settle.has(p.id) || taken.has(p.index)) continue;
    settle.set(p.id, p.index);
    taken.add(p.index);
  }
  const inWindow = (r: OpenRow): boolean => windowStart !== null && r.date >= windowStart;
  const gone = open.filter((r) => !r.gone && !settle.has(r.id) && inWindow(r)).map((r) => r.id);
  return { settle, gone };
}

/** Same account is the caller's job. A charge never settles as money in. */
function isClose(row: DriftFacts, c: DriftFacts): boolean {
  const diff = Math.abs(row.amount - c.amount);
  return (
    normalizeDescription(row.description) === normalizeDescription(c.description) &&
    installmentKey(row) === installmentKey(c) &&
    (row.amount > 0) === (c.amount > 0) &&
    daysApart(row.date, c.date) <= DRIFT_DAYS &&
    (diff <= DRIFT_FLOOR || diff * DRIFT_DIVISOR <= Math.abs(row.amount))
  );
}

function installmentKey(f: DriftFacts): string {
  return f.installment ? `${f.installment.number}/${f.installment.total}` : "";
}

// ---- User decisions ----

/**
 * Deletes the rows in `ids` that are gone and returns how many. Any other id
 * is left untouched. A bank line that still points at a deleted row (a
 * card bill the user decided by hand) lets go of it, then bills rematch.
 */
export function deleteGoneRows(db: Db, ids: number[]): number {
  assertIds(ids);
  if (ids.length === 0) return 0;
  return transaction(db, () => {
    const isGone = db.prepare("SELECT 1 FROM transactions WHERE id = ? AND gone_at IS NOT NULL");
    const unlink = db.prepare("UPDATE transactions SET card_bill_txn_id = NULL WHERE card_bill_txn_id = ?");
    const remove = db.prepare("DELETE FROM transactions WHERE id = ? AND gone_at IS NOT NULL");
    let deleted = 0;
    for (const id of new Set(ids)) {
      if (isGone.get(id) === undefined) continue;
      unlink.run(id);
      deleted += Number(remove.run(id).changes);
    }
    if (deleted > 0) applyCardBills(db);
    return deleted;
  });
}
