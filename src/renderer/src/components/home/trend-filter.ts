// Which categories the trend card shows (spec 16, F43), and what a click on
// it does (spec 38, F78). An empty list is all spending. Ticks never overlap,
// so no money is counted twice: ticking a category unticks everything under
// it and everything above it (spec 34).

import type { IsoMonth } from "@shared/types";
import { ancestorsOf, idsUnder, type CategoryIndex, type Slice } from "@/lib/categories";

/** null is uncategorized. */
export type TrendTicks = (number | null)[];

/** Core's limit on ticked categories for the bars (`periodTrend`). */
export const TREND_LIMIT = 30;

export function toggleTick(ticks: TrendTicks, id: number | null, index: CategoryIndex): TrendTicks {
  if (ticks.includes(id)) return ticks.filter((t) => t !== id);

  const c = id === null ? undefined : index.byId.get(id);
  const under = id === null ? [] : idsUnder(index, id);
  const above = c ? ancestorsOf(index, c).map((a) => a.id) : [];
  const overlaps = (t: number | null) => t !== null && (under.includes(t) || above.includes(t));
  return [...ticks.filter((t) => !overlaps(t)), id];
}

/**
 * What a click does: tick a category (one level down), or open Transactions
 * for one month or for every month the bars show, filtered to `categories`
 * (each with everything under it; none is all spending).
 */
export type TrendAction =
  | { kind: "tick"; id: number | null }
  | { kind: "month"; categories: TrendTicks; month: IsoMonth }
  | { kind: "range"; categories: TrendTicks };

/**
 * A bar segment. All spending: a category ticks, "Other" opens the month.
 * Ticked: a category with children ticks (one more level down); one without
 * children, "Other in <name>" and Uncategorized open the month.
 */
export function segmentAction(ticks: TrendTicks, index: CategoryIndex, slice: Slice, month: IsoMonth): TrendAction {
  const id = slice.categoryId;
  if (id === undefined) return { kind: "month", categories: [], month };
  if (ticks.length === 0) return { kind: "tick", id };
  // A ticked category's own segment is "Other in <name>", or itself when nothing under it spent.
  const deeper = id !== null && !ticks.includes(id) && (index.children.get(id)?.length ?? 0) > 0;
  return deeper ? { kind: "tick", id } : { kind: "month", categories: [id], month };
}

/** A legend name. All spending: ticks it ("Other" does nothing). Ticked: every month the bars show. */
export function legendAction(ticks: TrendTicks, slice: Slice): TrendAction | null {
  const id = slice.categoryId;
  if (ticks.length === 0) return id === undefined ? null : { kind: "tick", id };
  return { kind: "range", categories: id === undefined ? [] : [id] };
}

/** Enter on a month (keyboard): that month with the chart's filter, the ticked categories or all spending. */
export function monthAction(ticks: TrendTicks, month: IsoMonth): TrendAction {
  return { kind: "month", categories: [...ticks], month };
}
