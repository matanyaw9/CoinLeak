// What the screens ask for: accounts, categories, transactions, user edits,
// and month totals. Every total is computed here in SQL over LEDGER_SQL, so
// the window only renders numbers. Months follow the row `date`.

import type { SQLInputValue } from "node:sqlite";
import type {
  Account,
  Agorot,
  Category,
  CategorySource,
  DayTotal,
  ExcludedSource,
  ExclusionState,
  Flow,
  IsoDate,
  IsoMonth,
  MonthSummary,
  PaidBackLink,
  ReviewFlag,
  ScrapedStatus,
  TransactionFilter,
  TransactionList,
  TransactionPatch,
  TransactionRow,
  TransactionSort,
  TrendPoint,
  TxnSource,
} from "@shared/types";
import { transaction, type Db } from "../db";
import { applyRulesInTransaction } from "../rules/engine";
import { applyCardBills } from "./card-bills";
import { addMonths, assertMonth, israelMonth } from "./dates";
import { LEDGER_SQL } from "./flow";
import { monthRange, NEEDS_REVIEW_SQL, periodSummary, trendPoint } from "./period";
import { FLOWS, assertIds, assertOptionalDate, check, cleanNote, isId } from "./validate";
import { getCashWallet } from "./cash";
import { isCashWithdrawal } from "./cash-patterns";

const WITH_LEDGER = `WITH ledger AS (${LEDGER_SQL})`;

// ---- Accounts and categories ----

/** Bank accounts and cards. The cash wallet has its own call (cash.ts, spec 20). */
export function listAccounts(db: Db): Account[] {
  const rows = db
    .prepare(
      `SELECT id, provider, kind, account_number, name, card_mode, last_synced_at, sync_enabled FROM accounts
       WHERE kind <> 'cash' ORDER BY kind = 'card', provider, account_number`,
    )
    .all() as {
    id: number;
    provider: Account["provider"];
    kind: Account["kind"];
    account_number: string;
    name: string | null;
    card_mode: Account["cardMode"];
    last_synced_at: string | null;
    sync_enabled: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    kind: r.kind,
    accountNumber: r.account_number,
    name: r.name,
    cardMode: r.card_mode,
    lastSyncedAt: r.last_synced_at,
    syncEnabled: r.sync_enabled === 1,
  }));
}

/** Expense before income; each top-level category followed by its children. */
export function listCategories(db: Db): Category[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.parent_id, c.name, c.kind, c.emoji, c.color, c.archived, c.essential,
         (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS row_count,
         (SELECT COUNT(*) FROM rules r WHERE r.set_category_id = c.id) AS rule_count
       FROM categories c
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
    essential: number | null;
    row_count: number;
    rule_count: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    kind: r.kind,
    emoji: r.emoji,
    color: r.color,
    archived: r.archived === 1,
    rowCount: r.row_count,
    ruleCount: r.rule_count,
    essential: r.essential === null ? null : r.essential === 1,
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
  source: TxnSource;
  internal_by_user: number;
  card_bill_account_id: number | null;
  flow: Flow;
  flag_uncategorized: number;
  flag_possible_card_bill: number;
  flag_gone: number;
  paid_back_for: number | null;
  paid_back_description: string | null;
  paid_back_date: IsoDate | null;
  paid_back_amount: Agorot | null;
}

/**
 * Newest first unless `sort` says otherwise (spec 17). Empty arrays in the
 * filter mean "no constraint". A parent
 * category id also matches its children; `null` matches the rows Needs review
 * calls uncategorized (spending or income with no category).
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
    if (filter.categoryIds.includes(null)) parts.push("ledger.flag_uncategorized");
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

  // A gone row keeps its stored 'pending' status, but it is not pending.
  check(filter.pending === undefined || typeof filter.pending === "boolean");
  if (filter.pending !== undefined) {
    where.push(`(ledger.status = 'pending' AND ledger.flow <> 'gone') = ?`);
    params.push(filter.pending ? 1 : 0);
  }

  const sort = filter.sort ?? "date";
  check(SORTS.includes(sort));
  // spec 33: the purchase a pay-back row points at, if any.
  const sql = `${WITH_LEDGER} SELECT ledger.*, pb.description AS paid_back_description,
      pb.date AS paid_back_date, pb.amount AS paid_back_amount
    FROM ledger LEFT JOIN transactions pb ON pb.id = ledger.paid_back_for
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY ${ORDER_SQL[sort]}`;
  const wallet = getCashWallet(db)?.id ?? null;
  const rows = (db.prepare(sql).all(...params) as unknown as LedgerRow[]).map((r) => toTransactionRow(r, wallet));
  // SQLite has no Hebrew-aware natural order, so names sort here.
  if (sort === "name") return rows.sort(byName);
  if (sort === "name_desc") return rows.sort(byNameDesc);
  return rows;
}

/** The listed rows plus each day's spending and income over those same rows (spec 25). */
export function listTransactionsWithDays(db: Db, filter: TransactionFilter = {}): TransactionList {
  const rows = listTransactions(db, filter);
  return { rows, days: dayTotals(rows) };
}

/** Per day, newest first: spending after refunds and income, by the flow each row has. */
export function dayTotals(rows: TransactionRow[]): DayTotal[] {
  const byDate = new Map<IsoDate, DayTotal>();
  for (const row of rows) {
    const day = byDate.get(row.date) ?? { date: row.date, spent: 0, income: 0 };
    if (row.flow === "spending" || row.flow === "refund") day.spent -= row.amount;
    if (row.flow === "income") day.income += row.amount;
    byDate.set(row.date, day);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const SORTS: readonly TransactionSort[] = ["date", "date_asc", "amount_desc", "amount_asc", "name", "name_desc"];
// Ties fall back to the newest id first in every order, so a day's rows keep
// the same order whichever way the days go.
const ORDER_SQL: Record<TransactionSort, string> = {
  date: "ledger.date DESC, ledger.id DESC",
  date_asc: "ledger.date ASC, ledger.id DESC",
  amount_desc: "ABS(ledger.amount) DESC, ledger.id DESC",
  amount_asc: "ABS(ledger.amount) ASC, ledger.id DESC",
  name: "ledger.id DESC",
  name_desc: "ledger.id DESC",
};
const NAMES = new Intl.Collator(["he", "en"], { numeric: true, sensitivity: "base" });

function byName(a: TransactionRow, b: TransactionRow): number {
  return NAMES.compare(a.description.trim(), b.description.trim()) || b.id - a.id;
}

function byNameDesc(a: TransactionRow, b: TransactionRow): number {
  return NAMES.compare(b.description.trim(), a.description.trim()) || b.id - a.id;
}

/**
 * Spec 20: an internal bank line is money moved into the cash wallet when
 * the matcher sent it there, or when the user marked a withdrawal internal.
 */
function movedToCash(r: LedgerRow, wallet: number | null): boolean {
  if (wallet === null || r.flow !== "internal" || r.account_id === wallet) return false;
  if (r.card_bill_account_id === wallet) return true;
  return r.internal_by_user === 1 && r.card_bill_account_id === null && isCashWithdrawal(r.description, r.amount);
}

function toTransactionRow(r: LedgerRow, wallet: number | null): TransactionRow {
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
    source: r.source,
    movedToCash: movedToCash(r, wallet),
    paidBackFor: paidBackLink(r),
  };
}

function paidBackLink(r: LedgerRow): PaidBackLink | null {
  if (r.paid_back_for === null || r.paid_back_description === null) return null;
  return {
    id: r.paid_back_for,
    description: r.paid_back_description,
    date: r.paid_back_date as IsoDate,
    amount: r.paid_back_amount as Agorot,
  };
}

/**
 * The user's edits. Setting a category (even to none) or excluding or
 * including a row marks that field as the user's, so rules and syncs leave
 * it alone. Excluding or including a row rematches card bills, since
 * excluded bank lines are frozen, and returns each row's exclusion as it was.
 * Undo passes that back with `excludedSource`: `rule` or null hands the row
 * back to the rules, which run on it at once (spec 13).
 */
export function updateTransactions(
  db: Db,
  ids: number[],
  patch: TransactionPatch,
  now = new Date(),
): { updated: number; before?: ExclusionState[] } {
  assertIds(ids);
  check(typeof patch === "object" && patch !== null);
  const sets: string[] = [];
  const params: SQLInputValue[] = [];

  if (patch.categoryId !== undefined) {
    check(patch.categoryId === null || isId(patch.categoryId));
    if (patch.categoryId !== null) {
      check(db.prepare("SELECT 1 FROM categories WHERE id = ?").get(patch.categoryId) !== undefined);
    }
    // A pay-back link (spec 33) explains the category it copied: a different
    // category ends it. SET reads the row as it was before this update.
    sets.push(
      "category_id = ?",
      "category_source = 'user'",
      "paid_back_for = CASE WHEN category_id IS ? THEN paid_back_for ELSE NULL END",
    );
    params.push(patch.categoryId, patch.categoryId);
  }
  if (patch.note !== undefined) {
    sets.push("note = ?");
    params.push(cleanNote(patch.note));
  }
  const source = patch.excludedSource === undefined ? "user" : patch.excludedSource;
  check(patch.excludedSource === undefined || patch.excluded !== undefined);
  check(source === null || source === "user" || source === "rule");
  if (patch.excluded !== undefined) {
    check(typeof patch.excluded === "boolean");
    sets.push("excluded = ?", "excluded_source = ?");
    params.push(patch.excluded ? 1 : 0, source);
  }
  if (sets.length === 0 || ids.length === 0) return { updated: 0 };

  return transaction(db, () => {
    const unique = [...new Set(ids)];
    const before = patch.excluded === undefined ? undefined : exclusionsOf(db, unique);
    const stmt = db.prepare(`UPDATE transactions SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`);
    let updated = 0;
    for (const id of unique) updated += Number(stmt.run(...params, now.toISOString(), id).changes);
    if (patch.excluded === false && source === "user") forgetPaysCard(db, unique);
    if (patch.excluded !== undefined && source !== "user") applyRulesInTransaction(db, { ids: unique }, now);
    if (patch.excluded !== undefined) applyCardBills(db);
    return before ? { updated, before } : { updated };
  });
}

/**
 * Spec 28: "Count again" asks for the row to count. A line the user had
 * marked "This pays a card I track" would still not count, so the mark is
 * dropped and the matcher decides again (flagged if no tracked card fits).
 * "Count it as spending" (internal 0 by the user) already counts and stays.
 */
function forgetPaysCard(db: Db, ids: number[]): void {
  db.prepare(
    `UPDATE transactions SET internal = 0, internal_by_user = 0
     WHERE id IN (SELECT value FROM json_each(?)) AND internal_by_user = 1 AND internal = 1`,
  ).run(JSON.stringify(ids));
}

function exclusionsOf(db: Db, ids: number[]): ExclusionState[] {
  const rows = db
    .prepare(
      `SELECT id, excluded, excluded_source FROM transactions WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id`,
    )
    .all(JSON.stringify(ids)) as unknown as { id: number; excluded: number; excluded_source: ExcludedSource | null }[];
  return rows.map((r) => ({ id: r.id, excluded: r.excluded === 1, excludedSource: r.excluded_source }));
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
 * Deletes trashed rows for good: the ones in `ids`, or every one when `ids`
 * is null. A bank line that still points at one (a card bill decided by
 * hand) lets go of it first. Each row leaves a tombstone (its dedup key and
 * copy number) so a later sync never adds it back (spec 14).
 */
function deleteTrashed(db: Db, ids: number[] | null, now: Date): { deleted: number } {
  const trashed = ids === null ? "trashed_at IS NOT NULL" : "trashed_at IS NOT NULL AND id IN (SELECT value FROM json_each(?))";
  const args = ids === null ? [] : [JSON.stringify(ids)];
  return transaction(db, () => {
    db.prepare(
      `INSERT OR IGNORE INTO trash_tombstones (account_id, dedup_hash, dedup_seq, emptied_at)
       SELECT account_id, dedup_hash, dedup_seq, ? FROM transactions WHERE ${trashed}`,
    ).run(now.toISOString(), ...args);
    db.prepare(
      `UPDATE transactions SET card_bill_txn_id = NULL
       WHERE card_bill_txn_id IN (SELECT id FROM transactions WHERE ${trashed})`,
    ).run(...args);
    const deleted = Number(db.prepare(`DELETE FROM transactions WHERE ${trashed}`).run(...args).changes);
    if (deleted > 0) applyCardBills(db);
    return { deleted };
  });
}

/** "Empty trash": deletes every trashed row for good. The window asks first. */
export function emptyTrash(db: Db, now = new Date()): { deleted: number } {
  return deleteTrashed(db, null, now);
}

/**
 * Spec 36: deletes only the given trashed rows for good, the same way as
 * `emptyTrash`. Ids of rows that are not in Trash are skipped.
 */
export function deleteForGood(db: Db, ids: number[], now = new Date()): { deleted: number } {
  assertIds(ids);
  if (ids.length === 0) return { deleted: 0 };
  return deleteTrashed(db, ids, now);
}

// ---- Summaries ----
// The sums live in period.ts (spec 16); a month is a range of its days.

export { spendingByParent, totals, type Totals } from "./period";

/** Income, spending after refunds, spending by category and by day (to today in the current month). */
export function monthSummary(db: Db, month: IsoMonth, opts: { now?: Date } = {}): MonthSummary {
  assertMonth(month);
  const p = periodSummary(db, monthRange(month), opts);
  return {
    month,
    income: p.income,
    spending: p.spending,
    transfers: p.transfers,
    byCategory: p.byCategory,
    byParent: p.byParent,
    byDay: p.series.map((x) => ({ date: x.from, amount: x.amount })),
    needsReview: p.needsReview,
  };
}

/** The last `months` calendar months, oldest first, ending with the month of
 *  `now` in Israel time. Months without rows are zeros. */
export function trend(db: Db, months: number, opts: { now?: Date } = {}): TrendPoint[] {
  check(Number.isSafeInteger(months) && months >= 1 && months <= 240);
  const last = israelMonth(opts.now ?? new Date());
  return Array.from({ length: months }, (_, i) => trendPoint(db, addMonths(last, i - months + 1)));
}
