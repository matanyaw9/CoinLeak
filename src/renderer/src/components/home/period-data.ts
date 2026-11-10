// Home's queries for the period channels (specs 16 and 22). Each is keyed by
// its own channel (lib/query-keys), so a ledger change refreshes them all.

import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "@shared/types";
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
