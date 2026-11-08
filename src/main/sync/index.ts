// One sync: sync browser, user logs in, library downloads, normalized accounts
// and the first day the download surely covers. Emits opening_browser,
// waiting_for_login, downloading; the caller that saves the rows emits saving,
// done and failed. Throws only CodedError.

import { CodedError, type ErrorCode } from "@shared/errors";
import { isEnabledProvider, type EnabledProviderId } from "@shared/providers";
import type { IsoDate, ProviderId, ScrapedAccount, SyncStage } from "@shared/types";
import { withSyncBrowser, type SyncBrowserOptions, type SyncSession } from "./browser";
import { codeForResult, toCodedError } from "./errors";
import { effectiveStartDate, requestStart } from "./history";
import { normalizeAccounts } from "./normalize";
import { createSelfLoginScraper, LOGIN_TIMEOUT_MS, type SelfLoginHooks, type SelfLoginScraper } from "./self-login";

export { effectiveStartDate } from "./history";
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
    provider: EnabledProviderId,
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

let running = false;

export async function runSync(
  provider: ProviderId,
  options: SyncOptions = {},
  deps: Partial<SyncDeps> = {},
): Promise<SyncDownload> {
  // Unsupported providers would need the password in our process: refused here.
  if (!isEnabledProvider(provider)) throw new CodedError("BAD_REQUEST");
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

async function syncOnce(provider: EnabledProviderId, options: SyncOptions, deps: SyncDeps): Promise<SyncDownload> {
  const progress = (stage: SyncStage): void => options.onProgress?.(stage);
  progress("opening_browser");
  return deps.withSyncBrowser(provider, (session) => download(provider, session, options, deps, progress), {
    signal: options.signal,
    onBlockedHosts: (blockedHosts) => options.onReport?.({ blockedHosts }),
    deps: deps.browserDeps,
  });
}

async function download(
  provider: EnabledProviderId,
  session: SyncSession,
  options: SyncOptions,
  deps: SyncDeps,
  progress: (stage: SyncStage) => void,
): Promise<SyncDownload> {
  let loginFailure: ErrorCode | undefined;
  // Reads the clock only for a library without its own clamp; see requestStart.
  const startDate = requestStart(provider, options.startDate, deps.now);
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
