// Which categories the category curves draw (spec 26, F61): the top 5, or a
// chosen set of any spending categories (null is uncategorized). An empty
// set is the top 5. At most 5 chosen too: each one adds an average curve, and more is unreadable.

import type { CategoryIndex } from "@/lib/categories";

export type CurveChoice = (number | null)[];

export const MAX_CHOSEN = 5;

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
