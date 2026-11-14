// Home's queries for the period channels (specs 16 and 22). Each is keyed by
// its own channel (lib/query-keys), so a ledger change refreshes them all.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppSettings, DateRange, HomeCurveCompare, SettingEntry } from "@shared/types";
import { call } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";
import { essentialArg, type SpendingFilter } from "./spending-filter";

/** With a filter, every spending number is essentials or extras only (core filters). */
export const usePeriodSummary = (range: DateRange, filter: SpendingFilter = "all") => {
  const args = { ...range, ...essentialArg(filter) };
  return useQuery({ queryKey: queryKey("summary:period", args), queryFn: () => call("summary:period", args), placeholderData: (p) => p });
};

export const usePeriodFlow = (range: DateRange) =>
  useQuery({ queryKey: queryKey("summary:periodFlow", range), queryFn: () => call("summary:periodFlow", range), placeholderData: (p) => p });

export const useGroupFlow = (range: DateRange, categoryId: number | null) =>
  useQuery({
    queryKey: queryKey("summary:groupFlow", { ...range, categoryId: categoryId as number }),
    queryFn: () => call("summary:groupFlow", { ...range, categoryId: categoryId as number }),
    enabled: categoryId !== null,
  });

/** The trend card can also show only the spending that is neither essential nor extra. */
export type TrendFilter = SpendingFilter | "untagged";

/** No ids is all spending by category (split by tag under All); else one entry per id (null is uncategorized). */
export const usePeriodTrend = (range: DateRange, categoryIds: (number | null)[], filter: TrendFilter = "all") => {
  const tag = filter === "untagged" ? { essential: null } : essentialArg(filter);
  const args = { ...range, ...tag, ...(categoryIds.length > 0 ? { categoryIds } : {}) };
  return useQuery({ queryKey: queryKey("summary:periodTrend", args), queryFn: () => call("summary:periodTrend", args), placeholderData: (p) => p });
};

export const usePeriodCurves = (range: DateRange, categoryIds: (number | null)[], filter: SpendingFilter = "all") => {
  const args = { ...range, ...essentialArg(filter), categoryIds };
  return useQuery({
    queryKey: queryKey("summary:periodCurves", args),
    queryFn: () => call("summary:periodCurves", args),
    enabled: categoryIds.length > 0,
    placeholderData: (p) => p,
  });
};

/** Money left this calendar month, whatever period Home shows. */
export const useThisMonth = () =>
  useQuery({ queryKey: queryKey("summary:thisMonth"), queryFn: () => call("summary:thisMonth", undefined) });

/**
 * A Home choice kept per profile in a setting (spec 26), like Home's filter.
 * `initial` (demo screenshots) wins over the saved value and is not saved.
 */
function useRemembered<K extends "homeCurveCompare" | "homeCurveCategories">(
  key: K,
  fallback: AppSettings[K],
  initial?: AppSettings[K],
): [AppSettings[K], (value: AppSettings[K]) => void] {
  const client = useQueryClient();
  const settingKey = queryKey("settings:get", { key });
  const [picked, setPicked] = useState<AppSettings[K] | undefined>(initial);
  const saved = useQuery({
    queryKey: settingKey,
    queryFn: async () => (await call("settings:get", { key })) as AppSettings[K],
    staleTime: Infinity,
  });
  const set = (value: AppSettings[K]) => {
    // Both curve cards read the cache, so they always agree.
    setPicked(undefined);
    client.setQueryData(settingKey, value);
    // Remembering is a convenience: if saving fails, the choice still shows now.
    call("settings:set", { key, value } as SettingEntry).catch(() => undefined);
  };
  return [picked ?? saved.data ?? fallback, set];
}

/** What the month curves compare with: last month (the default) or the average month. */
export const useCurveCompare = (initial?: HomeCurveCompare) => useRemembered("homeCurveCompare", "previous", initial);

/** The categories the category curves draw; empty is the top 5. */
export const useCurveCategories = (initial?: (number | null)[]) => useRemembered("homeCurveCategories", [], initial);

/** Demo screenshots: `?shot=curve-average`, `curves-average` and `curves-chosen` start on the average month. */
export function shotCompare(shot: string | null): HomeCurveCompare | undefined {
  return shot === "curve-average" || shot === "curves-average" || shot === "curves-chosen" ? "average" : undefined;
}
