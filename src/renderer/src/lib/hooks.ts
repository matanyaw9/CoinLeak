// Query hooks for the channels many screens read. Keys, and what to refresh
// after each kind of change, live in query-keys.ts.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Agorot, IsoMonth, RuleInput, TransactionFilter, TransactionPatch } from "@shared/types";
import { call } from "./api";
import { queryKey, refreshBudgets, refreshLedger } from "./query-keys";

export const useAppInfo = () => useQuery({ queryKey: queryKey("app:info"), queryFn: () => call("app:info", undefined) });

export const useAccounts = () =>
  useQuery({ queryKey: queryKey("accounts:list"), queryFn: () => call("accounts:list", undefined) });

/** The profile's cash wallet, or null before the first cash row. */
export const useCashWallet = () => useQuery({ queryKey: queryKey("cash:wallet"), queryFn: () => call("cash:wallet", undefined) });

/**
 * True when there is no money account and no cash wallet yet, so screens
 * greet instead of charting nothing. Undefined while either is loading.
 */
export function useFirstRun(): boolean | undefined {
  const accounts = useAccounts();
  const wallet = useCashWallet();
  return firstRun(accounts, wallet);
}

/** The rule behind `useFirstRun`: a failed read never shows the greeting. */
export function firstRun(
  accounts: { data?: unknown[]; isError: boolean },
  wallet: { data?: unknown; isError: boolean },
): boolean | undefined {
  if (accounts.isError || wallet.isError) return false;
  if (accounts.data && accounts.data.length > 0) return false;
  if (wallet.data) return false;
  if (!accounts.data || wallet.data === undefined) return undefined;
  return true;
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

/** spec 27: every budgeted category's spending in the month and its week. */
export const useBudgetStatus = (month: IsoMonth) =>
  useQuery({
    queryKey: queryKey("budgets:status", { month }),
    queryFn: () => call("budgets:status", { month }),
    placeholderData: (prev) => prev,
  });

/** Sets (agorot) or clears (null) a category's monthly budget, then refreshes Home's card. */
export function useSetBudget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: { categoryId: number; monthlyBudget: Agorot | null }) => call("budgets:set", args),
    onSettled: () => refreshBudgets(client),
  });
}

/** What a rule being edited would match today. Waits while `rule` is null. */
export const useRulePreview = (rule: RuleInput | null) =>
  useQuery({
    queryKey: ["rules:preview", rule],
    queryFn: () => call("rules:preview", rule as RuleInput),
    enabled: rule !== null,
    placeholderData: (prev) => prev,
    staleTime: 0,
  });
