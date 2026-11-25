// Home's queries for the period channels (specs 16 and 22). Each is keyed by
// its own channel (lib/query-keys), so a ledger change refreshes them all.

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppSettings, DateRange, HomeCurveCompare, SettingEntry } from "@shared/types";
import { call } from "@/lib/api";
import { queryKey } from "@/lib/query-keys";

export const usePeriodSummary = (range: DateRange) =>
  useQuery({ queryKey: queryKey("summary:period", range), queryFn: () => call("summary:period", range), placeholderData: (p) => p });

export const usePeriodFlow = (range: DateRange) =>
  useQuery({ queryKey: queryKey("summary:periodFlow", range), queryFn: () => call("summary:periodFlow", range), placeholderData: (p) => p });

export const useGroupFlow = (range: DateRange, categoryId: number | null) =>
  useQuery({
    queryKey: queryKey("summary:groupFlow", { ...range, categoryId: categoryId as number }),
    queryFn: () => call("summary:groupFlow", { ...range, categoryId: categoryId as number }),
    enabled: categoryId !== null,
  });

/** No ids is all spending by category; else one entry per id (null is uncategorized). */
export const usePeriodTrend = (range: DateRange, categoryIds: (number | null)[]) => {
  const args = { ...range, ...(categoryIds.length > 0 ? { categoryIds } : {}) };
  return useQuery({ queryKey: queryKey("summary:periodTrend", args), queryFn: () => call("summary:periodTrend", args), placeholderData: (p) => p });
};

export const usePeriodCurves = (range: DateRange, categoryIds: (number | null)[]) => {
  const args = { ...range, categoryIds };
  return useQuery({
    queryKey: queryKey("summary:periodCurves", args),
    queryFn: () => call("summary:periodCurves", args),
    enabled: categoryIds.length > 0,
    placeholderData: (p) => p,
  });
};

/** spec 30: income minus spending per month, for the months the month-by-month bars show. */
export const useMonthlyNet = (range: DateRange) =>
  useQuery({ queryKey: queryKey("summary:monthlyNet", range), queryFn: () => call("summary:monthlyNet", range), placeholderData: (p) => p });

/** Money left this calendar month, whatever period Home shows. */
export const useThisMonth = () =>
  useQuery({ queryKey: queryKey("summary:thisMonth"), queryFn: () => call("summary:thisMonth", undefined) });

/**
 * A Home choice kept per profile in a setting (spec 26).
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
