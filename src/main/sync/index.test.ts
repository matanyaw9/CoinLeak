// runSync with the browser and library faked: stages, one-at-a-time, error
// precedence, and that no library text reaches errors or the console.

import type { ScraperScrapingResult } from "israeli-bank-scrapers";
// The scraper library's own date library, so the clamp is checked against the real math.
import moment from "moment";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodedError, toAppError, type ErrorCode } from "@shared/errors";
import type { ProviderId, SyncStage } from "@shared/types";
import { effectiveStartDate, runSync, type SyncDeps } from "./index";
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
      const session = {
        context: {} as never,
        stopped,
        stopReason: () => reason,
        adoptPage: async () => {},
        finishing: () => {},
      };
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

// Saturday 2026-11-07, 12:00 in Israel (winter time, UTC+2).
const NOW = new Date("2026-11-07T10:00:00Z");

describe("runSync", () => {
  it("emits its stages in order, reports blocked hosts and returns normalized accounts", async () => {
    const stages: SyncStage[] = [];
    const reports: unknown[] = [];
    const { accounts } = await runSync(
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

  it("returns the first day the download covers, read from the clock after the download", async () => {
    const events: string[] = [];
    let startDate: Date | undefined;
    const download = await runSync("visaCal", {}, {
      withSyncBrowser: fakeBrowser(),
      createScraper: (_provider, input, hooks) => {
        startDate = input.startDate;
        return {
          scrape: async () => {
            const result = await loggedInThen(libraryAccounts)(hooks);
            events.push("downloaded");
            return result;
          },
        };
      },
      now: () => {
        events.push("clock");
        return NOW;
      },
    });
    expect(events).toEqual(["downloaded", "clock"]);
    expect(startDate?.toISOString()).toBe("2000-01-01T00:00:00.000Z");
    expect(download.since).toBe("2025-05-09");
  });

  it("a start date later than the library's limit sets the window", async () => {
    const asked = new Date("2026-09-30T21:00:00Z"); // 2026-10-01 00:00 in Israel
    const download = await runSync("discount", { startDate: asked }, {
      withSyncBrowser: fakeBrowser(),
      createScraper: fakeScraper(loggedInThen(libraryAccounts)),
      now: () => NOW,
    });
    expect(download.since).toBe("2026-10-02");
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
    const again = await runSync("discount", {}, {
      withSyncBrowser: fakeBrowser(),
      createScraper: fakeScraper(loggedInThen(libraryAccounts)),
    });
    expect(again.accounts).toHaveLength(1);
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

describe("effectiveStartDate", () => {
  const EARLIEST = new Date("2000-01-01T00:00:00Z");

  it("is the library's limit plus one day: Discount 1 year back plus 2 days, Cal 18 months plus 1 day", () => {
    expect(effectiveStartDate("discount", EARLIEST, NOW)).toBe("2025-11-10");
    expect(effectiveStartDate("visaCal", EARLIEST, NOW)).toBe("2025-05-09");
  });

  it.each([
    // [provider, now, expected]: one minute either side of midnight in Israel, New Year's Eve.
    ["discount", "2026-12-31T21:59:00Z", "2026-01-03"],
    ["discount", "2026-12-31T22:00:00Z", "2026-01-04"],
    ["visaCal", "2026-12-31T21:59:00Z", "2025-07-02"],
    ["visaCal", "2026-12-31T22:00:00Z", "2025-07-03"],
    // Summer time (UTC+3): 21:30Z is already the next day in Israel.
    ["discount", "2026-07-31T20:59:00Z", "2025-08-03"],
    ["discount", "2026-07-31T21:30:00Z", "2025-08-04"],
  ] as const)("%s at %s starts on %s", (provider, now, expected) => {
    expect(effectiveStartDate(provider, EARLIEST, new Date(now))).toBe(expected);
  });

  it("follows moment at month ends, and is later when the next day would clamp later", () => {
    // 2028-02-29 back one year is 2027-02-28 (moment clamps), plus 2 days, plus 1.
    expect(effectiveStartDate("discount", EARLIEST, new Date("2028-02-29T10:00:00Z"))).toBe("2027-03-03");
    // 2026-08-31 back 1 year then 6 months is 2025-02-28, plus 1 day, plus 1.
    expect(effectiveStartDate("visaCal", EARLIEST, new Date("2026-08-31T10:00:00Z"))).toBe("2025-03-02");
    // On 2027-02-28 a computer a day ahead counts from 2027-03-01: 2025-09-01 plus 1 day.
    expect(effectiveStartDate("visaCal", EARLIEST, new Date("2027-02-28T10:00:00Z"))).toBe("2025-09-02");
  });

  it("uses the requested day when it is later, in Israel days", () => {
    expect(effectiveStartDate("discount", new Date("2026-09-30T21:00:00Z"), NOW)).toBe("2026-10-02");
    expect(effectiveStartDate("visaCal", new Date("2026-09-30T20:59:00Z"), NOW)).toBe("2026-10-01");
  });

  // What the library itself computes (discount.js L51-54, visa-cal.js L388-390), in this process's zone.
  function libraryStart(provider: ProviderId, requested: Date, now: Date): string {
    const today = moment(now);
    const floor =
      provider === "discount"
        ? today.clone().subtract(1, "years").add(2, "day")
        : today.clone().subtract(1, "years").subtract(6, "months").add(1, "day");
    return moment.max(floor, moment(requested)).format("YYYY-MM-DD");
  }

  function inZone(zone: string, run: () => void): void {
    const saved = process.env.TZ;
    process.env.TZ = zone;
    try {
      run();
    } finally {
      if (saved === undefined) delete process.env.TZ;
      else process.env.TZ = saved;
    }
  }

  it("is never earlier than the library's own start, in any time zone, around midnight and month ends", () => {
    const days = ["2026-12-31", "2027-01-01", "2027-02-28", "2027-03-01", "2028-02-29", "2026-08-31", "2026-03-27"];
    // Minutes behind UTC in January, to prove each zone is really in effect.
    const zones: Record<string, number> = {
      "Asia/Jerusalem": -120,
      UTC: 0,
      "America/Los_Angeles": 480,
      "Asia/Tokyo": -540,
      "Pacific/Kiritimati": -840,
    };
    let checked = 0;
    for (const [zone, offset] of Object.entries(zones)) {
      inZone(zone, () => {
        expect(new Date("2027-01-15T12:00:00Z").getTimezoneOffset()).toBe(offset);
        for (const day of days) {
          for (let hour = 0; hour < 24; hour++) {
            for (const minute of [0, 59]) {
              const now = new Date(`${day}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);
              const requested = [EARLIEST, new Date(now.getTime() - 200 * 86_400_000)];
              for (const provider of ["discount", "visaCal"] as const) {
                for (const asked of requested) {
                  const ours = effectiveStartDate(provider, asked, now);
                  expect(ours >= libraryStart(provider, asked, now), `${zone} ${provider} ${now.toISOString()}`).toBe(
                    true,
                  );
                  checked++;
                }
              }
            }
          }
        }
      });
    }
    expect(checked).toBe(Object.keys(zones).length * days.length * 24 * 2 * 2 * 2);
  });

  it("is exactly one day after the library's start on an ordinary day in Israel", () => {
    inZone("Asia/Jerusalem", () => {
      for (const provider of ["discount", "visaCal"] as const) {
        const library = moment(libraryStart(provider, EARLIEST, NOW)).add(1, "day").format("YYYY-MM-DD");
        expect(effectiveStartDate(provider, EARLIEST, NOW)).toBe(library);
      }
    });
  });
});
