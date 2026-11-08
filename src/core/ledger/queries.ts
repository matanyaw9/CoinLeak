// What the screens ask for: accounts, categories, transactions, user edits,
// and month totals. Every total is computed here in SQL over LEDGER_SQL, so
// the window only renders numbers. Months follow the row `date`.

import type { SQLInputValue } from "node:sqlite";
import type {
  Account,
  Agorot,
  Category,
  CategorySource,
  Flow,
  IsoDate,
  IsoMonth,
  MonthSummary,
  ReviewFlag,
  ScrapedStatus,
  TransactionFilter,
  TransactionPatch,
  TransactionRow,
  TrendPoint,
} from "@shared/types";
import { transaction, type Db } from "../db";
import { applyRulesInTransaction } from "../rules/engine";
import { applyCardBills } from "./card-bills";
import { addMonths, assertMonth, daysOfMonth, israelMonth, monthBounds } from "./dates";
import { LEDGER_SQL, SPENDING_FLOWS_SQL } from "./flow";
import { FLOWS, assertIds, assertOptionalDate, check, isId } from "./validate";

const WITH_LEDGER = `WITH ledger AS (${LEDGER_SQL})`;
const NEEDS_REVIEW_SQL = "(ledger.flag_uncategorized OR ledger.flag_possible_card_bill OR ledger.flag_gone)";

// ---- Accounts and categories ----

export function listAccounts(db: Db): Account[] {
  const rows = db
    .prepare(
      `SELECT id, provider, kind, account_number, name, card_mode, last_synced_at FROM accounts
       ORDER BY kind = 'card', provider, account_number`,
    )
    .all() as {
    id: number;
    provider: Account["provider"];
    kind: Account["kind"];
    account_number: string;
    name: string | null;
    card_mode: Account["cardMode"];
    last_synced_at: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    kind: r.kind,
    accountNumber: r.account_number,
    name: r.name,
    cardMode: r.card_mode,
    lastSyncedAt: r.last_synced_at,
  }));
}

/** Expense before income; each top-level category followed by its children. */
export function listCategories(db: Db): Category[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.parent_id, c.name, c.kind, c.emoji, c.color, c.archived FROM categories c
       LEFT JOIN categories p ON p.id = c.parent_id
       ORDER BY c.kind = 'income', COALESCE(p.sort_order, c.sort_order), COALESCE(p.id, c.id),
         c.parent_id IS NOT NULL, c.sort_order, c.name`,
    )
    .all() as {
    id: number;
    parent_id: number | null;
    name: string;
    kind: Category["kind"];
    emoji: string | null;
    color: string | null;
    archived: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    kind: r.kind,
    emoji: r.emoji,
    color: r.color,
    archived: r.archived === 1,
  }));
}

// ---- Transactions ----

interface LedgerRow {
  id: number;
  account_id: number;
  date: IsoDate;
  processed_date: IsoDate | null;
  amount: Agorot;
  original_amount: Agorot | null;
  original_currency: string | null;
  description: string;
  memo: string | null;
  status: ScrapedStatus;
  installment_number: number | null;
  installment_total: number | null;
  category_id: number | null;
  category_source: CategorySource | null;
  note: string | null;
  excluded: number;
  rule_id: number | null;
  flow: Flow;
  flag_uncategorized: number;
  flag_possible_card_bill: number;
  flag_gone: number;
}

/**
 * Newest first. Empty arrays in the filter mean "no constraint". A parent
 * category id also matches its children; `null` matches uncategorized rows.
 * Trashed rows show only when `flows` asks for them.
 */
export function listTransactions(db: Db, filter: TransactionFilter = {}): TransactionRow[] {
  const where: string[] = [];
  const params: SQLInputValue[] = [];
  const marks = (n: number): string => Array(n).fill("?").join(", ");

  check(typeof filter === "object" && filter !== null);
  assertOptionalDate(filter.from);
  assertOptionalDate(filter.to);
  if (filter.from) {
    where.push("ledger.date >= ?");
    params.push(filter.from);
  }
  if (filter.to) {
    where.push("ledger.date <= ?");
    params.push(filter.to);
  }

  if (filter.accountIds !== undefined) assertIds(filter.accountIds);
  if (filter.accountIds?.length) {
    where.push(`ledger.account_id IN (${marks(filter.accountIds.length)})`);
    params.push(...filter.accountIds);
  }

  if (filter.categoryIds !== undefined) {
    check(Array.isArray(filter.categoryIds) && filter.categoryIds.every((id) => id === null || isId(id)));
  }
  if (filter.categoryIds?.length) {
    const ids = filter.categoryIds.filter(isId);
    const parts: string[] = [];
    if (filter.categoryIds.includes(null)) parts.push("ledger.category_id IS NULL");
    if (ids.length) {
      parts.push(`ledger.category_id IN (${marks(ids.length)}) OR ledger.category_parent_id IN (${marks(ids.length)})`);
      params.push(...ids, ...ids);
    }
    where.push(`(${parts.join(" OR ")})`);
  }

  if (filter.flows !== undefined) {
    check(Array.isArray(filter.flows) && filter.flows.every((f) => FLOWS.includes(f)));
  }
  if (filter.flows?.length) {
    where.push(`ledger.flow IN (${marks(filter.flows.length)})`);
    params.push(...filter.flows);
  }
  if (!filter.flows?.includes("trashed")) where.push("ledger.flow <> 'trashed'");

  check(filter.hideInternal === undefined || typeof filter.hideInternal === "boolean");
  if (filter.hideInternal) where.push("ledger.flow <> 'internal'");

  check(filter.search === undefined || typeof filter.search === "string");
  const search = filter.search?.trim();
  if (search) {
    const like = `%${search.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push(
      "(ledger.description LIKE ? ESCAPE '\\' OR ledger.memo LIKE ? ESCAPE '\\' OR ledger.note LIKE ? ESCAPE '\\')",
    );
    params.push(like, like, like);
  }

  check(filter.needsReview === undefined || typeof filter.needsReview === "boolean");
  if (filter.needsReview !== undefined) {
    where.push(`${NEEDS_REVIEW_SQL} = ?`);
    params.push(filter.needsReview ? 1 : 0);
  }

  const sql = `${WITH_LEDGER} SELECT * FROM ledger
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY ledger.date DESC, ledger.id DESC`;
  return (db.prepare(sql).all(...params) as unknown as LedgerRow[]).map(toTransactionRow);
}

function toTransactionRow(r: LedgerRow): TransactionRow {
  const flags: ReviewFlag[] = [];
  if (r.flag_uncategorized) flags.push("uncategorized");
  if (r.flag_possible_card_bill) flags.push("possible_card_bill");
  if (r.flag_gone) flags.push("gone");
  return {
    id: r.id,
    accountId: r.account_id,
    date: r.date,
    processedDate: r.processed_date,
    amount: r.amount,
    originalAmount: r.original_amount,
    originalCurrency: r.original_currency,
    description: r.description,
    memo: r.memo,
    status: r.flow === "gone" ? "gone" : r.status,
    installment:
      r.installment_number !== null && r.installment_total !== null
        ? { number: r.installment_number, total: r.installment_total }
        : null,
    categoryId: r.category_id,
    categorySource: r.category_source,
    note: r.note,
    excluded: r.excluded === 1,
    flow: r.flow,
    flags,
    ruleId: r.rule_id,
  };
}

/**
 * The user's edits. Setting a category (even to none) or excluding or
 * including a row marks that field as the user's, so rules and syncs leave
 * it alone. Excluding or including a row rematches card bills, since
 * excluded bank lines are frozen.
 */
export function updateTransactions(
  db: Db,
  ids: number[],
  patch: TransactionPatch,
  now = new Date(),
): { updated: number } {
  assertIds(ids);
  check(typeof patch === "object" && patch !== null);
  const sets: string[] = [];
  const params: SQLInputValue[] = [];

  if (patch.categoryId !== undefined) {
    check(patch.categoryId === null || isId(patch.categoryId));
    if (patch.categoryId !== null) {
      check(db.prepare("SELECT 1 FROM categories WHERE id = ?").get(patch.categoryId) !== undefined);
    }
    sets.push("category_id = ?", "category_source = 'user'");
    params.push(patch.categoryId);
  }
  if (patch.note !== undefined) {
    check(patch.note === null || typeof patch.note === "string");
    sets.push("note = ?");
    params.push(patch.note);
  }
  if (patch.excluded !== undefined) {
    check(typeof patch.excluded === "boolean");
    sets.push("excluded = ?", "excluded_source = 'user'");
    params.push(patch.excluded ? 1 : 0);
  }
  if (sets.length === 0 || ids.length === 0) return { updated: 0 };

  return transaction(db, () => {
    const stmt = db.prepare(`UPDATE transactions SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`);
    let updated = 0;
    for (const id of new Set(ids)) updated += Number(stmt.run(...params, now.toISOString(), id).changes);
    if (patch.excluded !== undefined) applyCardBills(db);
    return { updated };
  });
}

// ---- Trash ----

/**
 * Moves rows to Trash: they count nowhere until restored. Card bills
 * rematch, since trashed rows take no part on either side.
 */
export function trashTransactions(db: Db, ids: number[], now = new Date()): { updated: number } {
  assertIds(ids);
  if (ids.length === 0) return { updated: 0 };
  const at = now.toISOString();
  return transaction(db, () => {
    const stmt = db.prepare("UPDATE transactions SET trashed_at = ?, updated_at = ? WHERE id = ? AND trashed_at IS NULL");
    let updated = 0;
    for (const id of new Set(ids)) updated += Number(stmt.run(at, at, id).changes);
    if (updated > 0) applyCardBills(db);
    return { updated };
  });
}

/**
 * Brings trashed rows back as they were. Rules catch up on them (they skip
 * trashed rows) and card bills rematch.
 */
export function restoreTransactions(db: Db, ids: number[], now = new Date()): { updated: number } {
  assertIds(ids);
  if (ids.length === 0) return { updated: 0 };
  const at = now.toISOString();
  return transaction(db, () => {
    const stmt = db.prepare("UPDATE transactions SET trashed_at = NULL, updated_at = ? WHERE id = ? AND trashed_at IS NOT NULL");
    const restored: number[] = [];
    for (const id of new Set(ids)) if (Number(stmt.run(at, id).changes) > 0) restored.push(id);
    if (restored.length > 0) {
      applyRulesInTransaction(db, { ids: restored }, now);
      applyCardBills(db);
    }
    return { updated: restored.length };
  });
}

/**
 * Deletes every trashed row for good. A bank line that still points at one
 * (a card bill decided by hand) lets go of it first. Each row leaves a
 * tombstone (its dedup key and copy number) so a later sync never adds it
 * back (spec 14).
 */
export function emptyTrash(db: Db, now = new Date()): { deleted: number } {
  return transaction(db, () => {
    db.prepare(
      `INSERT OR IGNORE INTO trash_tombstones (account_id, dedup_hash, dedup_seq, emptied_at)
       SELECT account_id, dedup_hash, dedup_seq, ? FROM transactions WHERE trashed_at IS NOT NULL`,
    ).run(now.toISOString());
    db.prepare(
      `UPDATE transactions SET card_bill_txn_id = NULL
       WHERE card_bill_txn_id IN (SELECT id FROM transactions WHERE trashed_at IS NOT NULL)`,
    ).run();
    const deleted = Number(db.prepare("DELETE FROM transactions WHERE trashed_at IS NOT NULL").run().changes);
    if (deleted > 0) applyCardBills(db);
    return { deleted };
  });
}

// ---- Summaries ----

export interface Totals {
  income: Agorot;
  spending: Agorot;
  transfers: Agorot;
  needsReview: number;
}

export function totals(db: Db, from: IsoDate, until: IsoDate): Totals {
  return db
    .prepare(
      `${WITH_LEDGER} SELECT
         COALESCE(SUM(CASE WHEN ledger.flow = 'income' THEN ledger.amount END), 0) AS income,
         COALESCE(-SUM(CASE WHEN ledger.flow IN ${SPENDING_FLOWS_SQL} THEN ledger.amount END), 0) AS spending,
         COALESCE(-SUM(CASE WHEN ledger.flow = 'transfer' THEN ledger.amount END), 0) AS transfers,
         COALESCE(SUM(${NEEDS_REVIEW_SQL}), 0) AS needsReview
       FROM ledger WHERE ledger.date >= ? AND ledger.date < ?`,
    )
    .get(from, until) as unknown as Totals;
}

function spendingByCategory(
  db: Db,
  from: IsoDate,
  until: IsoDate,
): { categoryId: number | null; amount: Agorot; count: number }[] {
  return db
    .prepare(
      `${WITH_LEDGER} SELECT ledger.category_id AS categoryId, -SUM(ledger.amount) AS spent, COUNT(*) AS count
       FROM ledger
       WHERE ledger.date >= ? AND ledger.date < ? AND ledger.flow IN ${SPENDING_FLOWS_SQL}
       GROUP BY ledger.category_id
       ORDER BY spent DESC, ledger.category_id IS NULL, ledger.category_id`,
    )
    .all(from, until)
    .map((r) => ({ categoryId: r.categoryId as number | null, amount: r.spent as number, count: r.count as number }));
}

export function spendingByParent(
  db: Db,
  from: IsoDate,
  until: IsoDate,
): { categoryId: number | null; amount: Agorot; count: number }[] {
  return db
    .prepare(
      `${WITH_LEDGER} SELECT COALESCE(ledger.category_parent_id, ledger.category_id) AS categoryId,
         -SUM(ledger.amount) AS spent, COUNT(*) AS count
       FROM ledger
       WHERE ledger.date >= ? AND ledger.date < ? AND ledger.flow IN ${SPENDING_FLOWS_SQL}
       GROUP BY 1
       ORDER BY spent DESC, categoryId IS NULL, categoryId`,
    )
    .all(from, until)
    .map((r) => ({ categoryId: r.categoryId as number | null, amount: r.spent as number, count: r.count as number }));
}

/** Income, spending after refunds, spending by category and by day. */
export function monthSummary(db: Db, month: IsoMonth): MonthSummary {
  assertMonth(month);
  const { from, until } = monthBounds(month);
  const t = totals(db, from, until);
  const daily = db
    .prepare(
      `${WITH_LEDGER} SELECT ledger.date AS date, -SUM(ledger.amount) AS spent FROM ledger
       WHERE ledger.date >= ? AND ledger.date < ? AND ledger.flow IN ${SPENDING_FLOWS_SQL}
       GROUP BY ledger.date`,
    )
    .all(from, until) as { date: IsoDate; spent: Agorot }[];
  const spentOn = new Map(daily.map((d) => [d.date, d.spent]));
  let running = 0;
  const byDay = daysOfMonth(month).map((date) => {
    running += spentOn.get(date) ?? 0;
    return { date, amount: running };
  });
  return {
    month,
    income: t.income,
    spending: t.spending,
    transfers: t.transfers,
    byCategory: spendingByCategory(db, from, until),
    byParent: spendingByParent(db, from, until),
    byDay,
    needsReview: t.needsReview,
  };
}

/** The last `months` calendar months, oldest first, ending with the month of
 *  `now` in Israel time. Months without rows are zeros. */
export function trend(db: Db, months: number, opts: { now?: Date } = {}): TrendPoint[] {
  check(Number.isSafeInteger(months) && months >= 1 && months <= 240);
  const last = israelMonth(opts.now ?? new Date());
  const points: TrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = addMonths(last, -i);
    const { from, until } = monthBounds(month);
    const t = totals(db, from, until);
    const byCategory = spendingByCategory(db, from, until).map(({ categoryId, amount }) => ({ categoryId, amount }));
    points.push({ month, income: t.income, spending: t.spending, byCategory });
  }
  return points;
}
