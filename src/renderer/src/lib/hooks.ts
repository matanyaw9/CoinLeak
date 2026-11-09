// Query hooks for the channels many screens read. Keys, and what to refresh
// after each kind of change, live in query-keys.ts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RuleInput, TransactionFilter, TransactionPatch } from "@shared/types";
import { call } from "./api";
import { queryKey, refreshLedger } from "./query-keys";

export const useAppInfo = () => useQuery({ queryKey: queryKey("app:info"), queryFn: () => call("app:info", undefined) });

export const useAccounts = () =>
  useQuery({ queryKey: queryKey("accounts:list"), queryFn: () => call("accounts:list", undefined) });

/** The profile's cash wallet, or null before the first cash row. */
export const useCashWallet = () => useQuery({ queryKey: queryKey("cash:wallet"), queryFn: () => call("cash:wallet", undefined) });

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
  useQuery({ queryKey: queryKey("categories:list"), queryFn: () => call("categories:list", undefined), staleTime: 5 * 60_000 });

export const useTransactions = (filter: TransactionFilter) =>
  useQuery({
    queryKey: queryKey("transactions:list", filter),
    queryFn: () => call("transactions:list", filter),
    placeholderData: (prev) => prev,
  });

export function useUpdateTransactions() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: { ids: number[]; patch: TransactionPatch }) => call("transactions:update", args),
    onSettled: () => refreshLedger(client),
  });
}

export const useRules = () => useQuery({ queryKey: queryKey("rules:list"), queryFn: () => call("rules:list", undefined) });

/** What a rule being edited would match today. Waits while `rule` is null. */
export const useRulePreview = (rule: RuleInput | null) =>
  useQuery({
    queryKey: ["rules:preview", rule],
    queryFn: () => call("rules:preview", rule as RuleInput),
    enabled: rule !== null,
    placeholderData: (prev) => prev,
    staleTime: 0,
  });
