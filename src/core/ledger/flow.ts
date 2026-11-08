// The meaning of a row (REQUIREMENTS section 4, money model) and why it needs
// review. Each rule exists once in TypeScript and once as SQL; a test proves
// they agree. Every query reads rows through LEDGER_SQL so none re-derives it.

import type { Agorot, CategoryKind, CategorySource, Flow, ReviewFlag } from "@shared/types";

export interface FlowFacts {
  amount: Agorot;
  /** The user moved the row to Trash (`trashed_at` is set). */
  trashed: boolean;
  /** A pending row the bank no longer reports (`gone_at` is set). */
  gone: boolean;
  excluded: boolean;
  internal: boolean;
  categoryKind: CategoryKind | null;
}

export function flowOf(f: FlowFacts): Flow {
  if (f.trashed) return "trashed";
  if (f.gone) return "gone";
  if (f.excluded) return "excluded";
  if (f.internal) return "internal";
  if (f.categoryKind === "transfer") return "transfer";
  if (f.amount > 0) return f.categoryKind === "expense" ? "refund" : "income";
  return "spending";
}

export interface FlagFacts extends FlowFacts {
  categoryId: number | null;
  categorySource: CategorySource | null;
  possibleCardBill: boolean;
}

/**
 * Only rows that count in the totals need a look, plus gone rows, which wait
 * for the user to delete them. A trashed row never needs a look. A possible card bill is settled once the user
 * excludes it, marks it internal, or categorizes it by hand (they looked and
 * said what it is).
 */
export function flagsOf(f: FlagFacts): ReviewFlag[] {
  const flow = flowOf(f);
  if (flow === "gone") return ["gone"];
  const counted = flow === "spending" || flow === "income";
  const flags: ReviewFlag[] = [];
  if (counted && f.categoryId === null) flags.push("uncategorized");
  if (counted && f.possibleCardBill && f.categorySource !== "user") flags.push("possible_card_bill");
  return flags;
}

/** Same rules as `flowOf`. Needs `transactions t LEFT JOIN categories c`. */
export const FLOW_SQL = `(CASE
  WHEN t.trashed_at IS NOT NULL THEN 'trashed'
  WHEN t.gone_at IS NOT NULL THEN 'gone'
  WHEN t.excluded = 1 THEN 'excluded'
  WHEN t.internal = 1 THEN 'internal'
  WHEN c.kind = 'transfer' THEN 'transfer'
  WHEN t.amount > 0 AND c.kind = 'expense' THEN 'refund'
  WHEN t.amount > 0 THEN 'income'
  ELSE 'spending'
END)`;

const COUNTED_SQL = `${FLOW_SQL} IN ('spending', 'income')`;
const UNCATEGORIZED_SQL = `(${COUNTED_SQL} AND t.category_id IS NULL)`;
const CARD_BILL_FLAG_SQL = `(${COUNTED_SQL} AND t.possible_card_bill = 1
  AND (t.category_source IS NULL OR t.category_source <> 'user'))`;
const GONE_FLAG_SQL = `(${FLOW_SQL} = 'gone')`;

/**
 * Every transaction with its flow and review flags. Use as a CTE:
 * `WITH ledger AS (${LEDGER_SQL}) SELECT ... FROM ledger`. A gone row keeps
 * its stored status ('pending'); readers show status 'gone' when flow is.
 */
export const LEDGER_SQL = `SELECT t.*,
  c.kind AS category_kind,
  c.parent_id AS category_parent_id,
  ${FLOW_SQL} AS flow,
  ${UNCATEGORIZED_SQL} AS flag_uncategorized,
  ${CARD_BILL_FLAG_SQL} AS flag_possible_card_bill,
  ${GONE_FLAG_SQL} AS flag_gone
FROM transactions t LEFT JOIN categories c ON c.id = t.category_id`;

/** Flows that make up "spending" in summaries; refunds reduce it. */
export const SPENDING_FLOWS_SQL = "('spending', 'refund')";
