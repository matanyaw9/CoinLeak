// The x axis of a period's curves: one slot per day, week or month of the
// whole period (so this period's line can stop at today while the axis runs
// on), with short tick labels and a tooltip title for each.

import type { DateRange, IsoDate, SeriesBucket } from "@shared/types";
import { addDays, monthOf, parseDate, shiftMonth } from "@/lib/month";
import { formatDayShort, formatMonth, formatMonthShort } from "@/lib/format";
import { rangeLabel } from "./period-words";

const dayMonth = new Intl.DateTimeFormat("en-IL", { day: "numeric", month: "short" });

export interface Axis {
  points: { from: IsoDate; label: string; title: string }[];
  /** Indexes into `points` that get a label under the axis. */
  ticks: number[];
}

const MAX_TICKS = 7;

export function axisOf(range: DateRange, bucket: SeriesBucket): Axis {
  const wholeMonth = range.from.endsWith("-01") && addDays(range.to, 1).endsWith("-01") && monthOf(range.from) === monthOf(range.to);
  const points: Axis["points"] = [];
  for (let from = range.from; from <= range.to; ) {
    let to: IsoDate;
    if (bucket === "day") to = from;
    else if (bucket === "week") to = addDays(from, 6);
    else to = addDays(`${shiftMonth(monthOf(from), 1)}-01`, -1);
    if (to > range.to) to = range.to;
    const label =
      bucket === "month" ? formatMonthShort(monthOf(from)) : wholeMonth ? String(parseDate(from).getDate()) : dayMonth.format(parseDate(from));
    const title = bucket === "day" ? formatDayShort(from) : bucket === "month" ? formatMonth(monthOf(from)) : rangeLabel({ from, to });
    points.push({ from, label, title });
    from = addDays(to, 1);
  }
  const ticks = wholeMonth
    ? [0, 7, 14, 21, 28].filter((i) => i < points.length)
    : points.map((_, i) => i).filter((i) => i % Math.ceil(points.length / MAX_TICKS) === 0);
  return { points, ticks };
}
