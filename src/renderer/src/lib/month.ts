// Calendar helpers for the month picker and date ranges. Months are
// `YYYY-MM`, days are `YYYY-MM-DD`, always in local (Israel) time.

import type { IsoDate, IsoMonth } from "@shared/types";

const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDate(d: Date): IsoDate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toIsoMonth(d: Date): IsoMonth {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function parseMonth(month: IsoMonth): { year: number; month: number } {
  const [y, m] = month.split("-").map(Number);
  return { year: y ?? 1970, month: m ?? 1 };
}

/** Local Date for a `YYYY-MM-DD` string, at midnight. */
export function parseDate(date: IsoDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function shiftMonth(month: IsoMonth, delta: number): IsoMonth {
  const { year, month: m } = parseMonth(month);
  return toIsoMonth(new Date(year, m - 1 + delta, 1));
}

export function daysInMonth(month: IsoMonth): number {
  const { year, month: m } = parseMonth(month);
  return new Date(year, m, 0).getDate();
}

export function monthRange(month: IsoMonth): { from: IsoDate; to: IsoDate } {
  return { from: `${month}-01`, to: `${month}-${pad(daysInMonth(month))}` };
}

export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

/** The picker never goes past the current month: the future has no data. */
export function canGoNext(month: IsoMonth, current: IsoMonth): boolean {
  return month < current;
}

export function stepMonth(month: IsoMonth, delta: -1 | 1, current: IsoMonth): IsoMonth {
  const next = shiftMonth(month, delta);
  return next > current ? current : next;
}

/** Which way a key press moves the month picker, or null to ignore it. */
export function monthKeyDelta(e: {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
}): -1 | 1 | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  if (isTypingTarget(e.target ?? null)) return null;
  if (e.key === "ArrowLeft") return -1;
  if (e.key === "ArrowRight") return 1;
  return null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean; getAttribute?: (n: string) => string | null };
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  const role = el.getAttribute?.("role");
  return role === "slider" || role === "radio" || role === "tab" || role === "listbox" || role === "option";
}

/** The Today button shows only when another month is on screen. */
export function showToday(month: IsoMonth, current: IsoMonth): boolean {
  return month !== current;
}

// ---- Periods (spec 16) ----

/** How the period was chosen in the top bar. */
export type PeriodKind = "month" | "last7" | "last30" | "last12" | "year" | "custom";

/** Everything the picker remembers; `kind` says which part is on screen. */
export interface PeriodChoice {
  kind: PeriodKind;
  month: IsoMonth;
  year: number;
  custom: { from: IsoDate; to: IsoDate };
}

export const PERIOD_KINDS: PeriodKind[] = ["month", "last7", "last30", "last12", "year", "custom"];

export function addDays(date: IsoDate, n: number): IsoDate {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/** The days the period covers, both ends included. Rolling periods end today. */
export function periodRange(choice: PeriodChoice, today: IsoDate): { from: IsoDate; to: IsoDate } {
  switch (choice.kind) {
    case "month":
      return monthRange(choice.month);
    case "last7":
      return { from: addDays(today, -6), to: today };
    case "last30":
      return { from: addDays(today, -29), to: today };
    case "last12": {
      const now = monthOf(today);
      return { from: `${shiftMonth(now, -11)}-01`, to: monthRange(now).to };
    }
    case "year":
      return { from: `${choice.year}-01-01`, to: `${choice.year}-12-31` };
    case "custom":
      return choice.custom;
  }
}

/** Why custom days cannot be shown, or null when they can. Never swaps them. */
export function customDaysProblem(from: string, to: string): "missing" | "fromAfterTo" | null {
  if (!from || !to) return "missing";
  if (from > to) return "fromAfterTo";
  return null;
}

/** Arrows step a month or a year; other periods have none. */
export function canStep(kind: PeriodKind): boolean {
  return kind === "month" || kind === "year";
}

/** One month or year back or forward, never past the current one. */
export function stepPeriod(choice: PeriodChoice, delta: -1 | 1, current: IsoMonth): PeriodChoice {
  if (choice.kind === "month") return { ...choice, month: stepMonth(choice.month, delta, current) };
  if (choice.kind === "year") return { ...choice, year: Math.min(choice.year + delta, parseMonth(current).year) };
  return choice;
}

export function canStepNext(choice: PeriodChoice, current: IsoMonth): boolean {
  if (choice.kind === "month") return canGoNext(choice.month, current);
  if (choice.kind === "year") return choice.year < parseMonth(current).year;
  return false;
}

/** Today shows when a past month or year is on screen. */
export function periodShowsToday(choice: PeriodChoice, current: IsoMonth): boolean {
  if (choice.kind === "month") return showToday(choice.month, current);
  if (choice.kind === "year") return choice.year !== parseMonth(current).year;
  return false;
}

/** The period that brings today back: this month, or this year when years are on screen. */
export function periodToday(choice: PeriodChoice, current: IsoMonth): PeriodChoice {
  if (choice.kind === "year") return { ...choice, year: parseMonth(current).year };
  return { ...choice, kind: "month", month: current };
}

/** Whether today falls inside the range, so "so far" wording fits. */
export function isOngoing(range: { from: IsoDate; to: IsoDate }, today: IsoDate): boolean {
  return range.from <= today && today <= range.to;
}
