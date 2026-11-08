// "synced today 09:14", "synced yesterday 18:02", "synced 3 Nov", "never
// synced": when a money account last synced, in local time.

import { s } from "@/strings";

const LOCALE = "en-IL";
const time = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false });
const dayMonth = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short" });
const dayMonthYear = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function syncedText(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return s.money.neverSynced;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return s.money.neverSynced;
  // Calendar days, not 24 hour blocks, so 23:50 last night reads "yesterday".
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return s.money.syncedToday(time.format(then));
  if (days === 1) return s.money.syncedYesterday(time.format(then));
  const date = then.getFullYear() === now.getFullYear() ? dayMonth.format(then) : dayMonthYear.format(then);
  return s.money.syncedOn(date);
}
