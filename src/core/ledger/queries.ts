// What the screens ask for: the transaction list, its day totals, and month
// totals. Every total is computed here in SQL over LEDGER_SQL, so the window
// only renders numbers. Months follow the row `date`.

import type { SQLInputValue } from "node:sqlite";
import type {
  Agorot,
  CategorySource,
  DayTotal,
  Flow,
  IsoDate,
  IsoMonth,
  MonthSummary,
  PaidBackLink,
  ReviewFlag,
  ScrapedStatus,
  TransactionFilter,
  TransactionList,
  TransactionRow,
  TransactionSort,
  TrendPoint,
  TxnSource,
} from "@shared/types";
import type { Db } from "../db";
import { addMonths, assertMonth, israelMonth } from "./dates";
import { LEDGER_SQL } from "./flow";
import { monthRange, NEEDS_REVIEW_SQL, periodSummary, trendPoint } from "./period";
import { FLOWS, assertIds, assertOptionalDate, check, isId } from "./validate";
import { getCashWallet } from "./cash";
import { isCashWithdrawal } from "./cash-patterns";

const WITH_LEDGER = `WITH ledger AS (${LEDGER_SQL})`;

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
 * filter mean "no constraint". A category id also matches its children and
 * grandchildren; `null` matches the rows Needs review
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
      const list = marks(ids.length);
      parts.push(
        `ledger.category_id IN (${list}) OR ledger.category_parent_id IN (${list}) OR ledger.category_grandparent_id IN (${list})`,
      );
      params.push(...ids, ...ids, ...ids);
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
