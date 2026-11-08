// Summaries for any range of days (spec 16): totals, categories, the spending
// series and the period before. Month summaries are these over a month's
// days, so both always agree. Days are `YYYY-MM-DD`, both ends included.

import type { SQLInputValue } from "node:sqlite";
import type {
  Agorot,
  DateRange,
  IsoDate,
  IsoMonth,
  PeriodCurve,
  PeriodSummary,
  SeriesBucket,
  SeriesPoint,
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

function matchSql(match: Match): { sql: string; params: SQLInputValue[] } {
  if (match === undefined) return { sql: "", params: [] };
  if (match === null) return { sql: " AND ledger.category_id IS NULL", params: [] };
  return { sql: " AND (ledger.category_id = ? OR ledger.category_parent_id = ?)", params: [match, match] };
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

type CategoryAmount = { categoryId: number | null; amount: Agorot; count: number };

export function spendingByCategory(db: Db, from: IsoDate, until: IsoDate, match?: Match): CategoryAmount[] {
  const m = matchSql(match);
  return db
    .prepare(
      `${WITH_LEDGER} SELECT ledger.category_id AS categoryId, -SUM(ledger.amount) AS spent, COUNT(*) AS count
       FROM ledger
       WHERE ledger.date >= ? AND ledger.date < ? AND ledger.flow IN ${SPENDING_FLOWS_SQL}${m.sql}
       GROUP BY ledger.category_id
       ORDER BY spent DESC, ledger.category_id IS NULL, ledger.category_id`,
    )
    .all(from, until, ...m.params)
    .map((r) => ({ categoryId: r.categoryId as number | null, amount: r.spent as number, count: r.count as number }));
}

export function spendingByParent(db: Db, from: IsoDate, until: IsoDate): CategoryAmount[] {
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

/** Spending per day with any spending, oldest first. */
function spentByDate(db: Db, range: DateRange, match?: Match): { date: IsoDate; spent: Agorot }[] {
  const m = matchSql(match);
  return db
    .prepare(
      `${WITH_LEDGER} SELECT ledger.date AS date, -SUM(ledger.amount) AS spent FROM ledger
       WHERE ledger.date >= ? AND ledger.date <= ? AND ledger.flow IN ${SPENDING_FLOWS_SQL}${m.sql}
       GROUP BY ledger.date ORDER BY ledger.date`,
    )
    .all(range.from, range.to, ...m.params) as { date: IsoDate; spent: Agorot }[];
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

function seriesOf(db: Db, range: DateRange, bucket: SeriesBucket, match: Match, today?: IsoDate) {
  const days = spentByDate(db, range, match);
  return { days, series: cumulative(days, bucketsOf(range, bucket), today) };
}

// ---- What the window asks for ----

export function periodSummary(db: Db, range: DateRange, opts: { now?: Date } = {}): PeriodSummary {
  assertRange(range);
  const today = israelToday(opts.now ?? new Date());
  const t = totals(db, range.from, shiftDay(range.to, 1));
  const bucket = bucketFor(range);
  const { series } = seriesOf(db, range, bucket, undefined, today);

  const before = previousRange(range);
  const prev = seriesOf(db, before, bucket, undefined);
  const prevSpending = prev.series.at(-1)?.amount ?? 0;
  const inProgress = range.from <= today && today <= range.to;
  // By the same point: as many days into the previous period as today is into this one.
  const sameDay = shiftDay(before.from, dayNumber(today) - dayNumber(range.from));
  const sameTime = inProgress
    ? prev.days.filter((d) => d.date <= sameDay).reduce((a, d) => a + d.spent, 0)
    : range.to < today
      ? prevSpending
      : 0;

  return {
    from: range.from,
    to: range.to,
    income: t.income,
    spending: t.spending,
    transfers: t.transfers,
    needsReview: t.needsReview,
    byCategory: spendingByCategory(db, range.from, shiftDay(range.to, 1)),
    byParent: spendingByParent(db, range.from, shiftDay(range.to, 1)),
    bucket,
    series,
    inProgress,
    previous: { ...before, spending: prevSpending, sameTime, series: prev.series },
  };
}

/** One month of the trend: all spending, or one category's (with its subcategories). */
export function trendPoint(db: Db, month: IsoMonth, match?: Match): TrendPoint {
  const { from, until } = monthBounds(month);
  const t = totals(db, from, until);
  const byCategory = spendingByCategory(db, from, until, match).map(({ categoryId, amount }) => ({ categoryId, amount }));
  const spending = match === undefined ? t.spending : byCategory.reduce((a, c) => a + c.amount, 0);
  return { month, income: t.income, spending, byCategory };
}

/** The months the range covers, never past this month, padded back to at least three. */
export function periodTrend(
  db: Db,
  args: DateRange & { categoryId?: number | null },
  opts: { now?: Date } = {},
): TrendPoint[] {
  assertRange(args);
  const { categoryId } = args;
  check(categoryId === undefined || categoryId === null || isId(categoryId));
  const thisMonth = israelMonth(opts.now ?? new Date());
  const first = args.from.slice(0, 7);
  let last = args.to.slice(0, 7);
  if (last > thisMonth) last = thisMonth < first ? first : thisMonth;
  const index = (m: IsoMonth) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
  const count = Math.max(MIN_TREND_MONTHS, index(last) - index(first) + 1);
  return Array.from({ length: count }, (_, i) => trendPoint(db, addMonths(last, i - count + 1), categoryId));
}

/** Cumulative spending per bucket for each category, this period (to today) and the one before (full). */
export function periodCurves(
  db: Db,
  args: DateRange & { categoryIds: (number | null)[] },
  opts: { now?: Date } = {},
): PeriodCurve[] {
  assertRange(args);
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
    series: seriesOf(db, range, bucket, categoryId, today).series,
    previous: seriesOf(db, before, bucket, categoryId).series,
  }));
}
