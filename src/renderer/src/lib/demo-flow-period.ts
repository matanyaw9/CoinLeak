// Demo answers for the period channels (spec 16): the same sums, buckets,
// flows and group drill-down core draws (ledger/period.ts, money-flow.ts),
// from the demo rows, so every number adds up. Never used outside demo builds.

import type {
  Agorot,
  Category,
  DateRange,
  Flow,
  GroupFlow,
  IsoDate,
  IsoMonth,
  MoneyFlowLink,
  MoneyFlowNode,
  PeriodCurve,
  PeriodFlow,
  PeriodSummary,
  SeriesBucket,
  SeriesPoint,
  TrendPoint,
} from "@shared/types";
import { addDays, monthOf, parseDate, shiftMonth, toIsoDate } from "./month";

export interface PeriodRow {
  date: IsoDate;
  amount: Agorot;
  flow: Flow;
  categoryId: number | null;
  flags: unknown[];
}

type Part = { categoryId: number | null; amount: Agorot };
type Counted = Part & { count: number };
/** undefined: every row; null: uncategorized; a number: that category and its subcategories. */
type Match = number | null | undefined;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COUNTED: Flow[] = ["spending", "refund"];
const sum = (xs: { amount: Agorot }[]) => xs.reduce((a, x) => a + x.amount, 0);
const days = (r: DateRange) => Math.round((parseDate(r.to).getTime() - parseDate(r.from).getTime()) / 86_400_000) + 1;

export function isRange(r: unknown): r is DateRange {
  const x = r as Partial<DateRange> | null;
  return typeof x?.from === "string" && typeof x.to === "string" && DATE_RE.test(x.from) && DATE_RE.test(x.to) && x.from <= x.to;
}

export function createDemoPeriods(deps: { rows: () => PeriodRow[]; categories: () => Category[]; today: IsoDate }) {
  const parentOf = (id: number | null) => (id === null ? null : (deps.categories().find((c) => c.id === id)?.parentId ?? null));
  const rootOf = (id: number | null) => (id === null ? null : (parentOf(id) ?? id));
  const matches = (id: number | null, match: Match) =>
    match === undefined || (match === null ? id === null : id === match || (id !== null && parentOf(id) === match));
  const inRange = (r: DateRange) => deps.rows().filter((x) => x.date >= r.from && x.date <= r.to);

  function byKey(rows: PeriodRow[], key: (id: number | null) => number | null, sign: 1 | -1): Counted[] {
    const by = new Map<number | null, Counted>();
    for (const r of rows) {
      const k = key(r.categoryId);
      const c = by.get(k) ?? { categoryId: k, amount: 0, count: 0 };
      c.amount += sign * r.amount;
      c.count += 1;
      by.set(k, c);
    }
    return [...by.values()].sort((a, b) => b.amount - a.amount);
  }
  const spent = (r: DateRange, match?: Match) => inRange(r).filter((x) => COUNTED.includes(x.flow) && matches(x.categoryId, match));

  function bucketFor(r: DateRange): SeriesBucket {
    const n = days(r);
    return n <= 62 ? "day" : n <= 366 ? "week" : "month";
  }
  function buckets(r: DateRange, bucket: SeriesBucket): DateRange[] {
    const out: DateRange[] = [];
    for (let from = r.from; from <= r.to; ) {
      let to = bucket === "day" ? from : bucket === "week" ? addDays(from, 6) : addDays(`${shiftMonth(monthOf(from), 1)}-01`, -1);
      if (to > r.to) to = r.to;
      out.push({ from, to });
      from = addDays(to, 1);
    }
    return out;
  }
  function previousRange(r: DateRange): DateRange {
    const to = addDays(r.from, -1);
    const whole = r.from.endsWith("-01") && addDays(r.to, 1).endsWith("-01");
    if (!whole) return { from: addDays(r.from, -days(r)), to };
    const months = (Number(r.to.slice(0, 4)) - Number(r.from.slice(0, 4))) * 12 + Number(r.to.slice(5, 7)) - Number(r.from.slice(5, 7)) + 1;
    return { from: `${shiftMonth(monthOf(r.from), -months)}-01`, to };
  }
  function series(r: DateRange, bucket: SeriesBucket, match: Match, stopAtToday: boolean): SeriesPoint[] {
    const rows = spent(r, match);
    const out: SeriesPoint[] = [];
    for (const b of buckets(r, bucket)) {
      if (stopAtToday && b.from > deps.today) break;
      out.push({ ...b, amount: -sum(rows.filter((x) => x.date <= b.to)) });
    }
    return out;
  }

  function summary(r: DateRange): PeriodSummary {
    const rows = inRange(r);
    const counted = spent(r);
    const byCategory = byKey(counted, (id) => id, -1);
    const bucket = bucketFor(r);
    const before = previousRange(r);
    const prevSeries = series(before, bucket, undefined, false);
    const prevSpending = prevSeries.at(-1)?.amount ?? 0;
    const inProgress = r.from <= deps.today && deps.today <= r.to;
    const sameDay = addDays(before.from, days({ from: r.from, to: deps.today }) - 1);
    const sameTime = inProgress
      ? -sum(spent(before).filter((x) => x.date <= sameDay))
      : r.to < deps.today
        ? prevSpending
        : 0;
    return {
      ...r,
      income: sum(rows.filter((x) => x.flow === "income")),
      spending: -sum(counted),
      transfers: -sum(rows.filter((x) => x.flow === "transfer")),
      needsReview: rows.filter((x) => x.flags.length > 0).length,
      byCategory,
      byParent: byKey(counted, rootOf, -1),
      bucket,
      series: series(r, bucket, undefined, true),
      inProgress,
      previous: { ...before, spending: prevSpending, sameTime, series: prevSeries },
    };
  }

  function flow(r: DateRange): PeriodFlow {
    const rows = inRange(r);
    const sm = summary(r);
    const net = (f: Flow, sign: 1 | -1): Part[] => byKey(rows.filter((x) => x.flow === f), rootOf, sign);
    const income = net("income", 1);
    const transfers = net("transfer", -1);
    const refunds = sm.byParent.filter((p) => p.amount < 0).map((p) => ({ categoryId: p.categoryId, amount: -p.amount }));
    const outSpending = sm.byParent.filter((p) => p.amount > 0);
    const outTransfers = transfers.filter((p) => p.amount > 0);
    const back = -sum(transfers.filter((p) => p.amount < 0));
    const have = sum(income) + sum(refunds) + back;
    const need = sum(outSpending) + sum(outTransfers);
    const shortfall = Math.max(0, need - have);
    const left = Math.max(0, have - need);
    const node = (kind: MoneyFlowNode["kind"]) => (p: Part): MoneyFlowNode => ({ kind, categoryId: p.categoryId, amount: p.amount });
    const sources = [
      ...income.map(node("income")),
      ...refunds.map(node("refund")),
      ...(back > 0 ? [node("from_savings")({ categoryId: null, amount: back })] : []),
      ...(shortfall > 0 ? [node("beyond_income")({ categoryId: null, amount: shortfall })] : []),
    ];
    const targets = [
      ...outSpending.map(node("spending")),
      ...outTransfers.map(node("transfer")),
      ...(left > 0 ? [node("left")({ categoryId: null, amount: left })] : []),
    ];
    const base = { ...r, income: sm.income, spending: sm.spending, transfers: sm.transfers, shortfall };
    const total = sum(sources);
    if (total === 0) return { ...base, nodes: [], links: [] };
    const hub = sources.length;
    return {
      ...base,
      nodes: [...sources, node("hub")({ categoryId: null, amount: total }), ...targets],
      links: [
        ...sources.map((n, i) => ({ source: i, target: hub, amount: n.amount })),
        ...targets.map((n, i) => ({ source: hub, target: hub + 1 + i, amount: n.amount })),
      ],
    };
  }

  function group(r: DateRange, categoryId: number): GroupFlow {
    const parts = byKey(spent(r, categoryId), (id) => id, -1);
    const total = sum(parts);
    const base = { ...r, categoryId, total };
    if (total <= 0) return { ...base, nodes: [], links: [] };
    const groupNode: MoneyFlowNode = { kind: "group", categoryId, amount: total };
    const refunds: MoneyFlowNode[] = parts.filter((p) => p.amount < 0).map((p) => ({ kind: "refund", categoryId: p.categoryId, amount: -p.amount }));
    const out: MoneyFlowNode[] = parts.filter((p) => p.amount > 0).map((p) => ({ kind: "spending", categoryId: p.categoryId, amount: p.amount }));
    if (refunds.length === 0) {
      return { ...base, nodes: [groupNode, ...out], links: out.map((n, i) => ({ source: 0, target: 1 + i, amount: n.amount })) };
    }
    const sources = [groupNode, ...refunds];
    const hub = sources.length;
    const links: MoneyFlowLink[] = [
      ...sources.map((n, i) => ({ source: i, target: hub, amount: n.amount })),
      ...out.map((n, i) => ({ source: hub, target: hub + 1 + i, amount: n.amount })),
    ];
    return { ...base, nodes: [...sources, { kind: "hub", categoryId, amount: sum(out) }, ...out], links };
  }

  /** All spending by category, or with `categoryIds` one entry per id (subcategories included). */
  function trend(r: DateRange, categoryIds?: (number | null)[]): TrendPoint[] {
    const thisMonth = monthOf(deps.today);
    const first = monthOf(r.from);
    let last = monthOf(r.to);
    if (last > thisMonth) last = thisMonth < first ? first : thisMonth;
    const index = (m: IsoMonth) => Number(m.slice(0, 4)) * 12 + Number(m.slice(5, 7));
    const count = Math.max(3, index(last) - index(first) + 1);
    return Array.from({ length: count }, (_, i) => {
      const month = shiftMonth(last, i - count + 1);
      const m = { from: `${month}-01`, to: addDays(`${shiftMonth(month, 1)}-01`, -1) };
      const income = sum(inRange(m).filter((x) => x.flow === "income"));
      if (!categoryIds) {
        const byCategory = byKey(spent(m), (id) => id, -1).map(({ categoryId, amount }) => ({ categoryId, amount }));
        return { month, income, spending: -sum(spent(m)), byCategory };
      }
      const byCategory = categoryIds.map((categoryId) => ({ categoryId, amount: -sum(spent(m, categoryId)) }));
      return { month, income, spending: sum(byCategory), byCategory };
    });
  }

  function curves(r: DateRange, ids: (number | null)[]): PeriodCurve[] {
    const bucket = bucketFor(r);
    const before = previousRange(r);
    return ids.map((categoryId) => ({
      categoryId,
      bucket,
      series: series(r, bucket, categoryId, true),
      previous: series(before, bucket, categoryId, false),
    }));
  }

  return { summary, flow, group, trend, curves };
}

/** Today as the demo's `YYYY-MM-DD`. */
export const demoToday = (d: Date): IsoDate => toIsoDate(d);
