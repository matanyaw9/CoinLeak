// Which categories the category curves draw (spec 26, F61): the top 5, or a
// chosen set of any spending categories (null is uncategorized). An empty
// set is the top 5. The limit is core's MAX_CURVES for one request.

import { s } from "@/strings";
import { colorOf, UNCATEGORIZED_COLOR, type CategoryIndex, type Slice } from "@/lib/categories";

export type CurveChoice = (number | null)[];

export const MAX_CHOSEN = 30;

/** Adds or removes the id; adding past the limit changes nothing. */
export function toggleChosen(chosen: CurveChoice, id: number | null): CurveChoice {
  if (chosen.includes(id)) return chosen.filter((x) => x !== id);
  if (chosen.length >= MAX_CHOSEN) return chosen;
  return [...chosen, id];
}

export const atLimit = (chosen: CurveChoice): boolean => chosen.length >= MAX_CHOSEN;

/** Drops ids of categories that are gone (deleted or archived since they were chosen). */
export function liveChoice(chosen: CurveChoice, index: CategoryIndex): CurveChoice {
  return chosen.filter((id) => id === null || index.byId.has(id));
}

/** A chosen category as a chart series; a subcategory without its own color takes its group's. */
export function choiceSlice(index: CategoryIndex, id: number | null): Slice {
  const c = id === null ? undefined : index.byId.get(id);
  const parent = c?.parentId != null ? index.byId.get(c.parentId) : undefined;
  return {
    key: id === null ? "none" : String(id),
    categoryId: id,
    name: c?.name ?? s.common.uncategorized,
    emoji: c?.emoji ?? null,
    color: c ? (c.color ?? colorOf(parent ?? c)) : UNCATEGORIZED_COLOR,
    amount: 0,
  };
}
