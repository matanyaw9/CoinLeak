// Which categories the category curves draw (spec 26, F61): the top 5, or
// chosen spending categories (null is uncategorized), added up into one line
// (spec 38, F79). An empty set is the top 5. No limit: one line however many.

import type { CategoryIndex } from "@/lib/categories";
import { s } from "@/strings";
import { nameOf } from "./chooser";

export type CurveChoice = (number | null)[];

/** Drops ids of categories that are gone (deleted or archived since they were chosen). */
export function liveChoice(chosen: CurveChoice, index: CategoryIndex): CurveChoice {
  return chosen.filter((id) => id === null || index.byId.has(id));
}

/** The summed line's name: "Groceries, Coffee and Fuel", or "Groceries and 4 more" past three. */
export function sumName(chosen: CurveChoice, index: CategoryIndex): string {
  return s.chooser.names(chosen.map((id) => nameOf(index, id)));
}
