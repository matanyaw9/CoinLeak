// How chosen categories build up through a month: cumulative spending per day,
// this month (to today) and last month (in full). A month is a range of its
// days, so these are period.ts's curves and agree with every other summary.

import type { CategoryCurve, IsoMonth } from "@shared/types";
import type { Db } from "../db";
import { assertMonth } from "./dates";
import { monthRange, periodCurves } from "./period";
import { check } from "./validate";

export function categoryCurves(
  db: Db,
  args: { month: IsoMonth; categoryIds: (number | null)[] },
  opts: { now?: Date } = {},
): CategoryCurve[] {
  check(typeof args === "object" && args !== null);
  assertMonth(args.month);
  const days = (points: { from: string; amount: number }[]) => points.map((p) => ({ date: p.from, amount: p.amount }));
  return periodCurves(db, { ...monthRange(args.month), categoryIds: args.categoryIds }, opts).map((c) => ({
    categoryId: c.categoryId,
    byDay: days(c.series),
    previousByDay: days(c.previous),
  }));
}
