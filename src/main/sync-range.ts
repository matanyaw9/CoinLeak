// How far back a sync goes (spec 23): the start date handed to the library
// for the `syncFrom` setting, and per provider its limit and the first day
// the next sync asks for.

import { ENABLED_PROVIDERS } from "@shared/providers";
import type { IsoDate, SyncFrom, SyncRange } from "@shared/types";
import { addMonths, HISTORY } from "./sync/history";
import { israelDay } from "./sync/normalize";

/** "max" asks for all the library allows (no date); a day starts at 00:00 UTC, see `requestStart`. */
export function startDateFor(syncFrom: SyncFrom): Date | undefined {
  return syncFrom === "max" ? undefined : new Date(`${syncFrom}T00:00:00Z`);
}

export function syncRanges(syncFrom: SyncFrom, now: Date): SyncRange[] {
  const today = israelDay(now.toISOString());
  return ENABLED_PROVIDERS.map((provider) => {
    const earliest = HISTORY[provider].earliest(today);
    const from = syncFrom !== "max" && syncFrom > earliest ? syncFrom : earliest;
    return { provider, limitMonths: limitMonths(today, earliest), from };
  });
}

/** The whole months back from today that reach the library's earliest day (12 for "12 months less 2 days"). */
function limitMonths(today: IsoDate, earliest: IsoDate): number {
  let months = 1;
  while (addMonths(today, -months) > earliest) months++;
  return months;
}
