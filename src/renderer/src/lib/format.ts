// Display formatting for the window: money through the shared formatIls,
// dates in the Israeli day-month order. No money logic lives here.

import type { Agorot, IsoDate, IsoMonth } from "@shared/types";
import { formatIls } from "@shared/money";
import { s } from "@/strings";
import { parseDate, parseMonth } from "./month";

const BIDI_MARKS = /[‎‏]/g;

/**
 * formatIls speaks Hebrew number style, which wraps the text in bidi marks.
 * The English window is left to right, so the marks only nudge spacing.
 */
export function ils(amount: Agorot, opts: { sign?: boolean; decimals?: boolean } = {}): string {
  return formatIls(amount, opts).replace(BIDI_MARKS, "");
}

const LOCALE = "en-IL";

const monthLong = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric" });
const monthName = new Intl.DateTimeFormat(LOCALE, { month: "long" });
const monthShort = new Intl.DateTimeFormat(LOCALE, { month: "short" });
const dayLong = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long" });
const dayShort = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long" });
const dayNumeric = new Intl.DateTimeFormat(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric" });
const time = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });

const monthDate = (m: IsoMonth) => {
  const { year, month } = parseMonth(m);
  return new Date(year, month - 1, 1);
};

/** "November 2026" */
export const formatMonth = (m: IsoMonth) => monthLong.format(monthDate(m));
/** "November" */
export const formatMonthName = (m: IsoMonth) => monthName.format(monthDate(m));
/** "Nov" */
export const formatMonthShort = (m: IsoMonth) => monthShort.format(monthDate(m));
/** "Saturday, 7 November" */
export const formatDayLong = (d: IsoDate) => dayLong.format(parseDate(d));
/** "7 November" */
export const formatDayShort = (d: IsoDate) => dayShort.format(parseDate(d));
/** "07/11/2026" */
export const formatDateNumeric = (d: IsoDate) => dayNumeric.format(parseDate(d));

/** "2 hours ago", "yesterday", or a date for anything older than a week. */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const mins = Math.round((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return s.time.justNow;
  if (mins < 60) return s.time.minutes(mins);
  const hours = Math.round(mins / 60);
  if (hours < 24 && then.getDate() === now.getDate()) return s.time.hours(hours);
  const days = Math.round(hours / 24);
  if (days <= 1) return s.time.yesterday(time.format(then));
  if (days < 7) return s.time.days(days);
  return dayNumeric.format(then);
}

/** A foreign charge in its own currency, e.g. "$12.99". Minor units in. */
export function formatForeign(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: "currency", currency, currencyDisplay: "narrowSymbol" }).format(Math.abs(amount) / 100);
  } catch {
    return `${(Math.abs(amount) / 100).toFixed(2)} ${currency}`;
  }
}

/** Share of a total as a whole percent, for legends. */
export function percent(part: number, total: number): string {
  if (total <= 0) return "0%";
  const p = (part / total) * 100;
  return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
}
