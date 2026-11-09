// Where a period's money came from and where it went, as nodes and links for
// a Sankey (specs 14 and 16). Everything flows through one hub, and the two
// sides always balance: spending beyond income is its own node, never hidden
// or dressed up as savings. Also one spending group opened up. Agorot.

import type {
  Agorot,
  DateRange,
  GroupFlow,
  IsoDate,
  IsoMonth,
  MoneyFlow,
  MoneyFlowLink,
  MoneyFlowNode,
  PeriodFlow,
} from "@shared/types";
import type { Db } from "../db";
import { assertMonth, dayNumber, toIsoDate } from "./dates";
import { LEDGER_SQL } from "./flow";
import { assertRange, monthRange, spendingByCategory, spendingByParent, totals } from "./period";
import { check, isId } from "./validate";

interface Part {
  categoryId: number | null;
  amount: Agorot;
}

const until = (to: IsoDate): IsoDate => toIsoDate(dayNumber(to) + 1);

/** Net amount per top-level category for one flow; money out is positive when `sign` is -1. */
function byTopLevel(db: Db, flow: "income" | "transfer", sign: 1 | -1, from: string, end: string): Part[] {
  return db
    .prepare(
      `WITH ledger AS (${LEDGER_SQL})
       SELECT COALESCE(ledger.category_parent_id, ledger.category_id) AS categoryId, ? * SUM(ledger.amount) AS amount
       FROM ledger WHERE ledger.date >= ? AND ledger.date < ? AND ledger.flow = ?
       GROUP BY 1 ORDER BY amount DESC, categoryId IS NULL, categoryId`,
    )
    .all(sign, from, end, flow) as unknown as Part[];
}

export function periodFlow(db: Db, range: DateRange): PeriodFlow {
  assertRange(range);
  const { from, to } = range;
  const end = until(to);
  const t = totals(db, from, end);
  const income = byTopLevel(db, "income", 1, from, end);
  const spending = spendingByParent(db, from, end);
  const transfers = byTopLevel(db, "transfer", -1, from, end);

  // A category refunded more than it spent, or money back from savings,
  // is money coming in. Everything else on those lists goes out.
  const refunds = spending.filter((p) => p.amount < 0).map((p) => ({ categoryId: p.categoryId, amount: -p.amount }));
  const outSpending = spending.filter((p) => p.amount > 0);
  const outTransfers = transfers.filter((p) => p.amount > 0);
  const backFromSavings = sum(transfers.filter((p) => p.amount < 0).map((p) => -p.amount));

  const have = sum(income.map((p) => p.amount)) + sum(refunds.map((p) => p.amount)) + backFromSavings;
  const need = sum(outSpending.map((p) => p.amount)) + sum(outTransfers.map((p) => p.amount));
  // Equals spending + transfers - income, since both are net of refunds and money back.
  const shortfall = Math.max(0, need - have);
  const left = Math.max(0, have - need);

  const sources: MoneyFlowNode[] = [
    ...income.map((p) => node("income", p)),
    ...refunds.map((p) => node("refund", p)),
    ...(backFromSavings > 0 ? [node("from_savings", { categoryId: null, amount: backFromSavings })] : []),
    ...(shortfall > 0 ? [node("beyond_income", { categoryId: null, amount: shortfall })] : []),
  ];
  const targets: MoneyFlowNode[] = [
    ...outSpending.map((p) => node("spending", p)),
    ...outTransfers.map((p) => node("transfer", p)),
    ...(left > 0 ? [node("left", { categoryId: null, amount: left })] : []),
  ];
  const base = { from, to, income: t.income, spending: t.spending, transfers: t.transfers, shortfall };
  const total = sum(sources.map((n) => n.amount));
  if (total === 0) return { ...base, nodes: [], links: [] };

  const hub = sources.length;
  const nodes = [...sources, node("hub", { categoryId: null, amount: total }), ...targets];
  const links: MoneyFlowLink[] = [
    ...sources.map((n, i) => ({ source: i, target: hub, amount: n.amount })),
    ...targets.map((n, i) => ({ source: hub, target: hub + 1 + i, amount: n.amount })),
  ];
  return { ...base, nodes, links };
}

export function monthFlow(db: Db, month: IsoMonth): MoneyFlow {
  assertMonth(month);
  const { from, to, ...flow } = periodFlow(db, monthRange(month));
  void from;
  void to;
  return { month, ...flow };
}

/**
 * One spending group over the range: its total on the left, its categories
 * on the right (the group's own id for rows set on the group itself). A
 * category refunded beyond its spending flows in beside the total, through
 * a hub. Empty when the group spent nothing on balance.
 */
export function groupFlow(db: Db, args: DateRange & { categoryId: number }): GroupFlow {
  assertRange(args);
  check(isId(args.categoryId));
  const { from, to, categoryId } = args;
  const parts = spendingByCategory(db, from, until(to), categoryId);
  const total = sum(parts.map((p) => p.amount));
  const base = { from, to, categoryId, total };
  if (total <= 0) return { ...base, nodes: [], links: [] };

  const group = node("group", { categoryId, amount: total });
  const refunds = parts.filter((p) => p.amount < 0).map((p) => node("refund", { categoryId: p.categoryId, amount: -p.amount }));
  const spent = parts.filter((p) => p.amount > 0).map((p) => node("spending", p));
  if (refunds.length === 0) {
    return {
      ...base,
      nodes: [group, ...spent],
      links: spent.map((n, i) => ({ source: 0, target: 1 + i, amount: n.amount })),
    };
  }
  const sources = [group, ...refunds];
  const hub = sources.length;
  return {
    ...base,
    nodes: [...sources, node("hub", { categoryId, amount: sum(spent.map((n) => n.amount)) }), ...spent],
    links: [
      ...sources.map((n, i) => ({ source: i, target: hub, amount: n.amount })),
      ...spent.map((n, i) => ({ source: hub, target: hub + 1 + i, amount: n.amount })),
    ],
  };
}

function node(kind: MoneyFlowNode["kind"], p: Part): MoneyFlowNode {
  return { kind, categoryId: p.categoryId, amount: p.amount };
}

function sum(values: Agorot[]): Agorot {
  return values.reduce((a, b) => a + b, 0);
}
