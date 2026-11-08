// Runs the real library classes (6.12.2) with our login() against a fake
// page, proving generic self-login hooks into every provider: the login page
// opens, the library's own success result is detected, nothing is typed,
// and the library's download and cleanup run after it.

import { EventEmitter } from "node:events";
import type { BrowserContext, Page } from "puppeteer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodedError, type ErrorCode } from "@shared/errors";
import { ENABLED_PROVIDERS, type EnabledProviderId } from "@shared/providers";
import { isAllowedUrl } from "./allowlist";
import { normalizeAccounts } from "./normalize";
import {
  CAL_SSO_URL,
  createSelfLoginScraper,
  LEUMI_LOGON_URL,
  libraryOptions,
  waitForLogin,
  type SelfLoginHooks,
} from "./self-login";

const never = new Promise<never>(() => {});

type Answer = (arg: unknown, fn: unknown) => unknown;

/** Just enough of a puppeteer Page for the library's code paths. Records what it is asked to do. */
class FakePage extends EventEmitter {
  currentUrl = "about:blank";
  viewports: unknown[] = [];
  userAgents: string[] = [];
  gotos: string[] = [];
  /** Selectors typed into or read with $eval: a form fill would show up here. */
  typed: string[] = [];
  evals: string[] = [];
  /** Selectors `$` finds. */
  elements = new Set<string>();
  closed = false;

  constructor(
    private readonly answer: Answer,
    /** Navigations after the login page answer HTTP 500, so a download fails fast. */
    private readonly onlyLoginPage = false,
  ) {
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
    const ok = !this.onlyLoginPage || this.gotos.length === 0;
    this.gotos.push(url);
    this.currentUrl = url;
    return { ok: () => ok, status: () => (ok ? 200 : 500) };
  }
  url(): string {
    return this.currentUrl;
  }
  async evaluate(fn: unknown, ...args: unknown[]): Promise<unknown> {
    return this.answer(args[0], fn);
  }
  async $(selector: string): Promise<{ dispose(): Promise<void> } | null> {
    return this.elements.has(selector) ? { dispose: async () => {} } : null;
  }
  async $$(): Promise<unknown[]> {
    return [];
  }
  async $eval(selector: string): Promise<never> {
    this.evals.push(selector);
    throw new Error("no such element");
  }
  async $$eval(selector: string): Promise<never> {
    this.evals.push(selector);
    throw new Error("no such element");
  }
  async type(selector: string): Promise<void> {
    this.typed.push(selector);
  }
  async waitForSelector(): Promise<never> {
    throw new Error("no such element");
  }
  async waitForFunction(): Promise<void> {}
  waitForRequest(): Promise<never> {
    return never;
  }
  async cookies(): Promise<unknown[]> {
    return [];
  }
  frames(): unknown[] {
    return [];
  }
  async close(): Promise<void> {
    this.closed = true;
  }
}

function contextFor(page: FakePage): BrowserContext {
  return { newPage: async () => page } as unknown as BrowserContext;
}

type TestHooks = SelfLoginHooks & { events: string[]; failure?: ErrorCode };

function hooks(page: FakePage, overrides: Partial<SelfLoginHooks> = {}): TestHooks {
  const events: string[] = [];
  const h: TestHooks = {
    events,
    stopped: never,
    pollMs: 5,
    onWaitingForLogin: () => events.push("waiting"),
    onLoggedIn: () => events.push("logged-in"),
    onLoginFailed: (code) => {
      h.failure = code;
    },
    // The library closes its tab in terminate(); we must hear about it first.
    onFinishing: () => events.push(page.closed ? "finishing-too-late" : "finishing"),
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

function scraperFor(provider: EnabledProviderId, page: FakePage, h: SelfLoginHooks, startDate = daysAgo(20)) {
  return createSelfLoginScraper(provider, { context: contextFor(page), preparePage: async () => {}, startDate }, h);
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

  it("also waits for the provider's ready check, and a throwing check is not ready", async () => {
    const page = new FakePage(() => null);
    page.currentUrl = "https://mto.mizrahi-tefahot.co.il/OnlineApp/";
    let checks = 0;
    await waitForLogin(asPage(page), [/OnlineApp/], never, 1000, 5, async () => ++checks >= 3);
    expect(checks).toBe(3);
    const boom = async (): Promise<boolean> => {
      throw new Error("detached");
    };
    await expect(waitForLogin(asPage(page), [/OnlineApp/], never, 30, 5, boom)).rejects.toMatchObject({
      code: "LOGIN_TIMEOUT",
    });
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
  it.each(ENABLED_PROVIDERS)(
    "%s: never passes credentials, screenshots, raw data, verbose logs or launch settings",
    (provider) => {
      const opts = libraryOptions(provider, {
        context: {} as BrowserContext,
        preparePage: async () => {},
        startDate: new Date(0),
      });
      expect(opts).toMatchObject({ companyId: provider, verbose: false, includeRawTransaction: false });
      for (const key of [
        "storeFailureScreenShotPath",
        "showBrowser",
        "executablePath",
        "args",
        "browser",
        "prepareBrowser",
        "credentials",
        "additionalTransactionInformation",
      ]) {
        expect(opts).not.toHaveProperty(key);
      }
    },
  );
});

describe("generic self-login, every enabled provider", () => {
  it.each(ENABLED_PROVIDERS)(
    "%s: opens a login page on its own allowlist, fills nothing, and cleans up when the user closes the window",
    async (provider) => {
      const page = new FakePage(() => null);
      let stop: (e: CodedError) => void = () => {};
      const stopped = new Promise<never>((_, reject) => {
        stop = reject;
      });
      stopped.catch(() => {});
      const h = hooks(page, {
        stopped,
        onWaitingForLogin: () => {
          h.events.push(`waiting at ${page.url()}`);
          stop(new CodedError("LOGIN_CANCELLED"));
        },
      });
      const result = await scraperFor(provider, page, h).scrape();

      expect(result.success).toBe(false);
      expect(h.failure).toBe("LOGIN_CANCELLED");
      expect(page.gotos).toHaveLength(1);
      const loginUrl = page.gotos[0] ?? "";
      expect(isAllowedUrl(provider, loginUrl), loginUrl).toBe(true);
      expect(h.events).toEqual([`waiting at ${loginUrl}`, "finishing"]);
      expect(page.closed).toBe(true);
      expect(page.typed).toEqual([]);
      expect(page.evals).toEqual([]);
      // A normal window for the user, not the library's fixed 1024x768.
      expect(page.viewports.at(-1)).toBeNull();
      expect(JSON.stringify(result)).not.toContain("errorMessage");
    },
  );

  it("refuses a provider that is not enabled before touching the library", () => {
    const page = new FakePage(() => null);
    for (const provider of ["oneZero", "union", "nope"]) {
      expect(() => scraperFor(provider as EnabledProviderId, page, hooks(page))).toThrow(CodedError);
    }
  });
});

/**
 * The user logs in: the tab sits on the login page, then reaches a URL from
 * the library's own Success list. Login must be detected only then.
 */
async function loginThenDownload(
  provider: EnabledProviderId,
  page: FakePage,
  successUrl: string,
  options: { beforeSuccess?: () => void; startDate?: Date } = {},
) {
  const seenAtLogin: string[] = [];
  const h = hooks(page, {
    onWaitingForLogin: () => {
      h.events.push("waiting");
      userLogsIn(page, successUrl, options.beforeSuccess);
    },
    onLoggedIn: () => {
      seenAtLogin.push(page.url());
      h.events.push("logged-in");
    },
  });
  const result = await scraperFor(provider, page, h, options.startDate).scrape();
  return { result, h, seenAtLogin };
}

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
    const prepared: unknown[] = [];
    const h = hooks(page);
    const scraper = createSelfLoginScraper(
      "discount",
      { context: contextFor(page), preparePage: async (p) => void prepared.push(p), startDate: daysAgo(30) },
      {
        ...h,
        onWaitingForLogin: () => {
          h.events.push("waiting");
          userLogsIn(page, "https://start.telebank.co.il/apollo/retail2/#/MY_ACCOUNT_HOMEPAGE");
        },
      },
    );
    const result = await scraper.scrape();

    expect(result.success).toBe(true);
    expect(h.events).toEqual(["waiting", "logged-in", "finishing"]);
    expect(page.gotos).toEqual(["https://start.telebank.co.il/login/#/LOGIN_PAGE"]);
    expect(prepared).toEqual([page]);
    // Library fixes 1024x768, then self-login hands the user a normal window.
    expect(page.viewports.at(-1)).toBeNull();
    expect(page.closed).toBe(true);
    expect(page.typed).toEqual([]);

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
    const h = hooks(page, { loginTimeoutMs: 40 });
    const result = await scraperFor("discount", page, h, daysAgo(30)).scrape();
    expect(result.success).toBe(false);
    expect(h.failure).toBe("LOGIN_TIMEOUT");
    expect(JSON.stringify(result)).not.toContain("errorMessage");
  });

  it("Mercantile uses Discount's code with its own login page", async () => {
    const page = new FakePage(answer);
    const { result, h } = await loginThenDownload(
      "mercantile",
      page,
      "https://start.telebank.co.il/apollo/retail3/#/MY_ACCOUNT_HOMEPAGE",
    );
    expect(page.gotos).toEqual(["https://start.telebank.co.il/login/?bank=m"]);
    expect(h.events).toEqual(["waiting", "logged-in", "finishing"]);
    expect(result.success).toBe(true);
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
    const { result, h, seenAtLogin } = await loginThenDownload(
      "visaCal",
      page,
      "https://digital-web.cal-online.co.il/dashboard",
      {
        beforeSuccess: () => {
          if (sso) page.emit("request", { url: () => CAL_SSO_URL, headers: () => sso });
          page.emit("request", { url: () => "https://www.cal-online.co.il/other", headers: () => ({ authorization: "x" }) });
        },
      },
    );
    return { result, h, seenAtLogin, calls: api.calls };
  }

  it("captures the token from the SSO request and the library uses it for its API calls", async () => {
    const page = new FakePage(sessionStorageAnswer());
    const { result, h, seenAtLogin, calls } = await run(page, { authorization: "CALAuthScheme synthetic-sso" });

    expect(result.success).toBe(true);
    expect(page.gotos).toEqual(["https://www.cal-online.co.il/"]);
    // Login counted only on the library's own /dashboard/i result.
    expect(seenAtLogin).toEqual(["https://digital-web.cal-online.co.il/dashboard"]);
    expect(h.events).toEqual(["waiting", "logged-in", "finishing"]);
    expect(page.typed).toEqual([]);
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

describe("Hapoalim self-login with the real library", () => {
  const BASE = "https://login.bankhapoalim.co.il";
  const day = ymd(daysAgo(4), "");
  const answer: Answer = (arg, fn) => {
    const source = String(fn);
    if (arg === undefined && source.includes("restContext")) return "/ServerServices";
    if (arg === undefined && source.includes("bnhpApp")) return true;
    const url = String(arg);
    if (url === `${BASE}/ServerServices/general/accounts`) {
      return [JSON.stringify([{ bankNumber: 12, branchNumber: 345, accountNumber: 678901, accountClosingReasonCode: 0 }]), 200];
    }
    if (url.startsWith(`${BASE}/ServerServices/current-account/composite/balanceAndCreditLimit`)) {
      return [JSON.stringify({ currentBalance: 1234.5 }), 200];
    }
    if (url.startsWith(`${BASE}/ServerServices/current-account/transactions?accountId=12-345-678901`)) {
      const txn = (serialNumber: number, amount: number) => ({
        eventDate: day,
        valueDate: day,
        eventAmount: amount,
        eventActivityTypeCode: 2,
        activityDescription: "SYNTH POALIM",
        referenceNumber: 4242,
        serialNumber,
      });
      return [JSON.stringify({ transactions: [txn(1, 50), txn(0, 7)] }), 200];
    }
    throw new Error(`unexpected evaluate ${url}`);
  };

  it("opens the logon page, detects the library's homepage URL, then downloads in the page", async () => {
    const page = new FakePage(answer);
    page.currentUrl = `${BASE}/ng-portals/auth/he/`;
    const { result, h, seenAtLogin } = await loginThenDownload("hapoalim", page, `${BASE}/ng-portals/rb/he/homepage`);

    expect(page.gotos).toEqual([`${BASE}/cgi-bin/poalwwwc?reqName=getLogonPage`]);
    expect(seenAtLogin).toEqual([`${BASE}/ng-portals/rb/he/homepage`]);
    expect(h.events).toEqual(["waiting", "logged-in", "finishing"]);
    expect(page.typed).toEqual([]);
    expect(result.success).toBe(true);
    const [account] = normalizeAccounts("hapoalim", result.accounts ?? []);
    expect(account).toMatchObject({ provider: "hapoalim", accountNumber: "12-345-678901", balance: 123450 });
    expect(account?.transactions.map((t) => [t.amount, t.status])).toEqual([
      [-5000, "completed"],
      [-700, "pending"],
    ]);
  });
});

describe("Max self-login with the real library", () => {
  const purchase = daysAgo(10);
  const month = `${purchase.getFullYear()}-${purchase.getMonth() + 1}-01`;
  const row = (paid: boolean, amount: number, arn: string) => ({
    shortCardNumber: "5678",
    planName: "רגילה",
    planTypeId: 5,
    purchaseDate: purchase.toISOString(),
    paymentDate: paid ? daysAgo(-5).toISOString() : null,
    originalAmount: amount,
    originalCurrency: "ILS",
    actualPaymentAmount: amount,
    paymentCurrency: 376,
    merchantName: "SYNTH MAX ",
    comments: "",
    dealData: { arn },
    categoryId: 1,
  });
  const answer: Answer = (arg) => {
    const url = String(arg);
    if (url === "https://onlinelcapi.max.co.il/api/contents/getCategories") {
      return [JSON.stringify({ result: [{ id: 1, name: "SYNTH" }] }), 200];
    }
    if (url === "https://www.max.co.il/api/registered/getHomePageData") {
      const card = { Last4Digits: "5678", CreditLimit: 10000, OpenToBuy: 9000, CycleSummary: [] };
      return [JSON.stringify({ Result: { UserCards: { Cards: [card] } } }), 200];
    }
    if (url.startsWith("https://onlinelcapi.max.co.il/api/registered/transactionDetails/getTransactionsAndGraphs")) {
      const filter = new URL(url).searchParams.get("filterData") ?? "";
      const transactions = filter.includes(`"date":"${month}"`) ? [row(true, 99.9, "A1"), row(false, 12, "A2")] : [];
      return [JSON.stringify({ result: { transactions } }), 200];
    }
    throw new Error(`unexpected evaluate ${url}`);
  };

  it("opens the login page, detects the library's personal home page, then downloads in the page", async () => {
    const page = new FakePage(answer);
    const { result, h, seenAtLogin } = await loginThenDownload("max", page, "https://www.max.co.il/homepage/personal");

    expect(page.gotos).toEqual(["https://www.max.co.il/login"]);
    expect(seenAtLogin).toEqual(["https://www.max.co.il/homepage/personal"]);
    expect(h.events).toEqual(["waiting", "logged-in", "finishing"]);
    expect(page.typed).toEqual([]);
    expect(result.success).toBe(true);
    const [card] = normalizeAccounts("max", result.accounts ?? []);
    expect(card).toMatchObject({ provider: "max", accountNumber: "5678", balance: -100000 });
    expect(card?.transactions.map((t) => [t.amount, t.status, t.description])).toEqual([
      [-9990, "completed", "SYNTH MAX"],
      [-1200, "pending", "SYNTH MAX"],
    ]);
  });

  it("does not count a page that is not the library's exact success URL", async () => {
    const page = new FakePage(answer);
    const h = hooks(page, {
      loginTimeoutMs: 60,
      onWaitingForLogin: () => userLogsIn(page, "https://www.max.co.il/homepage/personal/extra"),
    });
    const result = await scraperFor("max", page, h).scrape();
    expect(result.success).toBe(false);
    expect(h.failure).toBe("LOGIN_TIMEOUT");
  });
});

describe("Leumi self-login with the real library", () => {
  it("opens the login form the library's own login opens, and detects its SPA URL", async () => {
    const page = new FakePage(() => null, true);
    const { result, h, seenAtLogin } = await loginThenDownload(
      "leumi",
      page,
      "https://hb2.bankleumi.co.il/eBanking/SO/SPA.aspx#/home",
    );
    expect(page.gotos[0]).toBe(LEUMI_LOGON_URL);
    expect(seenAtLogin).toEqual(["https://hb2.bankleumi.co.il/eBanking/SO/SPA.aspx#/home"]);
    // The library's download then opens its transactions page (here: refused by the fake bank).
    expect(page.gotos[1]).toContain("https://hb2.bankleumi.co.il/eBanking/SO/SPA.aspx");
    expect(h.events).toEqual(["waiting", "logged-in", "finishing"]);
    expect(page.typed).toEqual([]);
    expect(result).toMatchObject({ success: false, errorType: "GENERIC" });
  });
});

describe("providers with an extra login check", () => {
  it("Mizrahi: the after-login URL counts only once the account menu is there", async () => {
    const page = new FakePage(() => null);
    const { h, seenAtLogin } = await loginThenDownload(
      "mizrahi",
      page,
      "https://mto.mizrahi-tefahot.co.il/OnlineApp/home",
      { beforeSuccess: () => setTimeout(() => page.elements.add("#dropdownBasic"), 60) },
    );
    expect(page.gotos).toEqual(["https://www.mizrahi-tefahot.co.il/login/index.html#/auth-page-he"]);
    expect(seenAtLogin).toEqual(["https://mto.mizrahi-tefahot.co.il/OnlineApp/home"]);
    expect(h.events.slice(0, 2)).toEqual(["waiting", "logged-in"]);
    expect(h.events.at(-1)).toBe("finishing");
    expect(page.typed).toEqual([]);
  });

  it("Mizrahi: without the account menu it is not logged in", async () => {
    const page = new FakePage(() => null);
    const h = hooks(page, {
      loginTimeoutMs: 80,
      onWaitingForLogin: () => userLogsIn(page, "https://mto.mizrahi-tefahot.co.il/OnlineApp/home"),
    });
    await scraperFor("mizrahi", page, h).scrape();
    expect(h.failure).toBe("LOGIN_TIMEOUT");
  });

  it("Behatsdaa: its public home page counts only once the login token exists", async () => {
    let token = false;
    const answer: Answer = (arg, fn) => {
      if (typeof fn === "string" && fn.includes("userToken")) return token;
      if (arg === undefined) return null; // the library reading the token value: we never do
      throw new Error("unexpected evaluate");
    };
    const page = new FakePage(answer);
    const h = hooks(page, {
      loginTimeoutMs: 80,
      onWaitingForLogin: () => userLogsIn(page, "https://www.behatsdaa.org.il/"),
    });
    await scraperFor("behatsdaa", page, h).scrape();
    expect(h.failure).toBe("LOGIN_TIMEOUT");

    const page2 = new FakePage(answer);
    const { h: h2 } = await loginThenDownload("behatsdaa", page2, "https://www.behatsdaa.org.il/", {
      beforeSuccess: () => {
        token = true;
      },
    });
    expect(page2.gotos).toEqual(["https://www.behatsdaa.org.il/login"]);
    expect(h2.events).toEqual(["waiting", "logged-in", "finishing"]);
  });

  it.each([
    ["isracard", "https://digital.isracard.co.il"],
    ["amex", "https://he.americanexpress.co.il"],
  ] as const)("%s: logged in means any personal-area page after the login page", async (provider, base) => {
    const page = new FakePage(() => {
      throw new Error("no data in this test");
    });
    const loggedIn = new Promise<string>((resolve) => {
      const h = hooks(page, {
        onWaitingForLogin: () => {
          // The login page itself and its sub-steps are not logged in.
          setTimeout(() => (page.currentUrl = `${base}/personalarea/Login/?step=otp`), 10);
          userLogsIn(page, `${base}/personalarea/dashboard/`);
        },
        onLoggedIn: () => resolve(page.url()),
      });
      // The library's download waits between requests; this test stops at login.
      scraperFor(provider, page, h).scrape().catch(() => {});
    });
    expect(await loggedIn).toBe(`${base}/personalarea/dashboard/`);
    expect(page.gotos).toEqual([`${base}/personalarea/Login`]);
    expect(page.typed).toEqual([]);
  });
});
