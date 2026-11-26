// Spec 40: which budget a move broke. A move always saves; this only compares
// core's plan before and after it, by the two fields core sends for that.

import type { Agorot, BudgetPlan } from "@shared/types";

export interface NewlyOver {
  /** The category now over, or null for the total. */
  categoryId: number | null;
  over: Agorot;
}

const turned = (before: Agorot | null | undefined, after: Agorot | null): boolean =>
  before !== null && before !== undefined && before >= 0 && after !== null && after < 0;

/**
 * The first budget that fitted `before` and is over `after`: a line (tree
 * order), else the total. Null when nothing is newly over.
 */
export function newlyOver(before: BudgetPlan, after: BudgetPlan): NewlyOver | null {
  const was = new Map(before.lines.map((l) => [l.categoryId, l.leftInside]));
  for (const line of after.lines) {
    if (turned(was.get(line.categoryId), line.leftInside)) return { categoryId: line.categoryId, over: -(line.leftInside as Agorot) };
  }
  return turned(before.left, after.left) ? { categoryId: null, over: -(after.left as Agorot) } : null;
}
