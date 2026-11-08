// One TanStack Query hook per channel. Components read data only through
// these, so caching and refreshing after a change live in one place.

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { IsoMonth, RuleInput, TransactionFilter, TransactionPatch } from "@shared/types";
import type { Args, Channel } from "@shared/ipc";
import { call } from "./api";

const key = <C extends Channel>(channel: C, args?: Args<C>) => (args === undefined ? [channel] : [channel, args]);

export const useAppInfo = () => useQuery({ queryKey: key("app:info"), queryFn: () => call("app:info", undefined) });

export const useAccounts = () =>
  useQuery({ queryKey: key("accounts:list"), queryFn: () => call("accounts:list", undefined) });

/**
 * True when no account has been synced yet, so screens greet instead of
 * charting nothing. Undefined while it is still loading.
 */
export function useFirstRun(): boolean | undefined {
  const accounts = useAccounts();
  if (accounts.isError) return false;
  return accounts.data ? accounts.data.length === 0 : undefined;
}

export const useCategories = () =>
  useQuery({ queryKey: key("categories:list"), queryFn: () => call("categories:list", undefined), staleTime: 5 * 60_000 });

export const useTransactions = (filter: TransactionFilter) =>
  useQuery({
    queryKey: key("transactions:list", filter),
    queryFn: () => call("transactions:list", filter),
    placeholderData: (prev) => prev,
  });

export const useMonthSummary = (month: IsoMonth) =>
  useQuery({ queryKey: key("summary:month", { month }), queryFn: () => call("summary:month", { month }) });

export const useTrend = (months: number) =>
  useQuery({ queryKey: key("summary:trend", { months }), queryFn: () => call("summary:trend", { months }) });

/** Everything that shows money, refreshed after an edit or a sync. */
export function refreshLedger(client: QueryClient): Promise<void> {
  const channels: Channel[] = ["transactions:list", "summary:month", "summary:trend", "summary:curves", "accounts:list"];
  return Promise.all(channels.map((c) => client.invalidateQueries({ queryKey: [c] }))).then(() => undefined);
}

export function useUpdateTransactions() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: { ids: number[]; patch: TransactionPatch }) => call("transactions:update", args),
    onSettled: () => refreshLedger(client),
  });
}

export const useRules = () => useQuery({ queryKey: key("rules:list"), queryFn: () => call("rules:list", undefined) });

/** What a rule being edited would match today. Waits while `rule` is null. */
export const useRulePreview = (rule: RuleInput | null) =>
  useQuery({
    queryKey: ["rules:preview", rule],
    queryFn: () => call("rules:preview", rule as RuleInput),
    enabled: rule !== null,
    placeholderData: (prev) => prev,
    staleTime: 0,
  });

/** Every rule change reapplies the rules to all rows, so money views refresh too. */
export function refreshRules(client: QueryClient): Promise<void> {
  return Promise.all([
    client.invalidateQueries({ queryKey: ["rules:list"] }),
    client.invalidateQueries({ queryKey: ["rules:preview"] }),
    refreshLedger(client),
  ]).then(() => undefined);
}
