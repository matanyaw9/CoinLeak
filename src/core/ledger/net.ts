// Saved or overspent, month by month (spec 30): each calendar month's income
// minus spending, with the same flows as every other total. Money moved to
// savings is reported next to the net but is not part of it.

import type { DateRange, IsoMonth, MonthNet } from "@shared/types";
import type { Db } from "../db";
import { addMonths, israelMonth, monthBounds } from "./dates";
import { firstMonth } from "./average";
import { assertRange, totals } from "./period";

/** The month-by-month bars show at least this many months. */
const WINDOW_MONTHS = 12;

/**
 * The months the bars show: at least 12, ending at the range's last month
 * (or this month, if the range runs past it), going back to the range's
 * first month when it is longer.
 */
export function netMonths(range: DateRange, thisMonth: IsoMonth): IsoMonth[] {
  const rangeEnd = range.to.slice(0, 7);
  const last = rangeEnd < thisMonth ? rangeEnd : thisMonth;
  const windowStart = addMonths(last, 1 - WINDOW_MONTHS);
  const rangeStart = range.from.slice(0, 7);
  const months: IsoMonth[] = [];
  for (let m = rangeStart < windowStart ? rangeStart : windowStart; m <= last; m = addMonths(m, 1)) months.push(m);
  return months;
}

/** One point per month, oldest first, leaving out months before the first transaction. */
export function monthlyNet(db: Db, range: DateRange, opts: { now?: Date } = {}): MonthNet[] {
  assertRange(range);
  const thisMonth = israelMonth(opts.now ?? new Date());
  const first = firstMonth(db);
  if (first === null) return [];
  return netMonths(range, thisMonth)
    .filter((month) => month >= first)
    .map((month) => {
      const { from, until } = monthBounds(month);
      const t = totals(db, from, until);
      return {
        month,
        income: t.income,
        spending: t.spending,
        transfers: t.transfers,
        net: t.income - t.spending,
        partial: month === thisMonth,
      };
    });
}
