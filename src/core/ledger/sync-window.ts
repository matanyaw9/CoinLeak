// Quick sync (spec 32, F82): after a provider's first full download, a sync
// asks only for the recent part, from the oldest last save of its syncing
// accounts minus 60 days.

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
 * The first day a quick sync asks for, or `null` when the sync must be full
 * (the provider has no syncing account saved here yet).
 *
 * It counts from each account's own last save, not the provider's last sync,
 * so nothing is skipped (review 2026-11-25): an account added back to
 * syncing after a gap, or a download that saved no accounts, pulls the start
 * back to the oldest save. The cost: an account the bank stopped reporting
 * keeps its old date, so the provider syncs further back until the user
 * removes that account from syncing. Slower, but never missing rows.
 */
export function quickSyncStart(db: Db, provider: ProviderId, today: IsoDate): IsoDate | null {
  if (!isIsoDate(today)) return null;
  const row = db
    .prepare(
      `SELECT MIN(last_synced_at) AS oldest FROM accounts
       WHERE provider = ? AND sync_enabled = 1 AND last_synced_at IS NOT NULL`,
    )
    .get(provider) as { oldest: string | null } | undefined;
  if (!row?.oldest) return null;
  const lastDay = israelToday(new Date(row.oldest));
  const from = lastDay < today ? lastDay : today;
  return toIsoDate(dayNumber(from) - QUICK_SYNC_DAYS);
}
