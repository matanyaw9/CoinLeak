import { describe, expect, it } from "vitest";
import type { BudgetPlan, BudgetPlanLine } from "@shared/types";
import { newlyOver } from "./newly-over";

/** A plan with the total's `left` and each category's `leftInside`; only those are read. */
const plan = (left: number | null, lines: Record<number, number | null>): BudgetPlan => ({
  month: "2026-11",
  total: null,
  split: 0,
  left,
  averageIncome: null,
  averageSpending: null,
  lines: Object.entries(lines).map(([id, leftInside]) => ({ categoryId: Number(id), leftInside }) as BudgetPlanLine),
});

describe("newlyOver", () => {
  it("is null when nothing is over", () => {
    expect(newlyOver(plan(500, { 1: 300, 2: null }), plan(0, { 1: 0, 2: null }))).toBeNull();
    expect(newlyOver(plan(null, {}), plan(null, {}))).toBeNull();
  });

  it("is null for what was already over, even further over now", () => {
    expect(newlyOver(plan(-100, { 1: -200 }), plan(-400, { 1: -500 }))).toBeNull();
  });

  it("names a line that fitted and is now over", () => {
    expect(newlyOver(plan(null, { 1: 500, 2: 0 }), plan(null, { 1: 500, 2: -20000 }))).toEqual({ categoryId: 2, over: 20000 });
  });

  it("names the total when only it is newly over", () => {
    expect(newlyOver(plan(100, { 1: null }), plan(-300, { 1: null }))).toEqual({ categoryId: null, over: 300 });
  });

  it("prefers a line to the total", () => {
    expect(newlyOver(plan(100, { 1: 100 }), plan(-300, { 1: -50 }))).toEqual({ categoryId: 1, over: 50 });
  });
});
