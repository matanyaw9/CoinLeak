// How chosen categories build up through a month: cumulative spending per day,
// this month and last, read through LEDGER_SQL with the same flows as the
// month summary, so refunds reduce spending and nothing else counts.

import type { Agorot, CategoryCurve, IsoDate, IsoMonth } from "@shared/types";
import type { Db } from "../db";
import { addMonths, assertMonth, daysOfMonth, monthBounds } from "./dates";
import { LEDGER_SQL, SPENDING_FLOWS_SQL } from "./flow";
import { check, isId } from "./validate";

/** Enough for "top categories" plus a few more; keeps one request bounded. */
const MAX_CATEGORIES = 30;

const BY_DATE_SQL = `WITH ledger AS (${LEDGER_SQL})
  SELECT ledger.date AS date, -SUM(ledger.amount) AS spent FROM ledger
  WHERE ledger.date >= ? AND ledger.date < ? AND ledger.flow IN ${SPENDING_FLOWS_SQL}
    AND %MATCH%
  GROUP BY ledger.date`;

// A top-level id matches its subcategories too.
const FOR_CATEGORY = BY_DATE_SQL.replace("%MATCH%", "(ledger.category_id = ? OR ledger.category_parent_id = ?)");
const FOR_UNCATEGORIZED = BY_DATE_SQL.replace("%MATCH%", "ledger.category_id IS NULL");

export function categoryCurves(db: Db, args: { month: IsoMonth; categoryIds: (number | null)[] }): CategoryCurve[] {
  check(typeof args === "object" && args !== null);
  const { month, categoryIds } = args;
  assertMonth(month);
  check(Array.isArray(categoryIds) && categoryIds.length <= MAX_CATEGORIES);
  check(categoryIds.every((id) => id === null || isId(id)));

  const forCategory = db.prepare(FOR_CATEGORY);
  const forUncategorized = db.prepare(FOR_UNCATEGORIZED);
  const curve = (categoryId: number | null, m: IsoMonth): { date: IsoDate; amount: Agorot }[] => {
    const { from, until } = monthBounds(m);
    const rows = (
      categoryId === null ? forUncategorized.all(from, until) : forCategory.all(from, until, categoryId, categoryId)
    ) as { date: IsoDate; spent: Agorot }[];
    const spentOn = new Map(rows.map((r) => [r.date, r.spent]));
    let running = 0;
    return daysOfMonth(m).map((date) => {
      running += spentOn.get(date) ?? 0;
      return { date, amount: running };
    });
  };

  const previous = addMonths(month, -1);
  return categoryIds.map((categoryId) => ({
    categoryId,
    byDay: curve(categoryId, month),
    previousByDay: curve(categoryId, previous),
  }));
}
