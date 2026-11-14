import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { CHANNELS } from "@shared/ipc";
import { ACCOUNT_VIEWS, BUDGET_VIEWS, CATEGORY_VIEWS, LEDGER_VIEWS, queryKey, refreshCategories, refreshLedger, refreshRules, RULE_VIEWS } from "./query-keys";

/** A client holding one fresh query per key; returns which ones a refresh made stale. */
async function staleAfter(refresh: (c: QueryClient) => Promise<void>, keys: unknown[][]): Promise<string[]> {
  const client = new QueryClient();
  for (const key of keys) client.setQueryData(key, 1);
  await refresh(client);
  return keys.filter((key) => client.getQueryState(key)?.isInvalidated).map((key) => String(key[0]));
}

describe("query keys", () => {
  it("start with the channel, then the args", () => {
    expect(queryKey("accounts:list")).toEqual(["accounts:list"]);
    expect(queryKey("summary:period", { from: "2026-11-01", to: "2026-11-30" })).toEqual([
      "summary:period",
      { from: "2026-11-01", to: "2026-11-30" },
    ]);
  });

  it("every refresh list names real channels", () => {
    for (const list of [LEDGER_VIEWS, RULE_VIEWS, CATEGORY_VIEWS, ACCOUNT_VIEWS, BUDGET_VIEWS]) {
      for (const channel of list) expect(CHANNELS).toContain(channel);
    }
  });

  it("a ledger edit refreshes money views, the money flow, category counts and the rules' counts", async () => {
    const stale = await staleAfter(refreshLedger, [
      queryKey("summary:periodFlow", { from: "2026-11-01", to: "2026-11-30" }),
      queryKey("summary:period", { from: "2026-11-01", to: "2026-11-30" }),
      queryKey("categories:list"),
      queryKey("rules:list"),
      ["rules:preview", { name: "x" }],
      queryKey("transactions:list", {}),
      queryKey("rules:knownPlaces"),
      queryKey("profiles:list"),
    ]);
    expect(stale).toEqual([
      "summary:periodFlow",
      "summary:period",
      "categories:list",
      "rules:list",
      "rules:preview",
      "transactions:list",
    ]);
  });

  it("rule and category changes also refresh known places", async () => {
    for (const refresh of [refreshRules, refreshCategories]) {
      expect(await staleAfter(refresh, [queryKey("rules:knownPlaces"), queryKey("app:info")])).toEqual(["rules:knownPlaces"]);
    }
  });
});
