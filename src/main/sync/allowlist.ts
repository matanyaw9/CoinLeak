// Which hosts the sync browser may reach, per provider. Pure: the browser
// launcher applies it twice (CDP request interception and host resolver rules).
// Every entry is explained in docs/banks/<provider>.md.

import type { ProviderId } from "@shared/types";

/** Host suffixes: `telebank.co.il` allows itself and any `*.telebank.co.il`. */
export const ALLOWED_HOSTS: Readonly<Record<ProviderId, readonly string[]>> = {
  discount: ["telebank.co.il", "discountbank.co.il"],
  visaCal: ["cal-online.co.il"],
};

/** Schemes that never leave the machine. */
const LOCAL_SCHEMES = new Set(["data:", "blob:", "about:"]);

export function isAllowedHost(provider: ProviderId, hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOSTS[provider].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

/** True when the sync browser may load this URL for this provider. */
export function isAllowedUrl(provider: ProviderId, url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (LOCAL_SCHEMES.has(parsed.protocol)) return true;
  if (parsed.protocol !== "https:" || parsed.port !== "") return false;
  return isAllowedHost(provider, parsed.hostname);
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
 * provider's. Backstop for traffic CDP interception cannot see (WebSockets,
 * the browser's own background requests).
 */
export function hostResolverRules(provider: ProviderId): string {
  const exclusions = ALLOWED_HOSTS[provider].flatMap((s) => [`EXCLUDE ${s}`, `EXCLUDE *.${s}`]);
  return ["MAP * ~NOTFOUND", ...exclusions].join(", ");
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
