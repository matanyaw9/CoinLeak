// How far back a sync goes: the start date handed to the library for the
// `syncFrom` setting (spec 23), quick or full (spec 32), and per provider its
// limit and the first day the next sync asks for.

import { CodedError } from "@shared/errors";
import { ENABLED_PROVIDERS, type EnabledProviderId } from "@shared/providers";
import type { IsoDate, SyncFrom, SyncRange, SyncScope } from "@shared/types";
import type { Db } from "@core/db";
import { quickSyncStart } from "@core/ledger";
import { getSetting } from "@core/settings";
import { addMonths, HISTORY } from "./sync/history";
import { israelDay } from "./sync/normalize";

/** "max" asks for all the library allows (no date); a day starts at 00:00 UTC, see `requestStart`. */
export function startDateFor(syncFrom: SyncFrom): Date | undefined {
  return syncFrom === "max" ? undefined : new Date(`${syncFrom}T00:00:00Z`);
}

export interface SyncPlan {
  /** For the library. Undefined asks for all it allows. */
  startDate: Date | undefined;
  /** What the sync really does: a quick sync with no earlier sync is a full one. */
  scope: SyncScope;
}

/**
 * The start date for one sync. Full (or quick with no earlier sync here):
 * the `syncFrom` setting, else all the bank allows. Quick: the later of
 * the last sync minus 60 days and `syncFrom`.
 */
export function planSync(db: Db, provider: EnabledProviderId, mode: unknown, now: Date): SyncPlan {
  if (mode !== "quick" && mode !== "full") throw new CodedError("BAD_REQUEST");
  const syncFrom = getSetting(db, "syncFrom");
  const today = israelDay(now.toISOString());
  const quick = mode === "quick" ? quickSyncStart(db, provider, today) : null;
  if (quick === null) {
    const from = syncFrom === "max" ? null : laterDay(syncFrom, HISTORY[provider].earliest(today));
    return { startDate: startDateFor(syncFrom), scope: { mode: "full", months: null, from } };
  }
  const from = syncFrom === "max" ? quick : laterDay(syncFrom, quick);
  return {
    startDate: new Date(`${from}T00:00:00Z`),
    scope: { mode: "quick", months: monthsBack(today, from), from },
  };
}

export function syncRanges(db: Db, now: Date): SyncRange[] {
  const syncFrom = getSetting(db, "syncFrom");
  const today = israelDay(now.toISOString());
  return ENABLED_PROVIDERS.map((provider) => {
    const earliest = HISTORY[provider].earliest(today);
    const from = syncFrom !== "max" && syncFrom > earliest ? syncFrom : earliest;
    const { scope } = planSync(db, provider, "quick", now);
    const quickFrom = scope.mode === "quick" ? scope.from : null;
    return { provider, limitMonths: limitMonths(today, earliest), from, quickFrom };
  });
}

/** The whole months back from today that reach the library's earliest day (12 for "12 months less 2 days"). */
function limitMonths(today: IsoDate, earliest: IsoDate): number {
  let months = 1;
  while (addMonths(today, -months) > earliest) months++;
  return months;
}

/** About how many months from `from` to today, at least 1: 60 days is 2. */
function monthsBack(today: IsoDate, from: IsoDate): number {
  const days = (Date.parse(today) - Date.parse(from)) / 86_400_000;
  return Math.max(1, Math.round(days / 30));
}

function laterDay(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b;
}
