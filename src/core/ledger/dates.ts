// Calendar helpers for `YYYY-MM-DD` days and `YYYY-MM` months. Pure string
// and day-number math in UTC, so no local time zone can shift a day.

import { CodedError } from "@shared/errors";
import type { IsoDate, IsoMonth } from "@shared/types";

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === "string" && DATE_RE.test(value) && toIsoDate(dayNumber(value)) === value;
}

export function assertMonth(value: unknown): asserts value is IsoMonth {
  if (typeof value !== "string" || !MONTH_RE.test(value)) throw new CodedError("BAD_REQUEST");
}

/** Days since 1970-01-01 for a `YYYY-MM-DD` string. */
export function dayNumber(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function toIsoDate(day: number): IsoDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function daysApart(a: IsoDate, b: IsoDate): number {
  return Math.abs(dayNumber(a) - dayNumber(b));
}

export function addMonths(month: IsoMonth, n: number): IsoMonth {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const index = y * 12 + (m - 1) + n;
  return `${String(Math.floor(index / 12)).padStart(4, "0")}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** First day of the month and first day of the next month (exclusive end). */
export function monthBounds(month: IsoMonth): { from: IsoDate; until: IsoDate } {
  return { from: `${month}-01`, until: `${addMonths(month, 1)}-01` };
}

export function daysOfMonth(month: IsoMonth): IsoDate[] {
  const { from, until } = monthBounds(month);
  const days: IsoDate[] = [];
  for (let d = dayNumber(from); d < dayNumber(until); d++) days.push(toIsoDate(d));
  return days;
}

/** The calendar month of an instant, in Israel time. */
export function israelMonth(now: Date): IsoMonth {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}
