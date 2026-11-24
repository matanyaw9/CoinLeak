// Paid back for a purchase (spec 33, F65): money in that pays back part of a
// purchase takes the purchase's category, so it counts as a refund of that
// category (flow.ts) and the category's spending shrinks. The row remembers
// which purchase it was for; the purchase itself never changes.

import type { Agorot, Flow, IsoDate, PaidBackResult, TransactionRow } from "@shared/types";
import type { Db } from "../db";
import { dayNumber, toIsoDate } from "./dates";
import { FLOW_SQL } from "./flow";
import { listTransactions } from "./queries";
import { check, isId } from "./validate";

const DAYS_BEFORE = 60;
const DAYS_AFTER = 7;
const MAX_CANDIDATES = 50;

interface Facts {
  amount: Agorot;
  date: IsoDate;
  category_id: number | null;
  flow: Flow;
}

function factsOf(db: Db, id: number): Facts {
  const row = db
    .prepare(
      `SELECT t.amount, t.date, t.category_id, ${FLOW_SQL} AS flow
       FROM transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.id = ?`,
    )
    .get(id) as Facts | undefined;
  check(row !== undefined);
  return row;
}

/**
 * Purchases the money-in row may pay back: money out counting as spending,
 * not trashed, from 60 days before the row to 7 days after, newest first,
 * at most 50. `text` searches the description, memo and note.
 */
export function paidBackCandidates(db: Db, args: { rowId: number; text?: string }): TransactionRow[] {
  check(typeof args === "object" && args !== null && isId(args.rowId));
  check(args.text === undefined || typeof args.text === "string");
  const day = dayNumber(factsOf(db, args.rowId).date);
  return listTransactions(db, {
    from: toIsoDate(day - DAYS_BEFORE),
    to: toIsoDate(day + DAYS_AFTER),
    flows: ["spending"],
    search: args.text,
  })
    .filter((r) => r.amount < 0)
    .slice(0, MAX_CANDIDATES);
}

/**
 * Links money in to the purchase it pays back. The row takes the purchase's
 * category as if the user set it, so rules and syncs leave it alone. Several
 * rows may pay back one purchase (two friends).
 */
export function markPaidBack(db: Db, args: { rowId: number; purchaseId: number }, now = new Date()): PaidBackResult {
  check(typeof args === "object" && args !== null && isId(args.rowId) && isId(args.purchaseId));
  const row = factsOf(db, args.rowId);
  const purchase = factsOf(db, args.purchaseId);
  if (row.amount <= 0 || row.flow === "trashed") return { ok: false, problem: "not_money_in" };
  if (purchase.amount >= 0 || purchase.flow !== "spending") return { ok: false, problem: "not_a_purchase" };
  if (purchase.category_id === null) return { ok: false, problem: "purchase_uncategorized" };
  db.prepare(
    `UPDATE transactions SET category_id = ?, category_source = 'user', paid_back_for = ?, updated_at = ? WHERE id = ?`,
  ).run(purchase.category_id, args.purchaseId, now.toISOString(), args.rowId);
  return { ok: true };
}

/**
 * "Not paid back": removes the link and the category. The category counts
 * as cleared by hand, so the row waits in Needs review for the user.
 */
export function clearPaidBack(db: Db, args: { rowId: number }, now = new Date()): { updated: number } {
  check(typeof args === "object" && args !== null && isId(args.rowId));
  const result = db
    .prepare(
      `UPDATE transactions SET paid_back_for = NULL, category_id = NULL, category_source = 'user', updated_at = ?
       WHERE id = ? AND paid_back_for IS NOT NULL`,
    )
    .run(now.toISOString(), args.rowId);
  return { updated: Number(result.changes) };
}
