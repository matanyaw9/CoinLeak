// Runs the real library classes (6.12.2) with our login() against a fake
// page, proving self-login hooks in and the library's download code runs.

import { EventEmitter } from "node:events";
import type { BrowserContext, Page } from "puppeteer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodedError, type ErrorCode } from "@shared/errors";
import { normalizeAccounts } from "./normalize";
import {
  CAL_SSO_URL,
  createSelfLoginScraper,
  libraryOptions,
  waitForLogin,
  type SelfLoginHooks,
} from "./self-login";

const never = new Promise<never>(() => {});

/** Just enough of a puppeteer Page for the library's Discount and Cal code paths. */
class FakePage extends EventEmitter {
  currentUrl = "about:blank";
  viewports: unknown[] = [];
  userAgents: string[] = [];
  gotos: string[] = [];
  closed = false;

  constructor(private readonly answer: (arg: unknown) => unknown) {
    super();
  }
  async setCacheEnabled(): Promise<void> {}
  async setViewport(v: unknown): Promise<void> {
    this.viewports.push(v);
  }
  async setUserAgent(ua: string): Promise<void> {
    this.userAgents.push(ua);
  }
  async goto(url: string): Promise<{ ok(): boolean; status(): number }> {
    this.gotos.push(url);
    this.currentUrl = url;
    return { ok: () => true, status: () => 200 };
  }
  url(): string {
    return this.currentUrl;
  }
  async evaluate(_fn: unknown, arg: unknown): Promise<unknown> {
    return this.answer(arg);
  }
  waitForRequest(): Promise<never> {
    return never;
  }
  async close(): Promise<void> {
    this.closed = true;
  }
}

function contextFor(page: FakePage): BrowserContext {
  return { newPage: async () => page } as unknown as BrowserContext;
}

function hooks(overrides: Partial<SelfLoginHooks> = {}): SelfLoginHooks & { events: string[]; failure?: ErrorCode } {
  const events: string[] = [];
  const h: SelfLoginHooks & { events: string[]; failure?: ErrorCode } = {
    events,
    stopped: never,
    pollMs: 5,
    onWaitingForLogin: () => events.push("waiting"),
    onLoggedIn: () => events.push("logged-in"),
    onLoginFailed: (code) => {
      h.failure = code;
    },
    ...overrides,
  };
  return h;
}

/** The user logging in by hand: the tab reaches the logged-in URL later. */
function userLogsIn(page: FakePage, url: string, before?: () => void): void {
  setTimeout(() => {
    before?.();
    page.currentUrl = url;
  }, 30);
}

const asPage = (p: FakePage): Page => p as unknown as Page;
const daysAgo = (n: number): Date => new Date(Date.now() - n * 86_400_000);
const ymd = (d: Date, sep = "-"): string =>
  [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join(sep);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("waitForLogin", () => {
  it("matches a string condition case-insensitively on the full URL", async () => {
    const page = new FakePage(() => null);
    page.currentUrl = "https://start.telebank.co.il/login/";
    userLogsIn(page, "https://START.telebank.co.il/apollo/retail2/#/MY_ACCOUNT_HOMEPAGE");
    await waitForLogin(asPage(page), ["https://start.telebank.co.il/apollo/retail2/#/MY_ACCOUNT_HOMEPAGE"], never, 2000, 5);
  });

  it("matches a regular expression and a function condition", async () => {
    const page = new FakePage(() => null);
    page.currentUrl = "https://digital-web.cal-online.co.il/dashboard";
    await waitForLogin(asPage(page), [/dashboard/i], never, 1000, 5);
    let calls = 0;
    await waitForLogin(asPage(page), [async () => ++calls >= 3], never, 1000, 5);
    expect(calls).toBe(3);
  });

  it("treats a throwing function condition as no match", async () => {
    const page = new FakePage(() => null);
    const boom = async (): Promise<boolean> => {
      throw new Error("frame detached");
    };
    await expect(waitForLogin(asPage(page), [boom], never, 30, 5)).rejects.toMatchObject({ code: "LOGIN_TIMEOUT" });
  });

  it("gives up with LOGIN_TIMEOUT", async () => {
    const page = new FakePage(() => null);
    page.currentUrl = "https://start.telebank.co.il/login/";
    const err = await waitForLogin(asPage(page), [/MY_ACCOUNT_HOMEPAGE/], never, 40, 5).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CodedError);
    expect((err as CodedError).code).toBe("LOGIN_TIMEOUT");
  });

  it("stops at once when the sync is stopped (window closed)", async () => {
    const page = new FakePage(() => null);
    const stopped = new Promise<never>((_, reject) => setTimeout(() => reject(new CodedError("LOGIN_CANCELLED")), 20));
    await expect(waitForLogin(asPage(page), [/never/], stopped, 60_000, 5)).rejects.toMatchObject({
      code: "LOGIN_CANCELLED",
    });
  });

  it("refuses an empty success list instead of waiting forever", async () => {
    await expect(waitForLogin(asPage(new FakePage(() => null)), [], never)).rejects.toMatchObject({
      code: "BANK_CHANGED",
    });
  });
});

describe("libraryOptions", () => {
  it("never passes credentials, screenshots, raw data, verbose logs or launch settings", () => {
    const opts = libraryOptions("discount", {
      context: {} as BrowserContext,
      preparePage: async () => {},
      startDate: new Date(0),
    });
    expect(opts).toMatchObject({ companyId: "discount", verbose: false, includeRawTransaction: false });
    for (const key of [
      "storeFailureScreenShotPath",
      "showBrowser",
      "executablePath",
      "args",
      "browser",
      "prepareBrowser",
      "credentials",
    ]) {
      expect(opts).not.toHaveProperty(key);
    }
  });
});

describe("Discount self-login with the real library", () => {
  const accountsData = { UserAccountsData: { UserAccounts: [{ NewAccountInfo: { AccountID: "000-111111" } }] } };
  const day = ymd(daysAgo(3), "");
  const txns = {
    CurrentAccountLastTransactions: {
      OperationEntry: [
        { OperationNumber: 777, OperationDate: day, ValueDate: day, OperationAmount: -42.5, OperationDescriptionToDisplay: "SYNTH CAFE" },
      ],
      FutureTransactionsBlock: {
        FutureTransactionEntry: [
          { OperationNumber: 0, OperationDate: day, ValueDate: day, OperationAmount: -10, OperationDescriptionToDisplay: "SYNTH PENDING" },
        ],
      },
      CurrentAccountInfo: { AccountBalance: 1000.1 },
    },
  };
  const answer = (arg: unknown): unknown => {
    const url = String(arg);
    if (url.endsWith("/userAccountsData")) return [JSON.stringify(accountsData), 200];
    if (url.includes("/lastTransactions/000-111111/")) return [JSON.stringify(txns), 200];
    throw new Error(`unexpected evaluate ${url}`);
  };

  it("opens the login page, waits for the user, then the library downloads", async () => {
    const page = new FakePage(answer);
    const h = hooks();
    const prepared: unknown[] = [];
    const scraper = createSelfLoginScraper(
      "discount",
      { context: contextFor(page), preparePage: async (p) => void prepared.push(p), startDate: daysAgo(30) },
      { ...h, onWaitingForLogin: () => {
          h.events.push("waiting");
          userLogsIn(page, "https://start.telebank.co.il/apollo/retail2/#/MY_ACCOUNT_HOMEPAGE");
        } },
    );
    const result = await scraper.scrape();

    expect(result.success).toBe(true);
    expect(h.events).toEqual(["waiting", "logged-in"]);
    expect(page.gotos).toEqual(["https://start.telebank.co.il/login/#/LOGIN_PAGE"]);
    expect(prepared).toEqual([page]);
    // Library fixes 1024x768, then self-login hands the user a normal window.
    expect(page.viewports.at(-1)).toBeNull();
    expect(page.closed).toBe(true);

    const accounts = normalizeAccounts("discount", result.accounts ?? []);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ provider: "discount", accountNumber: "000-111111", balance: 100010 });
    expect(accounts[0]?.transactions.map((t) => [t.amount, t.status, t.identifier])).toEqual([
      [-4250, "completed", "777"],
      [-1000, "pending", "0"],
    ]);
  });

  it("reports LOGIN_TIMEOUT through the hook when the user never logs in", async () => {
    const page = new FakePage(answer);
    const h = hooks({ loginTimeoutMs: 40 });
    const result = await createSelfLoginScraper(
      "discount",
      { context: contextFor(page), preparePage: async () => {}, startDate: daysAgo(30) },
      h,
    ).scrape();
    expect(result.success).toBe(false);
    expect(h.failure).toBe("LOGIN_TIMEOUT");
    expect(JSON.stringify(result)).not.toContain("errorMessage");
  });
});

describe("Cal self-login with the real library", () => {
  const purchaseDay = ymd(daysAgo(10));
  const completed = {
    trnIntId: "9001",
    trnTypeCode: "5",
    trnPurchaseDate: `${purchaseDay}T00:00:00`,
    debCrdDate: `${ymd(daysAgo(-5))}T00:00:00`,
    amtBeforeConvAndIndex: 120,
    trnAmt: 30,
    trnCurrencySymbol: "USD",
    debCrdCurrencySymbol: "ILS",
    merchantName: "SYNTH SHOP",
    transTypeCommentDetails: [],
    branchCodeDesc: "SYNTH",
    numOfPayments: 0,
    curPaymentNum: 0,
  };
  const pending = {
    trnTypeCode: "5",
    trnPurchaseDate: `${ymd(daysAgo(1))}T00:00:00`,
    trnAmt: 15.5,
    trnCurrencySymbol: "ILS",
    merchantName: "SYNTH PENDING",
    transTypeCommentDetails: [],
    numberOfPayments: 0,
  };

  function calApi(): { fetch: ReturnType<typeof vi.fn>; calls: { url: string; auth: string }[] } {
    const calls: { url: string; auth: string }[] = [];
    const fetch = vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({ url, auth: init.headers["Authorization"] ?? "" });
      let json: unknown;
      if (url.endsWith("/GetFrameStatus")) {
        json = { result: { calIssuedCards: { cardLevelFrames: [{ cardUniqueId: "u1", nextTotalDebit: 250.5 }] } } };
      } else if (url.endsWith("/getClearanceRequests")) {
        json = { statusCode: 1, result: { cardsList: [{ authDetalisList: [pending] }] } };
      } else {
        // Cal groups rows by billing month. Every month answers with the same row
        // so the test does not depend on where today falls in the month.
        json = {
          statusCode: 1,
          result: { bankAccounts: [{ debitDates: [{ transactions: [completed] }], immidiateDebits: { debitDays: [] } }] },
        };
      }
      return { json: async () => json };
    });
    return { fetch, calls };
  }

  function sessionStorageAnswer(token?: string) {
    return (arg: unknown): unknown => {
      if (arg === "init") return JSON.stringify({ result: { cards: [{ cardUniqueId: "u1", last4Digits: "4321" }] } });
      if (arg === "auth-module") return token ? JSON.stringify({ auth: { calConnectToken: token } }) : null;
      throw new Error(`unexpected evaluate ${String(arg)}`);
    };
  }

  async function run(page: FakePage, sso: Record<string, string> | null) {
    const api = calApi();
    vi.stubGlobal("fetch", api.fetch);
    const h = hooks({
      onWaitingForLogin: () =>
        userLogsIn(page, "https://digital-web.cal-online.co.il/dashboard", () => {
          if (sso) page.emit("request", { url: () => CAL_SSO_URL, headers: () => sso });
          page.emit("request", { url: () => "https://www.cal-online.co.il/other", headers: () => ({ authorization: "x" }) });
        }),
    });
    const result = await createSelfLoginScraper(
      "visaCal",
      { context: contextFor(page), preparePage: async () => {}, startDate: daysAgo(20) },
      h,
    ).scrape();
    return { result, calls: api.calls };
  }

  it("captures the token from the SSO request and the library uses it for its API calls", async () => {
    const page = new FakePage(sessionStorageAnswer());
    const { result, calls } = await run(page, { authorization: "CALAuthScheme synthetic-sso" });

    expect(result.success).toBe(true);
    expect(page.gotos).toEqual(["https://www.cal-online.co.il/"]);
    // Same user agent the library's own login sets.
    expect(page.userAgents).toHaveLength(1);
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(new Set(calls.map((c) => c.auth))).toEqual(new Set(["CALAuthScheme synthetic-sso"]));
    // The only hosts the library contacts from Node, outside the browser.
    expect(new Set(calls.map((c) => new URL(c.url).hostname))).toEqual(new Set(["api.cal-online.co.il"]));
    expect(page.listenerCount("request")).toBe(0);

    const [card] = normalizeAccounts("visaCal", result.accounts ?? []);
    expect(card).toMatchObject({ provider: "visaCal", accountNumber: "4321", balance: -25050 });
    const done = card?.transactions.find((t) => t.status === "completed");
    expect(done).toMatchObject({
      date: purchaseDay,
      amount: -12000,
      originalAmount: -3000,
      originalCurrency: "USD",
      description: "SYNTH SHOP",
      identifier: "9001",
      memo: null,
    });
    expect(card?.transactions.find((t) => t.status === "pending")).toMatchObject({ amount: -1550, identifier: null });
  });

  it("falls back to the library's sessionStorage token when the SSO request had none", async () => {
    const page = new FakePage(sessionStorageAnswer("synthetic-storage"));
    const { result, calls } = await run(page, null);
    expect(result.success).toBe(true);
    expect(new Set(calls.map((c) => c.auth))).toEqual(new Set(["CALAuthScheme synthetic-storage"]));
  });
});
