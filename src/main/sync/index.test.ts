// runSync with the browser and library faked: stages, one-at-a-time, error
// precedence, and that no library text reaches errors or the console.

import type { ScraperScrapingResult } from "israeli-bank-scrapers";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodedError, toAppError, type ErrorCode } from "@shared/errors";
import type { SyncStage } from "@shared/types";
import { runSync, type SyncDeps } from "./index";
import type { SelfLoginHooks } from "./self-login";

const FAKE_PASSWORD = "Hunter2-FAKE-pw!";

const libraryAccounts: ScraperScrapingResult = {
  success: true,
  accounts: [
    {
      accountNumber: "000-111111",
      balance: 10.5,
      txns: [
        {
          type: "normal" as never,
          identifier: 1,
          date: "2026-10-01T21:00:00.000Z",
          processedDate: "2026-10-01T21:00:00.000Z",
          originalAmount: -12,
          originalCurrency: "ILS",
          chargedAmount: -12,
          description: "SYNTH",
          status: "completed" as never,
        },
      ],
    },
  ],
};

/** Stands in for withSyncBrowser: a session whose stop fires on abort or on demand. */
function fakeBrowser(stopAfter?: { ms: number; code: ErrorCode }): SyncDeps["withSyncBrowser"] {
  const impl = async <T>(
    _provider: unknown,
    run: (s: Parameters<Parameters<SyncDeps["withSyncBrowser"]>[1]>[0]) => Promise<T>,
    options?: Parameters<SyncDeps["withSyncBrowser"]>[2],
  ): Promise<T> => {
    let reason: ErrorCode | undefined;
    let reject: (e: CodedError) => void = () => {};
    const stopped = new Promise<never>((_, r) => {
      reject = r;
    });
    stopped.catch(() => {});
    const fire = (code: ErrorCode): void => {
      reason ??= code;
      reject(new CodedError(code));
    };
    options?.signal?.addEventListener("abort", () => fire("LOGIN_CANCELLED"));
    if (stopAfter) setTimeout(() => fire(stopAfter.code), stopAfter.ms);
    try {
      const session = { context: {} as never, stopped, stopReason: () => reason, adoptPage: async () => {} };
      return await Promise.race([run(session), stopped]);
    } finally {
      options?.onBlockedHosts?.({ "www.googletagmanager.com": 2 });
    }
  };
  return impl as SyncDeps["withSyncBrowser"];
}

function fakeScraper(behavior: (hooks: SelfLoginHooks) => Promise<ScraperScrapingResult>): SyncDeps["createScraper"] {
  return (_provider, _input, hooks) => ({ scrape: () => behavior(hooks) });
}

const loggedInThen =
  (result: ScraperScrapingResult) =>
  async (hooks: SelfLoginHooks): Promise<ScraperScrapingResult> => {
    hooks.onWaitingForLogin();
    hooks.onLoggedIn();
    return result;
  };

function spyConsole(): () => string {
  const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation(() => {}),
  );
  return () => spies.flatMap((s) => s.mock.calls.map((c) => c.map(String).join(" "))).join("\n");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runSync", () => {
  it("emits its stages in order, reports blocked hosts and returns normalized accounts", async () => {
    const stages: SyncStage[] = [];
    const reports: unknown[] = [];
    const accounts = await runSync(
      "discount",
      { onProgress: (s) => stages.push(s), onReport: (r) => reports.push(r) },
      { withSyncBrowser: fakeBrowser(), createScraper: fakeScraper(loggedInThen(libraryAccounts)) },
    );
    expect(stages).toEqual(["opening_browser", "waiting_for_login", "downloading"]);
    expect(reports).toEqual([{ blockedHosts: { "www.googletagmanager.com": 2 } }]);
    expect(accounts).toEqual([
      expect.objectContaining({ provider: "discount", accountNumber: "000-111111", balance: 1050 }),
    ]);
    expect(accounts[0]?.transactions[0]).toMatchObject({ date: "2026-10-02", amount: -1200 });
  });

  it("allows one sync at a time", async () => {
    let finish: (r: ScraperScrapingResult) => void = () => {};
    const first = runSync("discount", {}, {
      withSyncBrowser: fakeBrowser(),
      createScraper: fakeScraper(() => new Promise((resolve) => (finish = resolve))),
    });
    await expect(runSync("visaCal", {}, { withSyncBrowser: fakeBrowser() })).rejects.toMatchObject({
      code: "SYNC_IN_PROGRESS",
    });
    finish(libraryAccounts);
    await first;
    await expect(
      runSync("discount", {}, { withSyncBrowser: fakeBrowser(), createScraper: fakeScraper(loggedInThen(libraryAccounts)) }),
    ).resolves.toHaveLength(1);
  });

  it("reports our own login failure code, not the library's generic one", async () => {
    const err = await runSync("discount", {}, {
      withSyncBrowser: fakeBrowser(),
      createScraper: fakeScraper(async (hooks) => {
        hooks.onLoginFailed("LOGIN_TIMEOUT");
        return { success: false, errorType: "GENERAL_ERROR" as never };
      }),
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "LOGIN_TIMEOUT" });
  });

  it("reports LOGIN_CANCELLED when the window is closed mid-download", async () => {
    const err = await runSync("visaCal", {}, {
      withSyncBrowser: fakeBrowser({ ms: 10, code: "LOGIN_CANCELLED" }),
      createScraper: fakeScraper(async () => new Promise(() => {})),
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "LOGIN_CANCELLED" });
  });

  it("prefers the stop reason over the library error it causes", async () => {
    let fire: () => void = () => {};
    const err = await runSync("visaCal", {}, {
      withSyncBrowser: fakeBrowser({ ms: 5, code: "BLOCKED_REQUEST" }),
      createScraper: fakeScraper(
        () =>
          new Promise((resolve) => {
            fire = () => resolve({ success: false, errorType: "GENERIC" as never, errorMessage: "Target closed" });
            setTimeout(fire, 20);
          }),
      ),
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "BLOCKED_REQUEST" });
  });

  it("cancels through the signal", async () => {
    const controller = new AbortController();
    const pending = runSync("discount", { signal: controller.signal }, {
      withSyncBrowser: fakeBrowser(),
      createScraper: fakeScraper(async (hooks) => {
        hooks.onWaitingForLogin();
        return new Promise(() => {});
      }),
    });
    setTimeout(() => controller.abort(), 10);
    await expect(pending).rejects.toMatchObject({ code: "LOGIN_CANCELLED" });
  });

  it("gives up on a download that never ends", async () => {
    const err = await runSync("discount", {}, {
      withSyncBrowser: fakeBrowser(),
      createScraper: fakeScraper(async () => new Promise(() => {})),
      syncTimeoutMs: 20,
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: "BANK_ERROR" });
  });

  it("turns anything unexpected into a CodedError", async () => {
    const err = await runSync("discount", {}, {
      withSyncBrowser: (async () => {
        throw new TypeError(`cannot read properties of undefined (password ${FAKE_PASSWORD})`);
      }) as SyncDeps["withSyncBrowser"],
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CodedError);
    expect(err).toMatchObject({ code: "UNKNOWN" });
    expect(JSON.stringify(toAppError(err))).not.toContain(FAKE_PASSWORD);
  });

  it("lets nothing of a library error message reach the error or the console (fake password test)", async () => {
    const consoleText = spyConsole();
    const leaky = `Login failed: user 012345678 password ${FAKE_PASSWORD} rejected`;
    const err = await runSync("visaCal", {}, {
      withSyncBrowser: fakeBrowser(),
      createScraper: fakeScraper(async (hooks) => {
        hooks.onWaitingForLogin();
        hooks.onLoggedIn();
        return { success: false, errorType: "INVALID_PASSWORD" as never, errorMessage: leaky };
      }),
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(CodedError);
    const e = err as CodedError;
    expect(e.code).toBe("BANK_ERROR");
    const visible = [e.message, e.stack ?? "", JSON.stringify(e), JSON.stringify(toAppError(e)), consoleText()].join("\n");
    expect(visible).not.toContain(FAKE_PASSWORD);
    expect(visible).not.toContain("012345678");
  });
});
