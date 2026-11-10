// Summaries for any range of days (spec 16): totals, categories, the spending
// series and the period before, optionally essentials or extras only (spec 22),
// and this month's money left. Month summaries are these over a month's
// days, so both always agree. Days are `YYYY-MM-DD`, both ends included.

import type { SQLInputValue } from "node:sqlite";
import type {
  Agorot,
  DateRange,
  EssentialFilter,
  EssentialSplit,
  IsoDate,
  IsoMonth,
  PeriodCurve,
  PeriodSummary,
  SeriesBucket,
  SeriesPoint,
  SpendingComparison,
  ThisMonth,
  TrendPoint,
} from "@shared/types";
import type { Db } from "../db";
import { addMonths, dayNumber, isIsoDate, israelMonth, monthBounds, toIsoDate } from "./dates";
import { LEDGER_SQL, SPENDING_FLOWS_SQL } from "./flow";
import { check, isId } from "./validate";

const WITH_LEDGER = `WITH ledger AS (${LEDGER_SQL})`;
export const NEEDS_REVIEW_SQL = "(ledger.flag_uncategorized OR ledger.flag_possible_card_bill OR ledger.flag_gone)";

/** Thirty years of days keeps one request bounded. */
const MAX_DAYS = 366 * 30;
/** Enough for "top categories" plus a few more. */
const MAX_CURVES = 30;
const MIN_TREND_MONTHS = 3;

// ---- Ranges and buckets ----

export function assertRange(range: unknown): asserts range is DateRange {
  check(typeof range === "object" && range !== null);
  const { from, to } = range as Partial<DateRange>;
  check(isIsoDate(from) && isIsoDate(to) && from <= to);
  check(dayNumber(to) - dayNumber(from) < MAX_DAYS);
}

const shiftDay = (date: IsoDate, n: number): IsoDate => toIsoDate(dayNumber(date) + n);
const lengthOf = (r: DateRange): number => dayNumber(r.to) - dayNumber(r.from) + 1;

/** The month's days as a range. */
export function monthRange(month: IsoMonth): DateRange {
  const { from, until } = monthBounds(month);
  return { from, to: shiftDay(until, -1) };
}

/** Today in Israel time. */
export function israelToday(now: Date): IsoDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function bucketFor(range: DateRange): SeriesBucket {
  const days = lengthOf(range);
  return days <= 62 ? "day" : days <= 366 ? "week" : "month";
}

/** Days, 7-day weeks from the range's first day, or calendar months; the last may be short. */
export function bucketsOf(range: DateRange, bucket: SeriesBucket): DateRange[] {
  const out: DateRange[] = [];
  for (let from = range.from; from <= range.to; ) {
    let to =
      bucket === "day"
        ? from
        : bucket === "week"
          ? shiftDay(from, 6)
          : shiftDay(monthBounds(from.slice(0, 7)).until, -1);
    if (to > range.to) to = range.to;
    out.push({ from, to });
    from = shiftDay(to, 1);
  }
  return out;
}

/** How many whole calendar months the range is, or 0 when it is not. */
function wholeMonths(range: DateRange): number {
  if (!range.from.endsWith("-01") || !shiftDay(range.to, 1).endsWith("-01")) return 0;
  const index = (d: IsoDate) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7));
  return index(range.to) - index(range.from) + 1;
}

/** The same number of whole months before, else the same number of days just before. */
export function previousRange(range: DateRange): DateRange {
  const to = shiftDay(range.from, -1);
  const months = wholeMonths(range);
  if (months > 0) return { from: `${addMonths(range.from.slice(0, 7), -months)}-01`, to };
  return { from: shiftDay(range.from, -lengthOf(range)), to };
}


// ---- Sums over [from, until) ----

/** Which rows a sum looks at: all, uncategorized (null), or a category with its subcategories. */
type Match = number | null | undefined;

/**
 * Which spending by the essential tag (spec 22): true essential, false extra,
 * null neither (uncategorized, or a category without a tag), undefined all.
 * A row takes the tag of its own category; only subcategories carry one.
 */
export type Tag = boolean | null | undefined;

function whereSql(match: Match, tag: Tag = undefined): { sql: string; params: SQLInputValue[] } {
  let sql = "";
  const params: SQLInputValue[] = [];
  if (match === null) sql += " AND ledger.category_id IS NULL";
  if (typeof match === "number") {
    sql += " AND (ledger.category_id = ? OR ledger.category_parent_id = ?)";
    params.push(match, match);
  }
  if (tag === null) {
    sql += " AND (ledger.category_id IS NULL OR ledger.category_id IN (SELECT id FROM categories WHERE essential IS NULL))";
  }
  if (typeof tag === "boolean") {
    sql += " AND ledger.category_id IN (SELECT id FROM categories WHERE essential = ?)";
    params.push(tag ? 1 : 0);
  }
  return { sql, params };
}

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

/** Spending after refunds with one essential tag. */
export function taggedSpending(db: Db, from: IsoDate, until: IsoDate, tag: Tag): Agorot {
  const w = whereSql(undefined, tag);
  const row = db
    .prepare(
      `${WITH_LEDGER} SELECT COALESCE(-SUM(ledger.amount), 0) AS spent FROM ledger
       WHERE ledger.date >= ? AND ledger.date < ? AND ledger.flow IN ${SPENDING_FLOWS_SQL}${w.sql}`,
    )
    .get(from, until, ...w.params) as { spent: Agorot };
  return row.spent;
}

export function essentialSplit(db: Db, from: IsoDate, until: IsoDate): EssentialSplit {
  return {
    essential: taggedSpending(db, from, until, true),
    extra: taggedSpending(db, from, until, false),
    untagged: taggedSpending(db, from, until, null),
  };
}

type CategoryAmount = { categoryId: number | null; amount: Agorot; count: number };

export function spendingByCategory(db: Db, from: IsoDate, until: IsoDate, match?: Match, tag?: Tag): CategoryAmount[] {
  const w = whereSql(match, tag);
  return db
    .prepare(
      `${WITH_LEDGER} SELECT ledger.category_id AS categoryId, -SUM(ledger.amount) AS spent, COUNT(*) AS count
       FROM ledger
       WHERE ledger.date >= ? AND ledger.date < ? AND ledger.flow IN ${SPENDING_FLOWS_SQL}${w.sql}
       GROUP BY ledger.category_id
       ORDER BY spent DESC, ledger.category_id IS NULL, ledger.category_id`,
    )
    .all(from, until, ...w.params)
    .map((r) => ({ categoryId: r.categoryId as number | null, amount: r.spent as number, count: r.count as number }));
}

export function spendingByParent(db: Db, from: IsoDate, until: IsoDate, tag?: Tag): CategoryAmount[] {
  const w = whereSql(undefined, tag);
  return db
    .prepare(
      `${WITH_LEDGER} SELECT COALESCE(ledger.category_parent_id, ledger.category_id) AS categoryId,
         -SUM(ledger.amount) AS spent, COUNT(*) AS count
       FROM ledger
       WHERE ledger.date >= ? AND ledger.date < ? AND ledger.flow IN ${SPENDING_FLOWS_SQL}${w.sql}
       GROUP BY 1
       ORDER BY spent DESC, categoryId IS NULL, categoryId`,
    )
    .all(from, until, ...w.params)
    .map((r) => ({ categoryId: r.categoryId as number | null, amount: r.spent as number, count: r.count as number }));
}

/** Spending per day with any spending, oldest first. */
function spentByDate(db: Db, range: DateRange, match: Match, tag: Tag): { date: IsoDate; spent: Agorot }[] {
  const w = whereSql(match, tag);
  return db
    .prepare(
      `${WITH_LEDGER} SELECT ledger.date AS date, -SUM(ledger.amount) AS spent FROM ledger
       WHERE ledger.date >= ? AND ledger.date <= ? AND ledger.flow IN ${SPENDING_FLOWS_SQL}${w.sql}
       GROUP BY ledger.date ORDER BY ledger.date`,
    )
    .all(range.from, range.to, ...w.params) as { date: IsoDate; spent: Agorot }[];
}

/** Cumulative spending at the end of each bucket. With `today`, buckets that start after it are left out. */
function cumulative(days: { date: IsoDate; spent: Agorot }[], buckets: DateRange[], today?: IsoDate): SeriesPoint[] {
  let running = 0;
  let i = 0;
  const points: SeriesPoint[] = [];
  for (const b of buckets) {
    if (today !== undefined && b.from > today) break;
    while (i < days.length && (days[i] as { date: IsoDate }).date <= b.to) running += (days[i++] as { spent: Agorot }).spent;
    points.push({ from: b.from, to: b.to, amount: running });
  }
  return points;
}

function seriesOf(db: Db, range: DateRange, bucket: SeriesBucket, match: Match, tag: Tag, today?: IsoDate) {
  const days = spentByDate(db, range, match, tag);
  return { days, series: cumulative(days, bucketsOf(range, bucket), today) };
}

/** The optional `essential` arg of the period channels. */
function tagOf(args: EssentialFilter): Tag {
  check(args.essential === undefined || typeof args.essential === "boolean");
  return args.essential;
}

// ---- What the window asks for ----

/** With `essential`, every spending number is that tag's only; income, transfers and review stay whole. */
export function periodSummary(db: Db, args: DateRange & EssentialFilter, opts: { now?: Date } = {}): PeriodSummary {
  assertRange(args);
  const tag = tagOf(args);
  const range = { from: args.from, to: args.to };
  const today = israelToday(opts.now ?? new Date());
  const until = shiftDay(range.to, 1);
  const t = totals(db, range.from, until);
  const bucket = bucketFor(range);
  const { series } = seriesOf(db, range, bucket, undefined, tag, today);

  const before = previousRange(range);
  const prev = seriesOf(db, before, bucket, undefined, tag);
  const prevSpending = prev.series.at(-1)?.amount ?? 0;
  const inProgress = range.from <= today && today <= range.to;
  // By the same point: as many days into the previous period as today is into this one.
  const sameDay = shiftDay(before.from, dayNumber(today) - dayNumber(range.from));
  const sameTime = inProgress
    ? prev.days.filter((d) => d.date <= sameDay).reduce((a, d) => a + d.spent, 0)
    : range.to < today
      ? prevSpending
      : 0;

  const spending = tag === undefined ? t.spending : taggedSpending(db, range.from, until, tag);

  return {
    from: range.from,
    to: range.to,
    income: t.income,
    spending,
    transfers: t.transfers,
    needsReview: t.needsReview,
    byCategory: spendingByCategory(db, range.from, until, undefined, tag),
    byParent: spendingByParent(db, range.from, until, tag),
    bucket,
    series,
    inProgress,
    previous: { ...before, spending: prevSpending, sameTime, series: prev.series },
    untagged: taggedSpending(db, range.from, until, null),
    left: t.income - t.spending - t.transfers,
    comparison: compareSpending(spending, sameTime),
  };
}

/** Under 2% apart counts as "about the same" on Home. */
export function compareSpending(spending: Agorot, base: Agorot): SpendingComparison {
  const change = spending - base;
  return { base, change, aboutSame: Math.abs(change) < base * 0.02 };
}

/** A month's spending by top-level category, without the row counts. */
function parentsOf(db: Db, from: IsoDate, until: IsoDate, tag: Tag): TrendPoint["byParent"] {
  return spendingByParent(db, from, until, tag).map(({ categoryId, amount }) => ({ categoryId, amount }));
}

/** One month of the trend: spending by category, all of it or one tag's. */
export function trendPoint(db: Db, month: IsoMonth, tag: Tag = undefined): TrendPoint {
  const { from, until } = monthBounds(month);
  const t = totals(db, from, until);
  const byCategory = spendingByCategory(db, from, until, undefined, tag).map(({ categoryId, amount }) => ({ categoryId, amount }));
  const spending = tag === undefined ? t.spending : taggedSpending(db, from, until, tag);
  return { month, income: t.income, spending, byCategory, byParent: parentsOf(db, from, until, tag) };
}

/** All of a month's spending, by category and split by tag, for Home's bars. */
function splitTrendPoint(db: Db, month: IsoMonth): TrendPoint {
  const { from, until } = monthBounds(month);
  return { ...trendPoint(db, month), split: essentialSplit(db, from, until) };
}

/**
 * One month of the trend for chosen categories: one entry per id, in the
 * order asked, each with its subcategories (null is uncategorized).
 * `spending` is their sum, so the ids should not overlap.
 */
function chosenTrendPoint(db: Db, month: IsoMonth, categoryIds: (number | null)[], tag: Tag): TrendPoint {
  const { from, until } = monthBounds(month);
  const t = totals(db, from, until);
  const byCategory = categoryIds.map((categoryId) => {
    const rows = spendingByCategory(db, from, until, categoryId, tag);
    return { categoryId, amount: rows.reduce((sum, r) => sum + r.amount, 0) };
  });
  const spending = byCategory.reduce((sum, c) => sum + c.amount, 0);
  return { month, income: t.income, spending, byCategory, byParent: parentsOf(db, from, until, tag) };
}

/** The months the range covers, never past this month, padded back to at least three. */
export function periodTrend(
  db: Db,
  args: DateRange & EssentialFilter & { categoryIds?: (number | null)[] },
  opts: { now?: Date } = {},
): TrendPoint[] {
  assertRange(args);
  const tag = tagOf(args);
  const { categoryIds } = args;
  if (categoryIds !== undefined) {
    check(Array.isArray(categoryIds) && categoryIds.length <= MAX_CURVES);
    check(categoryIds.every((id) => id === null || isId(id)));
    check(new Set(categoryIds).size === categoryIds.length);
  }
  const thisMonth = israelMonth(opts.now ?? new Date());
  const first = args.from.slice(0, 7);
  let last = args.to.slice(0, 7);
  if (last > thisMonth) last = thisMonth < first ? first : thisMonth;
  const index = (m: IsoMonth) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
  const count = Math.max(MIN_TREND_MONTHS, index(last) - index(first) + 1);
  const months = Array.from({ length: count }, (_, i) => addMonths(last, i - count + 1));
  return months.map((m) =>
    categoryIds ? chosenTrendPoint(db, m, categoryIds, tag) : tag === undefined ? splitTrendPoint(db, m) : trendPoint(db, m, tag),
  );
}

/** Cumulative spending per bucket for each category, this period (to today) and the one before (full). */
export function periodCurves(
  db: Db,
  args: DateRange & EssentialFilter & { categoryIds: (number | null)[] },
  opts: { now?: Date } = {},
): PeriodCurve[] {
  assertRange(args);
  const tag = tagOf(args);
  const { categoryIds } = args;
  check(Array.isArray(categoryIds) && categoryIds.length <= MAX_CURVES);
  check(categoryIds.every((id) => id === null || isId(id)));
  const today = israelToday(opts.now ?? new Date());
  const range = { from: args.from, to: args.to };
  const bucket = bucketFor(range);
  const before = previousRange(range);
  return categoryIds.map((categoryId) => ({
    categoryId,
    bucket,
    series: seriesOf(db, range, bucket, categoryId, tag, today).series,
    previous: seriesOf(db, before, bucket, categoryId, tag).series,
  }));
}

/**
 * Money left this calendar month in Israel time (spec 22): income received
 * minus spending minus money moved to savings (it is not spending, but it is
 * no longer there to spend), over the whole month like every month total, and
 * how much that leaves per day from today to the month's end, today included,
 * rounded down to whole shekels.
 */
export function thisMonth(db: Db, opts: { now?: Date } = {}): ThisMonth {
  const today = israelToday(opts.now ?? new Date());
  const month = today.slice(0, 7);
  const { from, until } = monthBounds(month);
  const t = totals(db, from, until);
  const left = t.income - t.spending - t.transfers;
  const daysLeft = dayNumber(until) - dayNumber(today);
  const perDay = left > 0 ? Math.floor(left / daysLeft / 100) * 100 : null;
  return { month, today, income: t.income, spending: t.spending, transfers: t.transfers, left, daysLeft, perDay };
}
