// How a period reads on screen (spec 16): the picker's label, the words in
// a sentence ("this month", "in the last 7 days") and the period before.

import type { DateRange, IsoDate } from "@shared/types";
import { s } from "@/strings";
import { isOngoing, shiftMonth, type PeriodChoice } from "@/lib/month";
import { formatDayShort, formatMonth, formatMonthName } from "@/lib/format";

export interface PeriodWords {
  /** The picker's label: "November 2026", "2026", "Last 7 days". */
  label: string;
  /** Inside a sentence: "this month", "in March", "in the last 7 days". */
  when: string;
  /** The period before: "October", "2025", "the 7 days before". */
  before: string;
  /** A legend name for this period's line: "November", "2026", "This period". */
  name: string;
  /** Today falls inside the period. */
  ongoing: boolean;
  /** A calendar month or year, where "so far" and "by this day" read well. */
  calendar: boolean;
}

export function rangeLabel(r: DateRange): string {
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  const from = sameYear ? formatDayShort(r.from) : `${formatDayShort(r.from)} ${r.from.slice(0, 4)}`;
  return s.period.range(from, `${formatDayShort(r.to)} ${r.to.slice(0, 4)}`);
}

export function periodWords(choice: PeriodChoice, range: DateRange, today: IsoDate): PeriodWords {
  const ongoing = isOngoing(range, today);
  const p = s.period;
  switch (choice.kind) {
    case "month":
      return {
        label: formatMonth(choice.month),
        when: ongoing ? p.thisMonth : p.inWhen(formatMonthName(choice.month)),
        before: formatMonthName(shiftMonth(choice.month, -1)),
        name: formatMonthName(choice.month),
        ongoing,
        calendar: true,
      };
    case "year":
      return {
        label: String(choice.year),
        when: ongoing ? p.thisYear : p.inWhen(String(choice.year)),
        before: String(choice.year - 1),
        name: String(choice.year),
        ongoing,
        calendar: true,
      };
    case "last7":
    case "last30": {
      const n = choice.kind === "last7" ? 7 : 30;
      return { label: p.kinds[choice.kind], when: p.inWhen(p.lastDays(n)), before: p.daysBefore(n), name: p.kinds[choice.kind], ongoing, calendar: false };
    }
    case "last12":
      return { label: p.kinds.last12, when: p.inWhen(p.last12), before: p.monthsBefore(12), name: p.kinds.last12, ongoing, calendar: false };
    case "custom": {
      const label = rangeLabel(range);
      return {
        label,
        when: p.fromTo(formatDayShort(range.from), formatDayShort(range.to)),
        before: p.periodBefore,
        name: p.thisPeriod,
        ongoing,
        calendar: false,
      };
    }
  }
}
