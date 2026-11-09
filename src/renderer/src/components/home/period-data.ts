// Home's queries for the period channels (specs 16 and 22). Keys start with
// "summary:month" so refreshLedger (lib/hooks) refreshes them with every
// other money view after an edit or a sync.

import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "@shared/types";
import { call } from "@/lib/api";
import { essentialArg, type SpendingFilter } from "./spending-filter";

const key = (name: string, args: object) => ["summary:month", "period", name, args];

/** With a filter, every spending number is essentials or extras only (core filters). */
export const usePeriodSummary = (range: DateRange, filter: SpendingFilter = "all") => {
  const args = { ...range, ...essentialArg(filter) };
  return useQuery({ queryKey: key("summary", args), queryFn: () => call("summary:period", args), placeholderData: (p) => p });
};

export const usePeriodFlow = (range: DateRange) =>
  useQuery({ queryKey: key("flow", range), queryFn: () => call("summary:periodFlow", range), placeholderData: (p) => p });

export const useGroupFlow = (range: DateRange, categoryId: number | null) =>
  useQuery({
    queryKey: key("group", { ...range, categoryId }),
    queryFn: () => call("summary:groupFlow", { ...range, categoryId: categoryId as number }),
    enabled: categoryId !== null,
  });

/** No ids is all spending by category (split by tag under All); else one entry per id (null is uncategorized). */
export const usePeriodTrend = (range: DateRange, categoryIds: (number | null)[], filter: SpendingFilter = "all") => {
  const args = { ...range, ...essentialArg(filter), ...(categoryIds.length > 0 ? { categoryIds } : {}) };
  return useQuery({ queryKey: key("trend", args), queryFn: () => call("summary:periodTrend", args), placeholderData: (p) => p });
};

export const usePeriodCurves = (range: DateRange, categoryIds: (number | null)[], filter: SpendingFilter = "all") => {
  const args = { ...range, ...essentialArg(filter), categoryIds };
  return useQuery({
    queryKey: key("curves", args),
    queryFn: () => call("summary:periodCurves", args),
    enabled: categoryIds.length > 0,
    placeholderData: (p) => p,
  });
};

/** Money left this calendar month, whatever period Home shows. */
export const useThisMonth = () => useQuery({ queryKey: key("thisMonth", {}), queryFn: () => call("summary:thisMonth", undefined) });
