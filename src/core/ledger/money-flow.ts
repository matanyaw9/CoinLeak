// Where a month's money came from and where it went, as nodes and links for
// a Sankey (spec 14). Everything flows through one hub in the middle, and the
// two sides always balance: a shortfall is shown as money from savings or
// earlier months, never hidden or invented away. Amounts are agorot.

import type { Agorot, IsoMonth, MoneyFlow, MoneyFlowLink, MoneyFlowNode } from "@shared/types";
import type { Db } from "../db";
import { assertMonth, monthBounds } from "./dates";
import { LEDGER_SQL } from "./flow";
import { spendingByParent, totals } from "./queries";

interface Part {
  categoryId: number | null;
  amount: Agorot;
}

/** Net amount per top-level category for one flow; money out is positive when `sign` is -1. */
function byTopLevel(db: Db, flow: "income" | "transfer", sign: 1 | -1, from: string, until: string): Part[] {
  return db
    .prepare(
      `WITH ledger AS (${LEDGER_SQL})
       SELECT COALESCE(ledger.category_parent_id, ledger.category_id) AS categoryId, ? * SUM(ledger.amount) AS amount
       FROM ledger WHERE ledger.date >= ? AND ledger.date < ? AND ledger.flow = ?
       GROUP BY 1 ORDER BY amount DESC, categoryId IS NULL, categoryId`,
    )
    .all(sign, from, until, flow) as unknown as Part[];
}

export function monthFlow(db: Db, month: IsoMonth): MoneyFlow {
  assertMonth(month);
  const { from, until } = monthBounds(month);
  const t = totals(db, from, until);
  const income = byTopLevel(db, "income", 1, from, until);
  const spending = spendingByParent(db, from, until);
  const transfers = byTopLevel(db, "transfer", -1, from, until);

  // A category refunded more than it spent, or money back from savings,
  // is money coming in. Everything else on those lists goes out.
  const refunds = spending.filter((p) => p.amount < 0).map((p) => ({ categoryId: p.categoryId, amount: -p.amount }));
  const outSpending = spending.filter((p) => p.amount > 0);
  const outTransfers = transfers.filter((p) => p.amount > 0);
  const backFromSavings = sum(transfers.filter((p) => p.amount < 0).map((p) => -p.amount));

  const have = sum(income.map((p) => p.amount)) + sum(refunds.map((p) => p.amount)) + backFromSavings;
  const need = sum(outSpending.map((p) => p.amount)) + sum(outTransfers.map((p) => p.amount));
  const fromSavings = backFromSavings + Math.max(0, need - have);
  const left = Math.max(0, have - need);

  const sources: MoneyFlowNode[] = [
    ...income.map((p) => node("income", p)),
    ...refunds.map((p) => node("refund", p)),
    ...(fromSavings > 0 ? [node("from_savings", { categoryId: null, amount: fromSavings })] : []),
  ];
  const targets: MoneyFlowNode[] = [
    ...outSpending.map((p) => node("spending", p)),
    ...outTransfers.map((p) => node("transfer", p)),
    ...(left > 0 ? [node("left", { categoryId: null, amount: left })] : []),
  ];
  const base = { month, income: t.income, spending: t.spending, transfers: t.transfers };
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

function node(kind: MoneyFlowNode["kind"], p: Part): MoneyFlowNode {
  return { kind, categoryId: p.categoryId, amount: p.amount };
}

function sum(values: Agorot[]): Agorot {
  return values.reduce((a, b) => a + b, 0);
}
