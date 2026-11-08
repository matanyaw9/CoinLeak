import { describe, expect, it } from "vitest";
import { PROVIDERS, providerInfo } from "@shared/providers";
import type { Account } from "@shared/types";
import { groupProviders, removedAccounts, syncingAccounts, visibleProviders } from "./provider-groups";

const account = (provider: Account["provider"], id = 1): Account => ({
  id,
  provider,
  kind: "bank",
  accountNumber: "1234",
  name: null,
  cardMode: null,
  lastSyncedAt: null,
});

describe("groupProviders", () => {
  it("puts banks first, then cards, verified before experimental, unsupported hidden", () => {
    const { groups, unsupported } = groupProviders([
      providerInfo("max"),
      providerInfo("oneZero"),
      providerInfo("hapoalim"),
      providerInfo("visaCal"),
      providerInfo("discount"),
      providerInfo("leumi"),
    ]);
    expect(groups.map((g) => g.kind)).toEqual(["bank", "card"]);
    expect(groups[0]?.providers.map((p) => p.id)).toEqual(["discount", "hapoalim", "leumi"]);
    expect(groups[1]?.providers.map((p) => p.id)).toEqual(["visaCal", "max"]);
    expect(unsupported.map((p) => p.id)).toEqual(["oneZero"]);
  });

  it("covers the whole registry, each provider exactly once", () => {
    const { groups, unsupported } = groupProviders();
    const ids = [...groups.flatMap((g) => g.providers), ...unsupported].map((p) => p.id);
    expect([...ids].sort()).toEqual(PROVIDERS.map((p) => p.id).sort());
    expect(groups[0]?.providers[0]?.id).toBe("discount");
    expect(groups.flatMap((g) => g.providers).every((p) => p.status !== "unsupported")).toBe(true);
    expect(unsupported.every((p) => p.status === "unsupported" && !!p.reason)).toBe(true);
  });
});

describe("visibleProviders", () => {
  it("shows providers with accounts or added by the user, in registry order, once each", () => {
    const accounts = [account("visaCal", 1), account("visaCal", 2), account("discount", 3)];
    expect(visibleProviders(accounts, ["max", "discount"])).toEqual(["discount", "visaCal", "max"]);
  });

  it("is empty before anything is synced or added", () => {
    expect(visibleProviders(undefined, [])).toEqual([]);
  });

  it("leaves out providers whose every account was removed from syncing, and brings them back", () => {
    const removed = { ...account("visaCal", 2), syncEnabled: false };
    const accounts = [{ ...account("discount", 1), syncEnabled: true }, removed];
    expect(visibleProviders(accounts, [])).toEqual(["discount"]);
    expect(syncingAccounts(accounts).map((a) => a.id)).toEqual([1]);
    expect(removedAccounts(accounts).map((a) => a.id)).toEqual([2]);
    const back = [accounts[0] as Account, { ...removed, syncEnabled: true }];
    expect(visibleProviders(back, [])).toEqual(["discount", "visaCal"]);
    expect(removedAccounts(back)).toEqual([]);
  });

  it("keeps a provider with one account still syncing", () => {
    const accounts = [account("visaCal", 1), { ...account("visaCal", 2), syncEnabled: false }];
    expect(visibleProviders(accounts, [])).toEqual(["visaCal"]);
  });
});
