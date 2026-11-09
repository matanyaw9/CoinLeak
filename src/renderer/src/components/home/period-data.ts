// Home's queries for the period channels (spec 16). Keys start with
// "summary:month" so refreshLedger (lib/hooks) refreshes them with every
// other money view after an edit or a sync.

import { useQuery } from "@tanstack/react-query";
import type { DateRange } from "@shared/types";
import { call } from "@/lib/api";

const key = (name: string, args: object) => ["summary:month", "period", name, args];

export const usePeriodSummary = (range: DateRange) =>
  useQuery({ queryKey: key("summary", range), queryFn: () => call("summary:period", range), placeholderData: (p) => p });

export const usePeriodFlow = (range: DateRange) =>
  useQuery({ queryKey: key("flow", range), queryFn: () => call("summary:periodFlow", range), placeholderData: (p) => p });

export const useGroupFlow = (range: DateRange, categoryId: number | null) =>
  useQuery({
    queryKey: key("group", { ...range, categoryId }),
    queryFn: () => call("summary:groupFlow", { ...range, categoryId: categoryId as number }),
    enabled: categoryId !== null,
  });

/** `categoryId` undefined is all spending; null is uncategorized. */
export const usePeriodTrend = (range: DateRange, categoryId: number | null | undefined) =>
  useQuery({
    queryKey: key("trend", { ...range, categoryId }),
    queryFn: () => call("summary:periodTrend", categoryId === undefined ? range : { ...range, categoryId }),
    placeholderData: (p) => p,
  });

export const usePeriodCurves = (range: DateRange, categoryIds: (number | null)[]) =>
  useQuery({
    queryKey: key("curves", { ...range, categoryIds }),
    queryFn: () => call("summary:periodCurves", { ...range, categoryIds }),
    enabled: categoryIds.length > 0,
    placeholderData: (p) => p,
  });
