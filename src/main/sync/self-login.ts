// Self-login on israeli-bank-scrapers 6.12.2: its Discount and Cal classes with
// login() replaced (open the page, wait for the user), then its own download.
// Every use of library internals lives in this file. Recheck it on upgrade.

import { createRequire } from "node:module";
import type { BrowserContext, HTTPRequest, Page, PuppeteerLifeCycleEvent } from "puppeteer";
import type { ScraperOptions, ScraperScrapingResult } from "israeli-bank-scrapers";
import type * as BaseModule from "israeli-bank-scrapers/lib/scrapers/base-scraper-with-browser.js";
import type * as DefinitionsModule from "israeli-bank-scrapers/lib/definitions.js";
import type * as DiscountModule from "israeli-bank-scrapers/lib/scrapers/discount.js";
import type * as ErrorsModule from "israeli-bank-scrapers/lib/scrapers/errors.js";
import type * as VisaCalModule from "israeli-bank-scrapers/lib/scrapers/visa-cal.js";
import { CodedError, type ErrorCode } from "@shared/errors";
import type { ProviderId } from "@shared/types";
import { codeForThrown } from "./errors";

// The library is CommonJS without an exports map; require keeps its default
// exports intact in Node, Electron, vitest and tsx alike.
const require = createRequire(import.meta.url);
const { LoginResults } = require("israeli-bank-scrapers/lib/scrapers/base-scraper-with-browser.js") as typeof BaseModule;
const { CompanyTypes } = require("israeli-bank-scrapers/lib/definitions.js") as typeof DefinitionsModule;
const { ScraperErrorTypes } = require("israeli-bank-scrapers/lib/scrapers/errors.js") as typeof ErrorsModule;
const DiscountScraper = (require("israeli-bank-scrapers/lib/scrapers/discount.js") as typeof DiscountModule).default;
const VisaCalScraper = (require("israeli-bank-scrapers/lib/scrapers/visa-cal.js") as typeof VisaCalModule).default;

export const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_MS = 500;

/** Copy of the library's SSO_AUTHORIZATION_REQUEST_ENDPOINT (visa-cal.js, 6.12.2). */
export const CAL_SSO_URL = "https://connect.cal-online.co.il/col-rest/calconnect/authentication/SSO";

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
  loginTimeoutMs?: number;
  pollMs?: number;
}

export interface SelfLoginScraper {
  scrape(): Promise<ScraperScrapingResult>;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Polls the tab's URL until it matches the provider's success result. */
export async function waitForLogin(
  page: Page,
  conditions: readonly SuccessCondition[],
  stopped: Promise<never>,
  timeoutMs = LOGIN_TIMEOUT_MS,
  pollMs = POLL_MS,
): Promise<void> {
  if (conditions.length === 0) throw new CodedError("BANK_CHANGED");
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const url = page.url();
    for (const condition of conditions) {
      if (await matches(condition, url, page)) return;
    }
    const left = deadline - Date.now();
    if (left <= 0) throw new CodedError("LOGIN_TIMEOUT");
    await Promise.race([sleep(Math.min(pollMs, left)), stopped]);
  }
}

type Navigate = (url: string, waitUntil?: PuppeteerLifeCycleEvent) => Promise<void>;

async function selfLogin(
  page: Page,
  options: LoginOptions,
  navigate: Navigate,
  hooks: SelfLoginHooks,
): Promise<ScraperScrapingResult> {
  try {
    // Same user agent the library's own login() sets, so tokens match its API calls.
    if (options.userAgent) await page.setUserAgent(options.userAgent);
    // The library fixes a 1024x768 viewport; give the user a normal window instead.
    await page.setViewport(null);
    await navigate(options.loginUrl, options.waitUntil);
    hooks.onWaitingForLogin();
    const success = options.possibleResults[LoginResults.Success] ?? [];
    await waitForLogin(page, success, hooks.stopped, hooks.loginTimeoutMs, hooks.pollMs);
    hooks.onLoggedIn();
    return { success: true };
  } catch (e) {
    hooks.onLoginFailed(codeForThrown(e));
    return { success: false, errorType: ScraperErrorTypes.General };
  }
}

class DiscountSelfLogin extends DiscountScraper {
  readonly #hooks: SelfLoginHooks;

  constructor(options: ScraperOptions, hooks: SelfLoginHooks) {
    super(options);
    this.#hooks = hooks;
  }

  override async login(): Promise<ScraperScrapingResult> {
    const navigate: Navigate = (url, waitUntil) => this.navigateTo(url, waitUntil);
    return selfLogin(this.page, this.getLoginOptions(NO_CREDENTIALS), navigate, this.#hooks);
  }
}

class VisaCalSelfLogin extends VisaCalScraper {
  readonly #hooks: SelfLoginHooks;

  constructor(options: ScraperOptions, hooks: SelfLoginHooks) {
    super(options);
    this.#hooks = hooks;
  }

  override async login(): Promise<ScraperScrapingResult> {
    // The library's own postAction reads the Authorization header of the SSO
    // request made while logging in. Capture it the same way; if it is empty,
    // the library falls back to the token in sessionStorage ("auth-module").
    let token = "";
    const onRequest = (request: HTTPRequest): void => {
      if (request.url() !== CAL_SSO_URL) return;
      token = String(request.headers()["authorization"] ?? "").trim() || token;
    };
    this.page.on("request", onRequest);
    try {
      const navigate: Navigate = (url, waitUntil) => this.navigateTo(url, waitUntil);
      const result = await selfLogin(this.page, this.getLoginOptions(NO_CREDENTIALS), navigate, this.#hooks);
      // `authorization` is private in the library's types; same field its postAction sets.
      if (result.success && token) (this as unknown as { authorization?: string }).authorization = token;
      return result;
    } finally {
      this.page.off("request", onRequest);
    }
  }
}

export interface LibraryOptionsInput {
  context: BrowserContext;
  preparePage: (page: Page) => Promise<void>;
  startDate: Date;
}

/** The only options we hand the library. No credentials, screenshots, raw data or verbose logs. */
export function libraryOptions(provider: ProviderId, input: LibraryOptionsInput): ScraperOptions {
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
  const libraryRequire = createRequire(require.resolve("israeli-bank-scrapers"));
  (libraryRequire("debug") as { disable(): string }).disable();
}

export function createSelfLoginScraper(
  provider: ProviderId,
  input: LibraryOptionsInput,
  hooks: SelfLoginHooks,
): SelfLoginScraper {
  silenceLibraryDebugLog();
  const options = libraryOptions(provider, input);
  const scraper = provider === "discount" ? new DiscountSelfLogin(options, hooks) : new VisaCalSelfLogin(options, hooks);
  return { scrape: () => scraper.scrape(NO_CREDENTIALS) };
}
