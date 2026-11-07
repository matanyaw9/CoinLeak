// Starts the sync browser and always cleans it up: system Chromium over a
// pipe, visible window, fresh 0700 profile deleted afterwards, and network
// limited to the provider's hosts for every page, frame, popup and worker.

import { rmSync } from "node:fs";
import { chmod, mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser, BrowserContext, HTTPRequest, LaunchOptions, Page, Protocol } from "puppeteer";
import { CodedError, type ErrorCode } from "@shared/errors";
import type { ProviderId } from "@shared/types";
import { BlockedCounter, hostResolverRules, isAllowedUrl } from "./allowlist";
import { findBrowser } from "./find-browser";

export const PROFILE_PREFIX = "coinleak-sync-";
const STALE_PROFILE_MS = 60 * 60 * 1000;
const CLOSE_TIMEOUT_MS = 15_000;

/**
 * The full Chromium command line (puppeteer's defaults are ignored). Taken
 * from puppeteer's defaults minus everything that weakens the browser:
 * no --disable-popup-blocking, no --disable-client-side-phishing-detection,
 * IsolateSandboxedIframes left on, and never --no-sandbox.
 */
const BASE_ARGS = [
  "--disable-background-networking",
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
  "--disable-breakpad",
  "--disable-crash-reporter",
  "--disable-component-extensions-with-background-pages",
  "--disable-default-apps",
  "--disable-extensions",
  "--disable-search-engine-choice-screen",
  "--disable-sync",
  "--disable-features=Translate,AcceptCHFrame,MediaRouter,OptimizationHints",
  // Shows "controlled by automated test software", as the library always does.
  "--enable-automation",
  "--metrics-recording-only",
  "--no-default-browser-check",
  "--no-first-run",
  // Never touch the OS keyring from a throwaway profile.
  "--password-store=basic",
  "--use-mock-keychain",
];

/** Chrome profile preferences: never offer to save the bank password or autofill data. */
const PROFILE_PREFERENCES = {
  credentials_enable_service: false,
  credentials_enable_autosignin: false,
  profile: { password_manager_enabled: false },
  autofill: { profile_enabled: false, credit_card_enabled: false },
};

export function chromeArgs(provider: ProviderId, userDataDir: string): string[] {
  return [
    ...BASE_ARGS,
    `--user-data-dir=${userDataDir}`,
    `--host-resolver-rules=${hostResolverRules(provider)}`,
    "about:blank",
  ];
}

export function launchOptions(executablePath: string, provider: ProviderId, userDataDir: string): LaunchOptions {
  return {
    executablePath,
    // CDP over stdio pipes: no debugging port another program could connect to.
    pipe: true,
    headless: false,
    ignoreDefaultArgs: true,
    args: chromeArgs(provider, userDataDir),
    defaultViewport: null,
    acceptInsecureCerts: false,
    // We clean up ourselves; puppeteer's handlers would exit before our finally runs.
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
    dumpio: false,
  };
}

export interface SyncSession {
  readonly context: BrowserContext;
  /** Rejects with a CodedError when the sync must stop. Never resolves. */
  readonly stopped: Promise<never>;
  stopReason(): ErrorCode | undefined;
  /** Takes over the page the library opened: the only tab, watched until the end. */
  adoptPage(page: Page): Promise<void>;
}

export interface BrowserDeps {
  findBrowser(): Promise<string>;
  launch(options: LaunchOptions): Promise<Browser>;
  tmpRoot(): string;
}

export interface SyncBrowserOptions {
  signal?: AbortSignal;
  /** Called once at the end, success or not, with blocked requests counted by host. */
  onBlockedHosts?: (counts: Record<string, number>) => void;
  deps?: Partial<BrowserDeps>;
}

const defaultDeps: BrowserDeps = {
  findBrowser: () => findBrowser(),
  launch: async (options) => (await import("puppeteer")).default.launch(options),
  tmpRoot: () => tmpdir(),
};

function createStop(): { stopped: Promise<never>; reason(): ErrorCode | undefined; fire(code: ErrorCode): void } {
  let reason: ErrorCode | undefined;
  let reject: (e: CodedError) => void = () => {};
  const stopped = new Promise<never>((_, r) => {
    reject = r;
  });
  stopped.catch(() => {});
  return {
    stopped,
    reason: () => reason,
    fire(code) {
      if (reason) return;
      reason = code;
      reject(new CodedError(code));
    },
  };
}

/** Old profiles left by a crash still hold bank cookies: remove them. */
async function sweepStaleProfiles(root: string): Promise<void> {
  const names = await readdir(root).catch(() => [] as string[]);
  for (const name of names.filter((n) => n.startsWith(PROFILE_PREFIX))) {
    const path = join(root, name);
    try {
      if (Date.now() - (await stat(path)).mtimeMs > STALE_PROFILE_MS) {
        await rm(path, { recursive: true, force: true });
      }
    } catch {
      // Not ours to worry about now; the next sync tries again.
    }
  }
}

async function createProfile(root: string): Promise<string> {
  const dir = await mkdtemp(join(root, PROFILE_PREFIX));
  try {
    await chmod(dir, 0o700);
    await mkdir(join(dir, "Default"), { mode: 0o700 });
    await writeFile(join(dir, "Default", "Preferences"), JSON.stringify(PROFILE_PREFERENCES), { mode: 0o600 });
    return dir;
  } catch (e) {
    await rm(dir, { recursive: true, force: true });
    throw e;
  }
}

/** Last resort if the process exits before our finally block runs. */
function removeOnExit(dir: string): () => void {
  const handler = (): void => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Exiting anyway; the next sync sweeps it.
    }
  };
  process.once("exit", handler);
  return () => process.off("exit", handler);
}

async function deleteProfile(dir: string, forgetExitHook: () => void): Promise<void> {
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    forgetExitHook();
  } catch {
    // Keep the exit hook so it is retried when the app exits.
    console.warn("[sync] could not delete the sync browser profile yet");
  }
}

async function closeBrowser(browser: Browser): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, CLOSE_TIMEOUT_MS);
  });
  await Promise.race([browser.close().catch(() => {}), timeout]);
  clearTimeout(timer);
  const proc = browser.process();
  if (proc && proc.exitCode === null && proc.signalCode === null) proc.kill("SIGKILL");
}

/**
 * Browser-level CDP interception sees requests from every page, frame,
 * popup and worker, including ones created after this call.
 */
async function enforceAllowlist(browser: Browser, provider: ProviderId, blocked: BlockedCounter): Promise<void> {
  const cdp = await browser.target().createCDPSession();
  cdp.on("Fetch.requestPaused", (event: Protocol.Fetch.RequestPausedEvent) => {
    const { requestId, request } = event;
    const allowed = isAllowedUrl(provider, request.url);
    if (!allowed) blocked.add(request.url);
    const reply = allowed
      ? cdp.send("Fetch.continueRequest", { requestId })
      : cdp.send("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
    // The page may already be gone; nothing to do then.
    reply.catch(() => {});
  });
  await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
}

/** The bank tab itself tried to leave the allowlist (not an ad or tracker inside it). */
export function isBlockedMainFrameNavigation(page: Page, request: HTTPRequest): boolean {
  return (
    request.isNavigationRequest() &&
    request.frame() === page.mainFrame() &&
    request.failure()?.errorText === "net::ERR_BLOCKED_BY_CLIENT"
  );
}

export async function withSyncBrowser<T>(
  provider: ProviderId,
  run: (session: SyncSession) => Promise<T>,
  options: SyncBrowserOptions = {},
): Promise<T> {
  const deps = { ...defaultDeps, ...options.deps };
  const { signal } = options;
  if (signal?.aborted) throw new CodedError("LOGIN_CANCELLED");
  const executablePath = await deps.findBrowser();
  const root = deps.tmpRoot();
  await sweepStaleProfiles(root);
  const dir = await createProfile(root);
  const forgetExitHook = removeOnExit(dir);
  const blocked = new BlockedCounter();
  const stop = createStop();
  const onAbort = (): void => stop.fire("LOGIN_CANCELLED");
  let browser: Browser | undefined;
  let closing = false;
  try {
    signal?.addEventListener("abort", onAbort, { once: true });
    try {
      browser = await deps.launch(launchOptions(executablePath, provider, dir));
    } catch {
      throw new CodedError("BROWSER_MISSING");
    }
    const live = browser;
    live.on("disconnected", () => {
      if (!closing) stop.fire("LOGIN_CANCELLED");
    });
    await enforceAllowlist(live, provider, blocked);
    if (signal?.aborted) throw new CodedError("LOGIN_CANCELLED");

    const session: SyncSession = {
      context: live.defaultBrowserContext(),
      stopped: stop.stopped,
      stopReason: stop.reason,
      async adoptPage(page) {
        page.on("close", () => {
          if (!closing) stop.fire("LOGIN_CANCELLED");
        });
        page.on("requestfailed", (request) => {
          if (isBlockedMainFrameNavigation(page, request)) stop.fire("BLOCKED_REQUEST");
        });
        // Chromium opened a blank tab at startup; the library's page is the only one we want.
        for (const other of await live.pages()) {
          if (other !== page) await other.close().catch(() => {});
        }
      },
    };
    const work = run(session);
    work.catch(() => {});
    return await Promise.race([work, stop.stopped]);
  } finally {
    closing = true;
    signal?.removeEventListener("abort", onAbort);
    if (browser) await closeBrowser(browser);
    await deleteProfile(dir, forgetExitHook);
    options.onBlockedHosts?.(blocked.snapshot());
  }
}
