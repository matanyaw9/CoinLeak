// One sync: sync browser, user logs in, library downloads, normalized accounts
// and the first day the download surely covers. Emits opening_browser,
// waiting_for_login, downloading; the caller that saves the rows emits saving,
// done and failed. Throws only CodedError.

import { CodedError, type ErrorCode } from "@shared/errors";
import type { IsoDate, ProviderId, ScrapedAccount, SyncStage } from "@shared/types";
import { withSyncBrowser, type SyncBrowserOptions, type SyncSession } from "./browser";
import { codeForResult, toCodedError } from "./errors";
import { israelDay, normalizeAccounts } from "./normalize";
import { createSelfLoginScraper, LOGIN_TIMEOUT_MS, type SelfLoginHooks, type SelfLoginScraper } from "./self-login";

export { LOGIN_TIMEOUT_MS } from "./self-login";
/** Login wait plus the download itself. A hung bank ends the sync instead of the app waiting forever. */
export const SYNC_TIMEOUT_MS = LOGIN_TIMEOUT_MS + 10 * 60 * 1000;

export interface SyncReport {
  /** Requests the allowlist blocked, by host. Never paths or query strings. */
  blockedHosts: Record<string, number>;
}

export interface SyncDownload {
  accounts: ScrapedAccount[];
  /** First Israel day the download surely covers (see `effectiveStartDate`). */
  since: IsoDate;
}

export interface SyncOptions {
  onProgress?: (stage: SyncStage) => void;
  signal?: AbortSignal;
  /** Earliest day wanted. Defaults to as far back as the library allows. */
  startDate?: Date;
  /** Called once at the end, success or failure. */
  onReport?: (report: SyncReport) => void;
}

export interface SyncDeps {
  withSyncBrowser: typeof withSyncBrowser;
  createScraper: (
    provider: ProviderId,
    input: Parameters<typeof createSelfLoginScraper>[1],
    hooks: SelfLoginHooks,
  ) => SelfLoginScraper;
  browserDeps?: SyncBrowserOptions["deps"];
  syncTimeoutMs: number;
  now: () => Date;
}

const defaultDeps: SyncDeps = {
  withSyncBrowser,
  createScraper: createSelfLoginScraper,
  syncTimeoutMs: SYNC_TIMEOUT_MS,
  now: () => new Date(),
};

// The library clamps this to its own maximum (1 year for Discount, 18 months for Cal).
const EARLIEST = new Date("2000-01-01T00:00:00Z");

// The library's own earliest day, counted back from `today` the way moment
// does it: discount.js L51 (1 year back plus 2 days) and visa-cal.js L388
// (1 year, then 6 months back, plus 1 day). israeli-bank-scrapers 6.12.2.
const LIBRARY_EARLIEST: Record<ProviderId, (today: IsoDate) => IsoDate> = {
  discount: (today) => addDays(addMonths(today, -12), 2),
  visaCal: (today) => addDays(addMonths(addMonths(today, -12), -6), 1),
};

/**
 * The first Israel day a download surely covers: the later of the day asked
 * for and the library's clamp, plus one day for safety. The library counts
 * from this computer's clock and zone, whose day can be one ahead of
 * Israel's, so the clamp from the next Israel day counts too. `now` must be
 * no earlier than the moment the library started.
 */
export function effectiveStartDate(provider: ProviderId, requested: Date, now: Date): IsoDate {
  const clamp = LIBRARY_EARLIEST[provider];
  const today = israelDay(now.toISOString());
  const candidates = [
    addDays(clamp(today), 1),
    clamp(addDays(today, 1)),
    addDays(israelDay(requested.toISOString()), 1),
  ];
  return candidates.reduce((a, b) => (a > b ? a : b));
}

/** Moves a day by whole months like moment: the day clamps to the end of a shorter month. */
function addMonths(day: IsoDate, months: number): IsoDate {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return isoDay(Date.UTC(y, m - 1 + months, Math.min(d, lastDay)));
}

function addDays(day: IsoDate, days: number): IsoDate {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return isoDay(Date.UTC(y, m - 1, d + days));
}

function isoDay(utcMs: number): IsoDate {
  return new Date(utcMs).toISOString().slice(0, 10);
}

let running = false;

export async function runSync(
  provider: ProviderId,
  options: SyncOptions = {},
  deps: Partial<SyncDeps> = {},
): Promise<SyncDownload> {
  if (running) throw new CodedError("SYNC_IN_PROGRESS");
  running = true;
  try {
    return await syncOnce(provider, options, { ...defaultDeps, ...deps });
  } catch (e) {
    throw toCodedError(e);
  } finally {
    running = false;
  }
}

async function syncOnce(provider: ProviderId, options: SyncOptions, deps: SyncDeps): Promise<SyncDownload> {
  const progress = (stage: SyncStage): void => options.onProgress?.(stage);
  progress("opening_browser");
  return deps.withSyncBrowser(provider, (session) => download(provider, session, options, deps, progress), {
    signal: options.signal,
    onBlockedHosts: (blockedHosts) => options.onReport?.({ blockedHosts }),
    deps: deps.browserDeps,
  });
}

async function download(
  provider: ProviderId,
  session: SyncSession,
  options: SyncOptions,
  deps: SyncDeps,
  progress: (stage: SyncStage) => void,
): Promise<SyncDownload> {
  let loginFailure: ErrorCode | undefined;
  const startDate = options.startDate ?? EARLIEST;
  const scraper = deps.createScraper(
    provider,
    { context: session.context, preparePage: (page) => session.adoptPage(page), startDate },
    {
      stopped: session.stopped,
      onWaitingForLogin: () => progress("waiting_for_login"),
      onLoggedIn: () => progress("downloading"),
      onLoginFailed: (code) => {
        loginFailure = code;
      },
      onFinishing: () => session.finishing(),
    },
  );

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new CodedError("BANK_ERROR")), deps.syncTimeoutMs);
  });
  const scraping = scraper.scrape();
  scraping.catch(() => {});
  try {
    const result = await Promise.race([scraping, session.stopped, timeout]);
    const code = result.success ? codeForResult(result) : (session.stopReason() ?? loginFailure ?? codeForResult(result));
    if (code) throw new CodedError(code);
    const accounts = normalizeAccounts(provider, result.accounts ?? []);
    // Read the clock after the download: the library read it earlier, so its clamp is no later.
    return { accounts, since: effectiveStartDate(provider, startDate, deps.now()) };
  } catch (e) {
    // Closing the window mid-download surfaces as a library error first; report the real cause.
    throw new CodedError(session.stopReason() ?? toCodedError(e).code);
  } finally {
    clearTimeout(timer);
  }
}
