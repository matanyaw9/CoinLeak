import { describe, expect, it } from "vitest";
import type { BudgetLine } from "@shared/types";
import { budgetBars, budgetTone, percentOf } from "./budget-card";

const line = (categoryId: number, spentMonth: number, monthlyBudget: number, spentWeek = 0): BudgetLine => ({
  categoryId,
  monthlyBudget,
  spentMonth,
  weeklyBudget: Math.floor(monthlyBudget / 4),
  spentWeek,
});

describe("budget bars", () => {
  it("sort by share of the budget, highest first", () => {
    const lines = [line(1, 5000, 10000), line(2, 12000, 10000), line(3, 100, 100000)];
    expect(budgetBars(lines, "month").map((b) => b.categoryId)).toEqual([2, 1, 3]);
  });

  it("use the week's figures for the week", () => {
    expect(budgetBars([line(1, 5000, 10000, 3000)], "week")).toEqual([{ categoryId: 1, spent: 3000, budget: 2500 }]);
  });

  it("are calm under 80%, a warning from 80 to 100%, over above", () => {
    expect(budgetTone({ categoryId: 1, spent: 7999, budget: 10000 })).toBe("calm");
    expect(budgetTone({ categoryId: 1, spent: 8000, budget: 10000 })).toBe("warning");
    expect(budgetTone({ categoryId: 1, spent: 10000, budget: 10000 })).toBe("warning");
    expect(budgetTone({ categoryId: 1, spent: 10001, budget: 10000 })).toBe("over");
  });

  it("show whole percents, even for a 0 agorot weekly budget", () => {
    expect(percentOf({ categoryId: 1, spent: 12400, budget: 10000 })).toBe(124);
    expect(percentOf({ categoryId: 1, spent: 0, budget: 0 })).toBe(0);
    expect(Number.isFinite(percentOf({ categoryId: 1, spent: 5, budget: 0 }))).toBe(true);
  });
});
