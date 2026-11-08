// The provider registry against the installed library (6.12.2) and the sync
// module: every company once, every enabled provider wired up and documented.

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { BrowserContext } from "puppeteer";
import { describe, expect, it } from "vitest";
import {
  ENABLED_PROVIDERS,
  isEnabledProvider,
  isProviderId,
  PROVIDER_IDS,
  PROVIDERS,
  providerInfo,
} from "@shared/providers";
import { ALLOWED_HOSTS } from "./allowlist";
import { HISTORY } from "./history";
import { libraryOptions } from "./self-login";

const cjsRequire = createRequire(import.meta.url);
const { CompanyTypes, SCRAPERS } = cjsRequire("israeli-bank-scrapers/lib/definitions.js") as {
  CompanyTypes: Record<string, string>;
  SCRAPERS: Record<string, { name: string }>;
};
const createScraper = (cjsRequire("israeli-bank-scrapers/lib/scrapers/factory.js") as { default: (o: unknown) => object })
  .default;
const { BaseScraperWithBrowser } = cjsRequire("israeli-bank-scrapers/lib/scrapers/base-scraper-with-browser.js") as {
  BaseScraperWithBrowser: abstract new (...args: never[]) => object;
};

const docPath = (id: string): string => join(process.cwd(), "docs", "banks", `${id}.md`);

describe("provider registry", () => {
  it("has every library CompanyTypes value exactly once", () => {
    const library = Object.values(CompanyTypes).sort();
    expect([...PROVIDER_IDS].sort()).toEqual(library);
    expect(new Set(PROVIDER_IDS).size).toBe(PROVIDER_IDS.length);
    expect(library).toHaveLength(18);
  });

  it("lists verified first, then experimental, then unsupported", () => {
    const order = { verified: 0, experimental: 1, unsupported: 2 };
    const ranks = PROVIDERS.map((p) => order[p.status]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(providerInfo("discount").status).toBe("verified");
    // Cal stays experimental until its download is confirmed live.
    expect(providerInfo("visaCal").status).toBe("experimental");
    expect(providerInfo("oneZero").status).toBe("unsupported");
  });

  it("gives every provider a name, a kind and a login site, and every unsupported one a reason", () => {
    for (const p of PROVIDERS) {
      expect(p.name.trim(), p.id).not.toBe("");
      expect(p.short.trim(), p.id).not.toBe("");
      expect(["bank", "card"], p.id).toContain(p.kind);
      expect(p.site, p.id).toMatch(/^[a-z0-9.-]+\.[a-z]+$/);
      if (p.status === "unsupported") expect(p.reason?.length, p.id).toBeGreaterThan(20);
      else expect(p.reason, p.id).toBeUndefined();
      // No em dashes anywhere, user-facing text included.
      expect(`${p.name} ${p.short} ${p.reason ?? ""}`, p.id).not.toContain("\u2014");
    }
  });

  it("knows only its own ids, prototype keys included", () => {
    for (const value of ["__proto__", "constructor", "toString", "Discount", "", 3, null, undefined]) {
      expect(isProviderId(value), String(value)).toBe(false);
      expect(isEnabledProvider(value), String(value)).toBe(false);
    }
    expect(isEnabledProvider("oneZero")).toBe(false);
    expect(isEnabledProvider("union")).toBe(false);
    expect(isEnabledProvider("hapoalim")).toBe(true);
  });

  it("gives every enabled provider an allowlist, a history window and a doc", () => {
    expect(Object.keys(ALLOWED_HOSTS).sort()).toEqual([...ENABLED_PROVIDERS].sort());
    expect(Object.keys(HISTORY).sort()).toEqual([...ENABLED_PROVIDERS].sort());
    for (const id of ENABLED_PROVIDERS) {
      expect(ALLOWED_HOSTS[id].length, id).toBeGreaterThan(0);
    }
  });

  it.each(PROVIDER_IDS)("%s has a doc in docs/banks that names its status", (id) => {
    expect(existsSync(docPath(id)), docPath(id)).toBe(true);
    const doc = readFileSync(docPath(id), "utf8");
    expect(doc).toContain(`(\`${id}\`)`);
    expect(doc.toLowerCase()).toContain(providerInfo(id).status);
    expect(doc).not.toContain("\u2014");
  });

  it.each(ENABLED_PROVIDERS)("%s: the library's scraper for it is browser-based, so self-login can drive it", (id) => {
    const scraper = createScraper(
      libraryOptions(id, { context: {} as BrowserContext, preparePage: async () => {}, startDate: new Date() }),
    );
    expect(scraper).toBeInstanceOf(BaseScraperWithBrowser);
  });

  it("One Zero logs in from Node without a browser: unsupported", () => {
    const scraper = createScraper({ companyId: "oneZero", startDate: new Date() });
    expect(scraper).not.toBeInstanceOf(BaseScraperWithBrowser);
    expect(SCRAPERS["oneZero"]?.name).toBe("One Zero");
  });
});
