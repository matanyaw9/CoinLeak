// spec 37: the words on the Budgets page. Money shows whole shekels unless
// it has agorot; the raise offer says who has how much left, what raising
// would set, and what its button is called.

import type { Agorot, BudgetProblem } from "@shared/types";
import { s } from "@/strings";
import { ils } from "@/lib/format";

/** "₪1,200", or "₪1,200.50" when there are agorot. */
export const money = (amount: Agorot): string => ils(amount, { decimals: amount % 100 !== 0 });

/** Spending, in whole shekels: "₪3,129". */
export const shekels = (amount: Agorot): string => ils(amount, { decimals: false });

export type OverProblem = Extract<BudgetProblem, { code: "over_parent" | "over_total" }>;

/** "A", "A and B", "A, B and C". */
function listOf(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * The offer for `child`'s budget that does not fit: "Groceries has ₪300 left
 * for Weekly shop. Raise Groceries to ₪2,400 too?", plus what else rises.
 */
export function offerWords(problem: OverProblem, child: string, nameOf: (id: number) => string): { text: string; button: string } {
  const named = (id: number | null) => (id === null ? s.plan.theTotal : nameOf(id));
  const holder = problem.code === "over_parent" ? nameOf(problem.parentId) : s.plan.theTotalStart;
  const left = problem.room > 0 ? s.plan.roomLeft(holder, money(problem.room), child) : s.plan.roomNone(holder, child);
  const [first, ...more] = problem.raises;
  const raise = first ? ` ${s.plan.raiseOne(named(first.categoryId), money(first.to))}` : "";
  const also = more.length > 0 ? ` ${s.plan.alsoRaises(listOf(more.map((r) => s.plan.raiseItem(named(r.categoryId), money(r.to)))))}` : "";
  return { text: `${left}${raise}${also}`, button: more.length > 0 ? s.plan.raiseAll : s.plan.raiseBoth };
}

/** The share of the total that is split, as a whole percent for the bar; null with no total. */
export function splitPercent(split: Agorot, total: Agorot | null): number | null {
  return total === null ? null : Math.round((split * 100) / total);
}
