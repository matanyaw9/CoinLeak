// The sync browser with puppeteer mocked: launch options, the allowlist wiring,
// stop causes, and that the temporary profile is gone however the run ends.

import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser, LaunchOptions, Page } from "puppeteer";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CodedError } from "@shared/errors";
import {
  chromeArgs,
  launchOptions,
  PROFILE_PREFIX,
  withSyncBrowser,
  type BrowserDeps,
  type SyncSession,
} from "./browser";

class FakeCdp extends EventEmitter {
  sent: { method: string; params: unknown }[] = [];
  async send(method: string, params: unknown): Promise<void> {
    this.sent.push({ method, params });
  }
}

class FakePage extends EventEmitter {
  closed = false;
  readonly frame = {};
  mainFrame(): unknown {
    return this.frame;
  }
  async close(): Promise<void> {
    this.closed = true;
    this.emit("close");
  }
}

class FakeBrowser extends EventEmitter {
  readonly cdp = new FakeCdp();
  readonly blank = new FakePage();
  readonly context = { kind: "default-context" };
  closedByUs = false;
  pagesOpen: FakePage[] = [this.blank];
  target(): { createCDPSession(): Promise<FakeCdp> } {
    return { createCDPSession: async () => this.cdp };
  }
  defaultBrowserContext(): unknown {
    return this.context;
  }
  async pages(): Promise<FakePage[]> {
    return this.pagesOpen;
  }
  async close(): Promise<void> {
    this.closedByUs = true;
    this.emit("disconnected");
  }
  process(): null {
    return null;
  }
  /** The user closing the window. */
  userCloses(): void {
    this.emit("disconnected");
  }
}

let root: string;
let launched: LaunchOptions[];
let browser: FakeBrowser;

function deps(overrides: Partial<BrowserDeps> = {}): Partial<BrowserDeps> {
  return {
    findBrowser: async () => "/usr/bin/chromium-browser",
    launch: async (opts) => {
      launched.push(opts);
      return browser as unknown as Browser;
    },
    tmpRoot: () => root,
    ...overrides,
  };
}

function profileDirFromArgs(opts: LaunchOptions | undefined): string {
  const arg = opts?.args?.find((a) => a.startsWith("--user-data-dir="));
  if (!arg) throw new Error("no --user-data-dir");
  return arg.slice("--user-data-dir=".length);
}

function profilesLeft(): string[] {
  return readdirSync(root).filter((n) => n.startsWith(PROFILE_PREFIX));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "coinleak-browser-test-"));
  launched = [];
  browser = new FakeBrowser();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("launch options", () => {
  it("uses a pipe, a visible window, only our arguments and the temp profile", () => {
    const opts = launchOptions("/usr/bin/chromium-browser", "discount", "/tmp/coinleak-sync-abc");
    expect(opts).toMatchObject({
      executablePath: "/usr/bin/chromium-browser",
      pipe: true,
      headless: false,
      ignoreDefaultArgs: true,
      acceptInsecureCerts: false,
      defaultViewport: null,
    });
    expect(opts.args).toContain("--user-data-dir=/tmp/coinleak-sync-abc");
    expect(opts.args).toContain(
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE telebank.co.il, EXCLUDE *.telebank.co.il, " +
        "EXCLUDE discountbank.co.il, EXCLUDE *.discountbank.co.il",
    );
  });

  it("contains no flag that weakens the browser", () => {
    const args = chromeArgs("visaCal", "/tmp/coinleak-sync-abc");
    const forbidden = [
      /^--no-sandbox/,
      /^--disable-setuid-sandbox/,
      /^--disable-gpu-sandbox/,
      /^--no-zygote/,
      /^--single-process/,
      /^--disable-web-security/,
      /^--disable-site-isolation-trials/,
      /^--disable-client-side-phishing-detection/,
      /^--disable-popup-blocking/,
      /^--ignore-certificate-errors/,
      /^--allow-running-insecure-content/,
      /^--allow-insecure-localhost/,
      /^--remote-debugging-port/,
      /^--remote-debugging-address/,
      /^--remote-allow-origins/,
      /^--load-extension/,
      /^--enable-unsafe/,
      /^--user-data-dir=(?!\/tmp\/coinleak-sync-abc$)/,
    ];
    for (const arg of args) {
      for (const bad of forbidden) expect(arg).not.toMatch(bad);
    }
    const disabled = args.filter((a) => a.startsWith("--disable-features=")).join(",");
    for (const feature of ["IsolateOrigins", "site-per-process", "IsolateSandboxedIframes", "SafeBrowsing"]) {
      expect(disabled).not.toContain(feature);
    }
    expect(args).toContain("--disable-extensions");
  });
});

describe("withSyncBrowser", () => {
  it("launches over a pipe with a fresh 0700 profile and deletes it after success", async () => {
    let seenDir = "";
    const value = await withSyncBrowser(
      "discount",
      async () => {
        seenDir = profileDirFromArgs(launched[0]);
        expect(existsSync(seenDir)).toBe(true);
        if (process.platform !== "win32") expect(statSync(seenDir).mode & 0o777).toBe(0o700);
        const prefs = JSON.parse(readFileSync(join(seenDir, "Default", "Preferences"), "utf8")) as Record<string, unknown>;
        expect(prefs["credentials_enable_service"]).toBe(false);
        return 42;
      },
      { deps: deps() },
    );
    expect(value).toBe(42);
    expect(launched[0]?.pipe).toBe(true);
    expect(seenDir.startsWith(join(root, PROFILE_PREFIX))).toBe(true);
    expect(existsSync(seenDir)).toBe(false);
    expect(browser.closedByUs).toBe(true);
  });

  it("deletes the profile when the run fails", async () => {
    const err = await withSyncBrowser(
      "discount",
      async () => {
        throw new CodedError("BANK_ERROR");
      },
      { deps: deps() },
    ).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "BANK_ERROR" });
    expect(existsSync(profileDirFromArgs(launched[0]))).toBe(false);
    expect(profilesLeft()).toEqual([]);
  });

  it("deletes the profile when the browser fails to start", async () => {
    const err = await withSyncBrowser("visaCal", async () => 1, {
      deps: deps({
        launch: async (opts) => {
          launched.push(opts);
          throw new Error("Failed to launch the browser process! /usr/bin/chromium-browser: secret detail");
        },
      }),
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CodedError);
    expect((err as CodedError).code).toBe("BROWSER_MISSING");
    expect(String((err as Error).message)).not.toContain("secret");
    expect(existsSync(profileDirFromArgs(launched[0]))).toBe(false);
  });

  it("fails with BROWSER_MISSING before creating anything when no browser is found", async () => {
    const err = await withSyncBrowser("visaCal", async () => 1, {
      deps: deps({
        findBrowser: async () => {
          throw new CodedError("BROWSER_MISSING");
        },
      }),
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "BROWSER_MISSING" });
    expect(launched).toEqual([]);
    expect(profilesLeft()).toEqual([]);
  });

  it("ends with LOGIN_CANCELLED and deletes the profile when the user closes the window", async () => {
    const err = await withSyncBrowser(
      "discount",
      async (session) => {
        setTimeout(() => browser.userCloses(), 10);
        return session.stopped;
      },
      { deps: deps() },
    ).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "LOGIN_CANCELLED" });
    expect(profilesLeft()).toEqual([]);
  });

  it("ends with LOGIN_CANCELLED even if the run ignores the stop signal", async () => {
    const controller = new AbortController();
    const err = await withSyncBrowser(
      "discount",
      async () => {
        setTimeout(() => controller.abort(), 10);
        return new Promise<never>(() => {});
      },
      { deps: deps(), signal: controller.signal },
    ).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "LOGIN_CANCELLED" });
    expect(profilesLeft()).toEqual([]);
  });

  it("does not start at all when already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(withSyncBrowser("discount", async () => 1, { deps: deps(), signal: controller.signal })).rejects.toMatchObject({
      code: "LOGIN_CANCELLED",
    });
    expect(launched).toEqual([]);
  });

  it("allows bank requests, blocks the rest at browser level, and reports blocked hosts", async () => {
    let report: Record<string, number> = {};
    await withSyncBrowser(
      "discount",
      async () => {
        const paused = (requestId: string, url: string): void => {
          browser.cdp.emit("Fetch.requestPaused", { requestId, request: { url }, resourceType: "Script" });
        };
        paused("1", "https://start.telebank.co.il/login/");
        paused("2", "https://www.googletagmanager.com/gtm.js?id=GTM-XYZ");
        paused("3", "https://discountbank.co.il.evil.com/");
        paused("4", "https://www.googletagmanager.com/other");
      },
      { deps: deps(), onBlockedHosts: (counts) => (report = counts) },
    );
    expect(browser.cdp.sent[0]).toEqual({
      method: "Fetch.enable",
      params: { patterns: [{ urlPattern: "*", requestStage: "Request" }] },
    });
    expect(browser.cdp.sent.slice(1)).toEqual([
      { method: "Fetch.continueRequest", params: { requestId: "1" } },
      { method: "Fetch.failRequest", params: { requestId: "2", errorReason: "BlockedByClient" } },
      { method: "Fetch.failRequest", params: { requestId: "3", errorReason: "BlockedByClient" } },
      { method: "Fetch.failRequest", params: { requestId: "4", errorReason: "BlockedByClient" } },
    ]);
    expect(report).toEqual({ "discountbank.co.il.evil.com": 1, "www.googletagmanager.com": 2 });
  });

  it("adoptPage keeps only the library's tab and stops on its close", async () => {
    const libraryPage = new FakePage();
    browser.pagesOpen.push(libraryPage);
    const err = await withSyncBrowser(
      "visaCal",
      async (session: SyncSession) => {
        await session.adoptPage(libraryPage as unknown as Page);
        expect(browser.blank.closed).toBe(true);
        expect(session.stopReason()).toBeUndefined();
        setTimeout(() => void libraryPage.close(), 10);
        return session.stopped;
      },
      { deps: deps() },
    ).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "LOGIN_CANCELLED" });
  });

  // Regression: the owner's first real sync. The library closes its own tab in
  // terminate() after downloading, which was read as the user closing it.
  it("finishes normally when the library closes its own tab during cleanup", async () => {
    const libraryPage = new FakePage();
    browser.pagesOpen.push(libraryPage);
    const result = await withSyncBrowser(
      "discount",
      async (session: SyncSession) => {
        await session.adoptPage(libraryPage as unknown as Page);
        session.finishing();
        await libraryPage.close();
        await new Promise((r) => setTimeout(r, 10));
        return "downloaded";
      },
      { deps: deps() },
    );
    expect(result).toBe("downloaded");
  });

  it("stops with BLOCKED_REQUEST when the bank tab itself navigates off the allowlist", async () => {
    const page = new FakePage();
    const err = await withSyncBrowser(
      "discount",
      async (session) => {
        await session.adoptPage(page as unknown as Page);
        // A blocked tracker inside the page is not a reason to stop.
        page.emit("requestfailed", {
          isNavigationRequest: () => true,
          frame: () => ({ other: true }),
          failure: () => ({ errorText: "net::ERR_BLOCKED_BY_CLIENT" }),
        });
        expect(session.stopReason()).toBeUndefined();
        page.emit("requestfailed", {
          isNavigationRequest: () => true,
          frame: () => page.frame,
          failure: () => ({ errorText: "net::ERR_BLOCKED_BY_CLIENT" }),
        });
        return session.stopped;
      },
      { deps: deps() },
    ).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "BLOCKED_REQUEST" });
  });

  it("sweeps profiles left behind by a crash over an hour ago, and only those", async () => {
    const old = join(root, `${PROFILE_PREFIX}old`);
    const fresh = join(root, `${PROFILE_PREFIX}fresh`);
    const unrelated = join(root, "something-else");
    for (const d of [old, fresh, unrelated]) mkdirSync(d);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    utimesSync(old, twoHoursAgo, twoHoursAgo);
    utimesSync(unrelated, twoHoursAgo, twoHoursAgo);
    await withSyncBrowser("discount", async () => 1, { deps: deps() });
    expect(existsSync(old)).toBe(false);
    expect(existsSync(fresh)).toBe(true);
    expect(existsSync(unrelated)).toBe(true);
  });
});
