// Which categories the trend card shows (spec 16, F43). An empty list is all
// spending. Ticks never overlap, so no money is counted twice: ticking a
// category unticks everything under it and everything above it (spec 34).

import { ancestorsOf, idsUnder, type CategoryIndex } from "@/lib/categories";

/** null is uncategorized. */
export type TrendTicks = (number | null)[];

export function toggleTick(ticks: TrendTicks, id: number | null, index: CategoryIndex): TrendTicks {
  if (ticks.includes(id)) return ticks.filter((t) => t !== id);

  const c = id === null ? undefined : index.byId.get(id);
  const under = id === null ? [] : idsUnder(index, id);
  const above = c ? ancestorsOf(index, c).map((a) => a.id) : [];
  const overlaps = (t: number | null) => t !== null && (under.includes(t) || above.includes(t));
  return [...ticks.filter((t) => !overlaps(t)), id];
}
