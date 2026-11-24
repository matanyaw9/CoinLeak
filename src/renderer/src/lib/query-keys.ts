// Every query key the window uses, and what to refresh after each kind of
// change. A key is always the channel name, then its args, so refreshing a
// channel refreshes every question asked of it.

import type { QueryClient } from "@tanstack/react-query";
import type { Args, Channel } from "@shared/ipc";

export const queryKey = <C extends Channel>(channel: C, args?: Args<C>): unknown[] =>
  args === undefined ? [channel] : [channel, args];

/**
 * A row changed (edit, sync, trash, cash, card bill): every money view, plus
 * the views that count rows: categories (row counts), rules ("Also fits N",
 * the preview, starter lists), the cash wallet, and the money accounts
 * with their balance checks.
 */
export const LEDGER_VIEWS: Channel[] = [
  "transactions:list",
  "summary:period",
  "summary:periodFlow",
  "summary:groupFlow",
  "summary:periodTrend",
  "summary:periodCurves",
  "summary:thisMonth",
  "summary:monthlyNet",
  "categories:list",
  "rules:list",
  "rules:preview",
  "rules:starters",
  "cash:wallet",
  "accounts:list",
  "accounts:balanceChecks",
  "budgets:status",
  // spec 33: purchases a pay-back may point at
  "transactions:paidBackCandidates",
];

/** A rule changed: every rule is reapplied to every row, so the ledger views too. */
export const RULE_VIEWS: Channel[] = ["rules:knownPlaces", ...LEDGER_VIEWS];

/** A category changed: moving or deleting one moves rows and rules. */
export const CATEGORY_VIEWS: Channel[] = RULE_VIEWS;

/** A money account was removed from syncing or added back: rows stay and count. */
export const ACCOUNT_VIEWS: Channel[] = ["accounts:list", "accounts:balanceChecks", "cash:wallet"];

function refresh(client: QueryClient, channels: Channel[]): Promise<void> {
  return Promise.all(channels.map((c) => client.invalidateQueries({ queryKey: [c] }))).then(() => undefined);
}

export const refreshLedger = (client: QueryClient) => refresh(client, LEDGER_VIEWS);
export const refreshRules = (client: QueryClient) => refresh(client, RULE_VIEWS);
export const refreshCategories = (client: QueryClient) => refresh(client, CATEGORY_VIEWS);
export const refreshAccounts = (client: QueryClient) => refresh(client, ACCOUNT_VIEWS);

/** spec 27: a budget was set or cleared. Only the budget views read it. */
export const BUDGET_VIEWS: Channel[] = ["budgets:status"];
export const refreshBudgets = (client: QueryClient) => refresh(client, BUDGET_VIEWS);
