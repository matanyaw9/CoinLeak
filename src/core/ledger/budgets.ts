// Budgets (spec 27): a monthly amount per spending category, and how much of
// it is spent this month and this week. Weeks run Sunday to Saturday; the
// weekly budget is always the monthly one divided by four, rounded down.

import type { Agorot, BudgetLine, BudgetStatus, DateRange, IsoDate, IsoMonth } from "@shared/types";
import { transaction, type Db } from "../db";
import { assertMonth, dayNumber, isIsoDate, monthBounds, toIsoDate } from "./dates";
import { monthRange, spendingByCategory } from "./period";
import { check, isId } from "./validate";

/** Ten million shekels, in agorot: far above any real budget, still a safe integer. */
export const BUDGET_MAX: Agorot = 1_000_000_000;

export function weeklyBudget(monthly: Agorot): Agorot {
  return Math.floor(monthly / 4);
}

/** The Sunday to Saturday week holding `day`. */
export function weekOf(day: IsoDate): DateRange {
  // Day 0 (1970-01-01) was a Thursday, so +4 makes Sunday 0.
  const n = dayNumber(day);
  const sunday = n - ((n + 4) % 7);
  return { from: toIsoDate(sunday), to: toIsoDate(sunday + 6) };
}

/** The week shown for `month`: the one holding today, or the month's last week. */
export function budgetWeek(month: IsoMonth, today: IsoDate): DateRange {
  return weekOf(today.slice(0, 7) === month ? today : monthRange(month).to);
}

/**
 * Spending in [from, until) for a category and everything under it, by the
 * same rules as Home's category totals (period.ts).
 */
function spentIn(db: Db, categoryId: number, from: IsoDate, until: IsoDate): Agorot {
  return spendingByCategory(db, from, until, categoryId).reduce((sum, r) => sum + r.amount, 0);
}

export function budgetStatus(db: Db, args: { month: IsoMonth; today: IsoDate }): BudgetStatus {
  check(typeof args === "object" && args !== null);
  assertMonth(args.month);
  check(isIsoDate(args.today));
  const { month, today } = args;
  const { from, until } = monthBounds(month);
  const week = budgetWeek(month, today);
  const weekUntil = toIsoDate(dayNumber(week.to) + 1);

  const budgeted = db
    .prepare("SELECT id, monthly_budget FROM categories WHERE monthly_budget IS NOT NULL ORDER BY id")
    .all() as { id: number; monthly_budget: Agorot }[];
  const lines: BudgetLine[] = budgeted.map((c) => ({
    categoryId: c.id,
    monthlyBudget: c.monthly_budget,
    spentMonth: spentIn(db, c.id, from, until),
    weeklyBudget: weeklyBudget(c.monthly_budget),
    spentWeek: spentIn(db, c.id, week.from, weekUntil),
  }));
  return { month, week, currentMonth: today.slice(0, 7) === month, lines };
}

/** Sets or clears (null) a spending category's monthly budget, in agorot. */
export function setBudget(db: Db, categoryId: number, monthlyBudget: Agorot | null): null {
  check(isId(categoryId));
  check(
    monthlyBudget === null ||
      (Number.isSafeInteger(monthlyBudget) && monthlyBudget > 0 && monthlyBudget <= BUDGET_MAX),
  );
  return transaction(db, () => {
    const row = db.prepare("SELECT kind FROM categories WHERE id = ?").get(categoryId) as { kind: string } | undefined;
    check(row !== undefined && row.kind === "expense");
    db.prepare("UPDATE categories SET monthly_budget = ? WHERE id = ?").run(monthlyBudget, categoryId);
    return null;
  });
}
