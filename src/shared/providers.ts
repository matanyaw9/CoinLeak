// The provider registry: every bank and card company israeli-bank-scrapers
// 6.12.2 supports, how CoinLeak shows it, and whether self-login works for it.
// Why each one has its status: docs/banks/<id>.md and docs/specs/08-all-providers.md.

import type { AccountKind } from "./types";

/**
 * - verified: the owner synced a real account end to end.
 * - experimental: self-login is built from the library's own code and
 *   tested against fake pages, not yet confirmed with a real account.
 * - unsupported: logging in would need the password inside CoinLeak.
 */
export type ProviderStatus = "verified" | "experimental" | "unsupported";

interface ProviderEntry {
  /** English display name. */
  readonly name: string;
  /** Short name for chips and toasts. */
  readonly short: string;
  readonly kind: AccountKind;
  readonly status: ProviderStatus;
  /** The host of the login page the user types into, to recognize the real site. */
  readonly site: string;
  /** Unsupported only: why, in one short user-facing sentence. */
  readonly reason?: string;
}

// Display order inside each status group: the most used first.
const REGISTRY = {
  discount: {
    name: "Discount Bank",
    short: "Discount",
    kind: "bank",
    status: "verified",
    site: "start.telebank.co.il",
  },
  visaCal: { name: "Cal", short: "Cal", kind: "card", status: "verified", site: "www.cal-online.co.il" },
  hapoalim: {
    name: "Bank Hapoalim",
    short: "Hapoalim",
    kind: "bank",
    status: "experimental",
    site: "login.bankhapoalim.co.il",
  },
  leumi: { name: "Bank Leumi", short: "Leumi", kind: "bank", status: "experimental", site: "hb2.bankleumi.co.il" },
  mizrahi: {
    name: "Mizrahi Tefahot",
    short: "Mizrahi",
    kind: "bank",
    status: "experimental",
    site: "www.mizrahi-tefahot.co.il",
  },
  beinleumi: {
    name: "First International (Beinleumi)",
    short: "Beinleumi",
    kind: "bank",
    status: "experimental",
    site: "online.fibi.co.il",
  },
  mercantile: {
    name: "Mercantile Bank",
    short: "Mercantile",
    kind: "bank",
    status: "experimental",
    site: "start.telebank.co.il",
  },
  yahav: { name: "Bank Yahav", short: "Yahav", kind: "bank", status: "experimental", site: "login.yahav.co.il" },
  massad: { name: "Bank Massad", short: "Massad", kind: "bank", status: "experimental", site: "online.bankmassad.co.il" },
  otsarHahayal: {
    name: "Otsar Ha-Hayal",
    short: "Otsar Ha-Hayal",
    kind: "bank",
    status: "experimental",
    site: "online.bankotsar.co.il",
  },
  pagi: { name: "Bank Pagi", short: "Pagi", kind: "bank", status: "experimental", site: "online.pagi.co.il" },
  max: { name: "Max", short: "Max", kind: "card", status: "experimental", site: "www.max.co.il" },
  isracard: {
    name: "Isracard",
    short: "Isracard",
    kind: "card",
    status: "experimental",
    site: "digital.isracard.co.il",
  },
  amex: {
    name: "American Express",
    short: "Amex",
    kind: "card",
    status: "experimental",
    site: "he.americanexpress.co.il",
  },
  beyahadBishvilha: {
    name: "Beyahad Bishvilha",
    short: "Beyahad",
    kind: "card",
    status: "experimental",
    site: "www.hist.org.il",
  },
  behatsdaa: {
    name: "Behatsdaa",
    short: "Behatsdaa",
    kind: "card",
    status: "experimental",
    site: "www.behatsdaa.org.il",
  },
  oneZero: {
    name: "One Zero",
    short: "One Zero",
    kind: "bank",
    status: "unsupported",
    site: "onezerobank.com",
    reason:
      "One Zero has no login page for a browser. Its login goes through the app's own servers with your password and an SMS code, and CoinLeak never handles your password.",
  },
  union: {
    name: "Union Bank",
    short: "Union",
    kind: "bank",
    status: "unsupported",
    site: "hb.unionbank.co.il",
    reason:
      "Union Bank is now part of Mizrahi Tefahot, and its old online banking site no longer answers. If your account moved, choose Mizrahi Tefahot.",
  },
} as const satisfies Record<string, ProviderEntry>;

type Registry = typeof REGISTRY;

/** Every company id of israeli-bank-scrapers 6.12.2 (its `CompanyTypes`). */
export type ProviderId = keyof Registry;

/** The providers CoinLeak can sync with self-login. */
export type EnabledProviderId = {
  [K in ProviderId]: Registry[K]["status"] extends "unsupported" ? never : K;
}[ProviderId];

export interface ProviderInfo extends ProviderEntry {
  readonly id: ProviderId;
}

const STATUS_ORDER: readonly ProviderStatus[] = ["verified", "experimental", "unsupported"];

/** All providers: verified first, then experimental, then unsupported. */
export const PROVIDERS: readonly ProviderInfo[] = STATUS_ORDER.flatMap((status) =>
  (Object.keys(REGISTRY) as ProviderId[])
    .map((id): ProviderInfo => ({ id, ...REGISTRY[id] }))
    .filter((p) => p.status === status),
);

export const PROVIDER_IDS: readonly ProviderId[] = PROVIDERS.map((p) => p.id);

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === "string" && Object.hasOwn(REGISTRY, value);
}

export function isEnabledProvider(value: unknown): value is EnabledProviderId {
  return isProviderId(value) && REGISTRY[value].status !== "unsupported";
}

export function providerInfo(id: ProviderId): ProviderInfo {
  return { id, ...REGISTRY[id] };
}

export const ENABLED_PROVIDERS: readonly EnabledProviderId[] = PROVIDER_IDS.filter(isEnabledProvider);

export function providerKind(id: ProviderId): AccountKind {
  return REGISTRY[id].kind;
}
