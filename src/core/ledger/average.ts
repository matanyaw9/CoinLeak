// The average month (spec 26): which months it is taken over, its spending,
// and its curve through the month. period.ts feeds it the same sums the bars
// and curves use, so the average always agrees with them.

import type { Agorot, AverageCurve, DateRange, IsoDate, IsoMonth, MonthAverage } from "@shared/types";
import type { Db } from "../db";
import { addMonths, dayNumber, monthBounds, toIsoDate } from "./dates";
import { LEDGER_SQL } from "./flow";

/** Fewer average months than this show no average. */
export const MIN_AVERAGE_MONTHS = 2;
/** The bars' window: 12 months up to the period's month. */
const WINDOW_MONTHS = 12;

/** The month of the profile's first transaction (trashed and gone rows aside), or null with none. */
export function firstMonth(db: Db): IsoMonth | null {
  const row = db
    .prepare(`WITH ledger AS (${LEDGER_SQL}) SELECT MIN(ledger.date) AS first FROM ledger WHERE ledger.flow NOT IN ('trashed', 'gone')`)
    .get() as { first: IsoDate | null };
  return row.first === null ? null : row.first.slice(0, 7);
}

/** The window's months that count: full ones (before this month) from the first transaction's month on. */
export function averageMonths(window: IsoMonth[], thisMonth: IsoMonth, first: IsoMonth | null): IsoMonth[] {
  if (first === null) return [];
  return window.filter((m) => m < thisMonth && m >= first);
}

/** The 12 months the bars show for a month period: up to that month, or this month if it is later. */
export function monthWindow(month: IsoMonth, thisMonth: IsoMonth): IsoMonth[] {
  const last = month < thisMonth ? month : thisMonth;
  return Array.from({ length: WINDOW_MONTHS }, (_, i) => addMonths(last, i - WINDOW_MONTHS + 1));
}

const mean = (sum: number, count: number): Agorot => Math.round(sum / count);

/** The mean of the months' spending, or null with fewer than 2 months. Months come oldest first. */
export function monthAverage(months: { month: IsoMonth; spending: Agorot }[]): MonthAverage | null {
  if (months.length < MIN_AVERAGE_MONTHS) return null;
  const sum = months.reduce((a, m) => a + m.spending, 0);
  return {
    from: (months[0] as { month: IsoMonth }).month,
    to: (months.at(-1) as { month: IsoMonth }).month,
    count: months.length,
    amount: mean(sum, months.length),
  };
}

/**
 * The average month's cumulative spending on each day of the period's month
 * (`days`, one range per day). For day d each month adds its spending up to
 * day d, or its whole spending when it is shorter; the last day always takes
 * whole months, so the curve ends on the bar average. `spent` is spending per
 * date over the months, oldest first. Null with fewer than 2 months.
 */
export function averageCurve(
  spent: { date: IsoDate; spent: Agorot }[],
  months: IsoMonth[],
  days: DateRange[],
): AverageCurve | null {
  if (months.length < MIN_AVERAGE_MONTHS) return null;
  // A month shorter than d has nothing on day d, so adding by day of month
  // gives each such month its month-end total. totals[d - 1] runs through day d.
  const byDay = new Array<number>(31).fill(0);
  const inMonths = new Set(months);
  for (const d of spent) {
    const i = Number(d.date.slice(8, 10)) - 1;
    if (inMonths.has(d.date.slice(0, 7))) byDay[i] = (byDay[i] as number) + d.spent;
  }
  const totals: number[] = [];
  let running = 0;
  for (const amount of byDay) totals.push((running += amount));
  const series = days.map((day, i) => {
    const d = i === days.length - 1 ? 31 : i + 1;
    return { from: day.from, to: day.to, amount: mean(totals[d - 1] as number, months.length) };
  });
  return { from: months[0] as IsoMonth, to: months.at(-1) as IsoMonth, count: months.length, series };
}

/** The months as one date range, for a single spending query. */
export function rangeOfMonths(months: IsoMonth[]): DateRange {
  const { from } = monthBounds(months[0] as IsoMonth);
  const { until } = monthBounds(months.at(-1) as IsoMonth);
  return { from, to: toIsoDate(dayNumber(until) - 1) };
}
