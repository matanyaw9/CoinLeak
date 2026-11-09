// How far back a sync goes (spec 23): the saved choice, each provider's
// range from main, and the words for them. Main does the date math.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { IsoDate, ProviderId, SyncFrom, SyncRange } from "@shared/types";
import { call } from "@/lib/api";
import { parseDate } from "@/lib/month";

const SYNC_FROM_KEY = ["settings:get", { key: "syncFrom" }];
const RANGES_KEY = ["sync:ranges"];

export const useSyncRanges = () => useQuery({ queryKey: RANGES_KEY, queryFn: () => call("sync:ranges", undefined) });

export const useSyncFrom = () =>
  useQuery({
    queryKey: SYNC_FROM_KEY,
    // The settings channel is typed for every key; this one is always "max" or a day.
    queryFn: async () => (await call("settings:get", { key: "syncFrom" })) as SyncFrom,
  });

/** Saves the choice, then refreshes it and the ranges. */
export function useSaveSyncFrom(): (value: SyncFrom) => Promise<void> {
  const client = useQueryClient();
  return async (value) => {
    await call("settings:set", { key: "syncFrom", value });
    await Promise.all([
      client.invalidateQueries({ queryKey: SYNC_FROM_KEY }),
      client.invalidateQueries({ queryKey: RANGES_KEY }),
    ]);
  };
}

/** The first day one provider's next sync asks for, or null while loading. */
export function useSyncStart(provider: ProviderId): IsoDate | null {
  return useSyncRanges().data?.find((r) => r.provider === provider)?.from ?? null;
}

const dayWithYear = new Intl.DateTimeFormat("en-IL", { day: "numeric", month: "short", year: "numeric" });

/** "1 Jan 2026". */
export const formatRangeDay = (day: IsoDate): string => dayWithYear.format(parseDate(day));

export interface LimitGroup {
  months: number;
  providers: ProviderId[];
}

/** Providers grouped by how far back each goes, shortest first, keeping the given order inside a group. */
export function groupLimits(ranges: readonly SyncRange[], shown: readonly ProviderId[]): LimitGroup[] {
  const groups = new Map<number, ProviderId[]>();
  for (const provider of shown) {
    const range = ranges.find((r) => r.provider === provider);
    if (!range) continue;
    groups.set(range.limitMonths, [...(groups.get(range.limitMonths) ?? []), provider]);
  }
  return [...groups].sort((a, b) => a[0] - b[0]).map(([months, providers]) => ({ months, providers }));
}
