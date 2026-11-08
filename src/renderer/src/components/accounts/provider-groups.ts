// Which providers the Add picker offers and in what order, and which ones the
// Sync panel and Money accounts page show. Pure, so it is easy to test.

import { PROVIDERS, type ProviderId, type ProviderInfo } from "@shared/providers";
import type { Account, AccountKind } from "@shared/types";

export interface PickerGroup {
  kind: AccountKind;
  /** Verified first, then experimental, each in registry order. */
  providers: ProviderInfo[];
}

export interface PickerGroups {
  /** Banks, then cards. */
  groups: PickerGroup[];
  /** Shown only behind "Why isn't my bank here?". */
  unsupported: ProviderInfo[];
}

const RANK = { verified: 0, experimental: 1, unsupported: 2 } as const;
const KINDS: AccountKind[] = ["bank", "card"];

export function groupProviders(providers: readonly ProviderInfo[] = PROVIDERS): PickerGroups {
  const sorted = providers
    .map((p, i) => ({ p, i }))
    .sort((a, b) => RANK[a.p.status] - RANK[b.p.status] || a.i - b.i)
    .map(({ p }) => p);
  const usable = sorted.filter((p) => p.status !== "unsupported");
  return {
    groups: KINDS.map((kind) => ({ kind, providers: usable.filter((p) => p.kind === kind) })),
    unsupported: sorted.filter((p) => p.status === "unsupported"),
  };
}

/** Providers with money accounts or added by the user, in registry order. */
export function visibleProviders(
  accounts: readonly Account[] | undefined,
  added: readonly ProviderId[],
  providers: readonly ProviderInfo[] = PROVIDERS,
): ProviderId[] {
  const show = new Set<ProviderId>([...(accounts ?? []).map((a) => a.provider), ...added]);
  return providers.filter((p) => show.has(p.id)).map((p) => p.id);
}
