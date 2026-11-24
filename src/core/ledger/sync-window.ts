// Quick sync (spec 32, F82): after a provider's first full download, a sync
// asks only for the recent part, from the last successful sync minus 60 days.

import type { IsoDate, ProviderId } from "@shared/types";
import type { Db } from "../db";
import { dayNumber, isIsoDate, toIsoDate } from "./dates";
import { israelToday } from "./period";

/**
 * How far before the last sync a quick sync starts. Covers pending rows that
 * settle late (7 days), a card bill (one cycle) and installments (the library
 * dates each payment in its own month).
 */
export const QUICK_SYNC_DAYS = 60;

/**
 * The first day a quick sync asks for: the provider's last successful sync
 * day in this profile (never later than `today`) minus 60 days. `null` when
 * the provider never synced here, and the sync is then a full one.
 */
export function quickSyncStart(db: Db, provider: ProviderId, today: IsoDate): IsoDate | null {
  if (!isIsoDate(today)) return null;
  const row = db.prepare("SELECT MAX(synced_at) AS last FROM sync_runs WHERE provider = ?").get(provider) as
    | { last: string | null }
    | undefined;
  if (!row?.last) return null;
  const lastDay = israelToday(new Date(row.last));
  const from = lastDay < today ? lastDay : today;
  return toIsoDate(dayNumber(from) - QUICK_SYNC_DAYS);
}
