// Groups an already sorted transaction list by day for display. Each day's
// spending and income come from core's day totals; nothing is summed here.

import type { Agorot, DayTotal, IsoDate, TransactionRow } from "@shared/types";

export interface DayGroup {
  date: IsoDate;
  rows: TransactionRow[];
  /** Positive: money spent that day, after refunds. */
  spent: Agorot;
  income: Agorot;
}

export function groupByDay(rows: TransactionRow[], days: DayTotal[] = []): DayGroup[] {
  const totals = new Map(days.map((d) => [d.date, d]));
  const groups: DayGroup[] = [];
  for (const row of rows) {
    let g = groups.at(-1);
    if (!g || g.date !== row.date) {
      const day = totals.get(row.date);
      g = { date: row.date, rows: [], spent: day?.spent ?? 0, income: day?.income ?? 0 };
      groups.push(g);
    }
    g.rows.push(row);
  }
  return groups;
}
