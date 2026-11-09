// Which categories the trend card shows (spec 16, F43). An empty list is all
// spending. Ticks never overlap, so no money is counted twice: ticking a group
// unticks its own categories, and ticking a category unticks its group.

import type { CategoryIndex } from "@/lib/categories";

/** null is uncategorized. */
export type TrendTicks = (number | null)[];

export function toggleTick(ticks: TrendTicks, id: number | null, index: CategoryIndex): TrendTicks {
  if (ticks.includes(id)) return ticks.filter((t) => t !== id);

  const children = id === null ? [] : (index.children.get(id) ?? []).map((c) => c.id);
  const parent = id === null ? null : (index.byId.get(id)?.parentId ?? null);
  const overlaps = (t: number | null) => t !== null && (children.includes(t) || t === parent);
  return [...ticks.filter((t) => !overlaps(t)), id];
}
