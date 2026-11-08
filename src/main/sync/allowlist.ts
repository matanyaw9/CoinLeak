// Which hosts the sync browser may reach, per provider. Pure: the browser
// launcher applies it twice (CDP request interception and host resolver rules).
// Every entry is explained in docs/banks/<provider>.md.

import type { EnabledProviderId } from "@shared/providers";

/**
 * Host suffixes: `telebank.co.il` allows itself and any `*.telebank.co.il`.
 * Only the provider's own domains: login page, logged-in site, and the API
 * its download calls from inside the page. Ads, analytics, session
 * recorders, fonts and widgets stay blocked.
 */
export const ALLOWED_HOSTS: Readonly<Record<EnabledProviderId, readonly string[]>> = {
  discount: ["telebank.co.il", "discountbank.co.il"],
  mercantile: ["telebank.co.il", "mercantile.co.il"],
  visaCal: ["cal-online.co.il"],
  hapoalim: ["bankhapoalim.co.il"],
  leumi: ["bankleumi.co.il", "leumi.co.il"],
  mizrahi: ["mizrahi-tefahot.co.il"],
  beinleumi: ["fibi.co.il"],
  massad: ["bankmassad.co.il"],
  otsarHahayal: ["bankotsar.co.il"],
  pagi: ["pagi.co.il"],
  yahav: ["yahav.co.il"],
  max: ["max.co.il"],
  isracard: ["isracard.co.il"],
  amex: ["americanexpress.co.il"],
  beyahadBishvilha: ["hist.org.il"],
  behatsdaa: ["behatsdaa.org.il"],
};

/** A third-party service the login page needs: one exact host, only these path prefixes. */
export interface ThirdParty {
  host: string;
  paths: readonly string[];
}

/** Google reCAPTCHA, which the Isracard, Amex and Behatsdaa login pages run. Nothing else of Google. */
const RECAPTCHA: readonly ThirdParty[] = [
  { host: "www.google.com", paths: ["/recaptcha/"] },
  { host: "www.gstatic.com", paths: ["/recaptcha/"] },
];

export const THIRD_PARTY: Readonly<Partial<Record<EnabledProviderId, readonly ThirdParty[]>>> = {
  isracard: RECAPTCHA,
  amex: RECAPTCHA,
  behatsdaa: RECAPTCHA,
};

/**
 * Paths blocked even on the provider's own hosts. Isracard and Amex serve an
 * automation detector the library's own login aborts too
 * (base-isracard-amex.js L335-337, israeli-bank-scrapers 6.12.2).
 */
export const BLOCKED_PATHS: Readonly<Partial<Record<EnabledProviderId, readonly string[]>>> = {
  isracard: ["detector-dom.min.js"],
  amex: ["detector-dom.min.js"],
};

/** Schemes that never leave the machine. */
const LOCAL_SCHEMES = new Set(["data:", "blob:", "about:"]);

function own<T>(table: Readonly<Partial<Record<EnabledProviderId, T>>>, provider: EnabledProviderId): T | undefined {
  return Object.hasOwn(table, provider) ? table[provider] : undefined;
}

export function isAllowedHost(provider: EnabledProviderId, hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (own(ALLOWED_HOSTS, provider) ?? []).some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function isAllowedThirdParty(provider: EnabledProviderId, url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return (own(THIRD_PARTY, provider) ?? []).some(
    (party) => host === party.host && party.paths.some((path) => url.pathname.startsWith(path)),
  );
}

/** True when the sync browser may load this URL for this provider. */
export function isAllowedUrl(provider: EnabledProviderId, url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (LOCAL_SCHEMES.has(parsed.protocol)) return true;
  if (parsed.protocol !== "https:" || parsed.port !== "") return false;
  if ((own(BLOCKED_PATHS, provider) ?? []).some((part) => parsed.pathname.toLowerCase().includes(part))) return false;
  return isAllowedHost(provider, parsed.hostname) || isAllowedThirdParty(provider, parsed);
}

/** What a blocked request is counted under: the host only, never path or query. */
export function blockedLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname || parsed.protocol;
  } catch {
    return "invalid-url";
  }
}

/**
 * Chromium `--host-resolver-rules`: every name fails to resolve except the
 * provider's (and the exact third-party hosts its login needs). Backstop for
 * traffic CDP interception cannot see (WebSockets, background requests).
 */
export function hostResolverRules(provider: EnabledProviderId): string {
  const exclusions = ALLOWED_HOSTS[provider].flatMap((s) => [`EXCLUDE ${s}`, `EXCLUDE *.${s}`]);
  const parties = (own(THIRD_PARTY, provider) ?? []).map((party) => `EXCLUDE ${party.host}`);
  return ["MAP * ~NOTFOUND", ...exclusions, ...parties].join(", ");
}

/** Counts blocked requests by label. */
export class BlockedCounter {
  readonly #counts = new Map<string, number>();

  add(url: string): void {
    const label = blockedLabel(url);
    this.#counts.set(label, (this.#counts.get(label) ?? 0) + 1);
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries([...this.#counts].sort(([a], [b]) => a.localeCompare(b)));
  }
}
