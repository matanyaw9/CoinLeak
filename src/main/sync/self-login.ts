// Self-login on israeli-bank-scrapers 6.12.2, one mechanism for every provider:
// the library's own scraper for the company, with login() replaced (open the
// login page, wait for the user) and terminate() wrapped, then its own download.
// Every use of library internals lives in this file. Recheck it on upgrade.

import { createRequire } from "node:module";
import type { BrowserContext, HTTPRequest, Page, PuppeteerLifeCycleEvent } from "puppeteer";
import type { ScraperOptions, ScraperScrapingResult } from "israeli-bank-scrapers";
import type * as BaseModule from "israeli-bank-scrapers/lib/scrapers/base-scraper-with-browser.js";
import type * as DefinitionsModule from "israeli-bank-scrapers/lib/definitions.js";
import type * as ErrorsModule from "israeli-bank-scrapers/lib/scrapers/errors.js";
import type * as FactoryModule from "israeli-bank-scrapers/lib/scrapers/factory.js";
import { CodedError, type ErrorCode } from "@shared/errors";
import { isEnabledProvider, type EnabledProviderId } from "@shared/providers";
import { codeForThrown } from "./errors";

// The library is CommonJS without an exports map; require keeps its default
// exports intact in Node, Electron, vitest and tsx alike.
const cjsRequire = createRequire(import.meta.url);
const { BaseScraperWithBrowser, LoginResults } = cjsRequire(
  "israeli-bank-scrapers/lib/scrapers/base-scraper-with-browser.js",
) as typeof BaseModule;
const { CompanyTypes } = cjsRequire("israeli-bank-scrapers/lib/definitions.js") as typeof DefinitionsModule;
const { ScraperErrorTypes } = cjsRequire("israeli-bank-scrapers/lib/scrapers/errors.js") as typeof ErrorsModule;
const createLibraryScraper = (cjsRequire("israeli-bank-scrapers/lib/scrapers/factory.js") as typeof FactoryModule)
  .default;

export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_MS = 500;

/** Copy of the library's SSO_AUTHORIZATION_REQUEST_ENDPOINT (visa-cal.js L31). */
export const CAL_SSO_URL = "https://connect.cal-online.co.il/col-rest/calconnect/authentication/SSO";
/** The login form Leumi's own login opens (leumi.js L218); its loginUrl (L20) is the marketing site. */
export const LEUMI_LOGON_URL = "https://hb2.bankleumi.co.il/authenticate/logon";

/**
 * Self-login has no credentials. The library builds form-fill values from
 * this object in getLoginOptions(); we never fill a form, so it stays empty.
 */
const NO_CREDENTIALS = Object.freeze({}) as never;

type LoginOptions = BaseModule.LoginOptions;
/** One entry of the library's possibleResults lists. */
export type SuccessCondition = string | RegExp | ((options?: { page?: Page }) => Promise<boolean>);

export interface SelfLoginHooks {
  /** Rejects when the sync must stop: window closed, cancelled, blocked navigation. */
  stopped: Promise<never>;
  onWaitingForLogin(): void;
  onLoggedIn(): void;
  /** Our own failure during login. The library only sees a generic failure. */
  onLoginFailed(code: ErrorCode): void;
  /** The library starts its own cleanup (it closes its tab), after the download. */
  onFinishing?(): void;
  loginTimeoutMs?: number;
  pollMs?: number;
}

export interface SelfLoginScraper {
  scrape(): Promise<ScraperScrapingResult>;
}

/** Where the user logs in and what logged in looks like. */
export interface LoginPlan {
  loginUrl: string;
  waitUntil?: PuppeteerLifeCycleEvent;
  /** The user agent the library's own login sets, so tokens match its API calls. */
  userAgent?: string;
  /** Any one of these means logged in: the library's own Success list. */
  success: readonly SuccessCondition[];
}

/**
 * The library scraper as self-login uses it. In the library's types these
 * members are protected (page, login, terminate) or untyped (baseUrl,
 * authorization); base-scraper-with-browser.js and the provider files, 6.12.2.
 */
interface LibraryScraper {
  page: Page;
  scrape(credentials: never): Promise<ScraperScrapingResult>;
  login(credentials: never): Promise<ScraperScrapingResult>;
  terminate(success: boolean): Promise<void>;
  navigateTo(url: string, waitUntil?: PuppeteerLifeCycleEvent): Promise<void>;
  getLoginOptions(credentials: never): LoginOptions;
}

/** Watches the login and hands the library what its own login would have captured. */
interface Capture {
  loggedIn(): void;
  dispose(): void;
}

/** Where one provider's self-login differs from the plain one. */
interface ProviderLogin {
  /** Our own plan. Default: the library's getLoginOptions(). */
  plan?(scraper: LibraryScraper): LoginPlan;
  /** Must also hold before login counts: what the library's own login waited for. */
  ready?(page: Page): Promise<boolean>;
  capture?(scraper: LibraryScraper): Capture;
}

/** Same rules as the library's getKeyByValue(): string is a case-insensitive full match. */
async function matches(condition: SuccessCondition, url: string, page: Page): Promise<boolean> {
  if (condition instanceof RegExp) return condition.test(url);
  if (typeof condition === "string") return url.toLowerCase() === condition.toLowerCase();
  try {
    // The library passes { page, value } although its type only names page.
    return await condition({ page, value: url } as { page: Page });
  } catch {
    return false;
  }
}

async function holds(check: ((page: Page) => Promise<boolean>) | undefined, page: Page): Promise<boolean> {
  if (!check) return true;
  try {
    return await check(page);
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls the tab's URL until it matches the provider's success result (and `ready` holds). */
export async function waitForLogin(
  page: Page,
  conditions: readonly SuccessCondition[],
  stopped: Promise<never>,
  timeoutMs = LOGIN_TIMEOUT_MS,
  pollMs = POLL_MS,
  ready?: (page: Page) => Promise<boolean>,
): Promise<void> {
  if (conditions.length === 0) throw new CodedError("BANK_CHANGED");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const url = page.url();
    for (const condition of conditions) {
      if ((await matches(condition, url, page)) && (await holds(ready, page))) return;
    }
    const left = deadline - Date.now();
    if (left <= 0) throw new CodedError("LOGIN_TIMEOUT");
    await Promise.race([sleep(Math.min(pollMs, left)), stopped]);
  }
}

/** The library's own login page and success list, from getLoginOptions(). */
function libraryPlan(scraper: LibraryScraper): LoginPlan {
  const options = scraper.getLoginOptions(NO_CREDENTIALS);
  return {
    loginUrl: options.loginUrl,
    waitUntil: options.waitUntil,
    userAgent: options.userAgent,
    success: options.possibleResults[LoginResults.Success] ?? [],
  };
}

async function hasElement(page: Page, selector: string): Promise<boolean> {
  const handle = await page.$(selector);
  if (!handle) return false;
  void handle.dispose().catch(() => {});
  return true;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Isracard and Amex override login() with API calls that post the password
 * (base-isracard-amex.js L331-409), so the library has no login page plan.
 * The user logs in on the page that login() opens (L343) instead; any page
 * of the personal area after it means logged in, and the download then uses
 * the page's session cookies (fetchGetWithinPage, L104 and L188).
 */
function isracardAmexPlan(scraper: LibraryScraper): LoginPlan {
  const baseUrl = (scraper as unknown as { baseUrl?: unknown }).baseUrl;
  if (typeof baseUrl !== "string" || !baseUrl.startsWith("https://")) throw new CodedError("BANK_CHANGED");
  return {
    loginUrl: `${baseUrl}/personalarea/Login`,
    success: [new RegExp(`^${escapeRegExp(baseUrl)}/personalarea/(?!login)`, "i")],
  };
}

/**
 * The library's own login reads the Authorization header of the SSO request
 * the login frame makes (visa-cal.js L262-283). Capture it the same way; if it
 * is empty, the library falls back to the token in sessionStorage (L238-244).
 */
function captureCalToken(scraper: LibraryScraper): Capture {
  let token = "";
  const page = scraper.page;
  const onRequest = (request: HTTPRequest): void => {
    if (request.url() !== CAL_SSO_URL) return;
    token = String(request.headers()["authorization"] ?? "").trim() || token;
  };
  page.on("request", onRequest);
  return {
    loggedIn() {
      // Same field the library's postAction sets (visa-cal.js L209, L283).
      if (token) (scraper as unknown as { authorization?: string }).authorization = token;
    },
    dispose() {
      page.off("request", onRequest);
    },
  };
}

/** The library's login page and success list are enough. */
const PLAIN: ProviderLogin = {};

/** Every provider CoinLeak can sync. Evidence for each: docs/banks/<id>.md. */
const PROVIDER_LOGIN: Readonly<Record<EnabledProviderId, ProviderLogin>> = {
  discount: PLAIN,
  mercantile: PLAIN,
  hapoalim: PLAIN,
  beinleumi: PLAIN,
  massad: PLAIN,
  otsarHahayal: PLAIN,
  pagi: PLAIN,
  yahav: PLAIN,
  max: PLAIN,
  beyahadBishvilha: PLAIN,
  visaCal: { capture: captureCalToken },
  leumi: { plan: (scraper) => ({ ...libraryPlan(scraper), loginUrl: LEUMI_LOGON_URL }) },
  // The URL can match before the account menu exists; the library's postLogin
  // waits for it (mizrahi.js L36, L182) and fetchData clicks it first (L196).
  mizrahi: { ready: (page) => hasElement(page, "#dropdownBasic") },
  // Its success URL is the public home page; the download needs the token the
  // login stores (behatsdaa.js L56, L73). Only its presence is read.
  behatsdaa: { ready: async (page) => (await page.evaluate("Boolean(localStorage.getItem('userToken'))")) === true },
  isracard: { plan: isracardAmexPlan },
  amex: { plan: isracardAmexPlan },
};

async function selfLogin(
  scraper: LibraryScraper,
  login: ProviderLogin,
  hooks: SelfLoginHooks,
): Promise<ScraperScrapingResult> {
  const page = scraper.page;
  let capture: Capture | undefined;
  try {
    const plan = login.plan ? login.plan(scraper) : libraryPlan(scraper);
    capture = login.capture?.(scraper);
    if (plan.userAgent) await page.setUserAgent(plan.userAgent);
    // The library fixes a 1024x768 viewport; give the user a normal window instead.
    await page.setViewport(null);
    await scraper.navigateTo(plan.loginUrl, plan.waitUntil);
    hooks.onWaitingForLogin();
    await waitForLogin(page, plan.success, hooks.stopped, hooks.loginTimeoutMs, hooks.pollMs, login.ready);
    capture?.loggedIn();
    hooks.onLoggedIn();
    return { success: true };
  } catch (e) {
    hooks.onLoginFailed(codeForThrown(e));
    return { success: false, errorType: ScraperErrorTypes.General };
  } finally {
    capture?.dispose();
  }
}

export interface LibraryOptionsInput {
  context: BrowserContext;
  preparePage: (page: Page) => Promise<void>;
  startDate: Date;
}

/** The only options we hand the library. No credentials, screenshots, raw data or verbose logs. */
export function libraryOptions(provider: EnabledProviderId, input: LibraryOptionsInput): ScraperOptions {
  return {
    companyId: CompanyTypes[provider],
    startDate: input.startDate,
    browserContext: input.context,
    preparePage: input.preparePage,
    combineInstallments: false,
    verbose: false,
    includeRawTransaction: false,
  };
}

/**
 * With DEBUG set, the library's `debug` logger prints whole API responses,
 * transactions included (visa-cal.js fetchData). Switch it off for the
 * instance the library itself resolves.
 */
export function silenceLibraryDebugLog(): void {
  const libraryRequire = createRequire(cjsRequire.resolve("israeli-bank-scrapers"));
  (libraryRequire("debug") as { disable(): string }).disable();
}

/**
 * The library's scraper for the company (its factory), changed on the
 * instance only: login() waits for the user instead of filling the form, and
 * terminate() tells us before the library closes its tab
 * (base-scraper-with-browser.js L94, L258).
 */
export function createSelfLoginScraper(
  provider: EnabledProviderId,
  input: LibraryOptionsInput,
  hooks: SelfLoginHooks,
): SelfLoginScraper {
  if (!isEnabledProvider(provider)) throw new CodedError("BAD_REQUEST");
  silenceLibraryDebugLog();
  const created: unknown = createLibraryScraper(libraryOptions(provider, input));
  // A scraper without a browser logs in from Node with the password: never ours.
  if (!(created instanceof BaseScraperWithBrowser)) throw new CodedError("BAD_REQUEST");
  const scraper = created as unknown as LibraryScraper;
  const login = PROVIDER_LOGIN[provider];
  const terminate = scraper.terminate.bind(scraper);
  scraper.terminate = async (success) => {
    hooks.onFinishing?.();
    await terminate(success);
  };
  scraper.login = () => selfLogin(scraper, login, hooks);
  return { scrape: () => scraper.scrape(NO_CREDENTIALS) };
}
