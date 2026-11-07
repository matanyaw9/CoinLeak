// Groups an already sorted transaction list by day for display, with the
// day's spending and income, read from the flow core gave each row.

import type { Agorot, IsoDate, TransactionRow } from "@shared/types";

export interface DayGroup {
  date: IsoDate;
  rows: TransactionRow[];
  /** Positive: money spent that day, after refunds. */
  spent: Agorot;
  income: Agorot;
}

export function groupByDay(rows: TransactionRow[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const row of rows) {
    let g = groups.at(-1);
    if (!g || g.date !== row.date) {
      g = { date: row.date, rows: [], spent: 0, income: 0 };
      groups.push(g);
    }
    g.rows.push(row);
    if (row.flow === "spending" || row.flow === "refund") g.spent -= row.amount;
    if (row.flow === "income") g.income += row.amount;
  }
  return groups;
}
