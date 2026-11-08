// The allowlist: bank hosts pass, look-alikes and everything else are blocked.

import { describe, expect, it } from "vitest";
import { ENABLED_PROVIDERS, providerInfo, type EnabledProviderId } from "@shared/providers";
import { ALLOWED_HOSTS, BlockedCounter, blockedLabel, hostResolverRules, isAllowedUrl, THIRD_PARTY } from "./allowlist";

describe("allowlist: discount", () => {
  it.each([
    "https://start.telebank.co.il/login/#/LOGIN_PAGE",
    "https://start.telebank.co.il/Titan/gatewayAPI/userAccountsData",
    "https://telebank.co.il/",
    "https://www.discountbank.co.il/",
    "https://discountbank.co.il/x?y=1",
    "https://START.TELEBANK.CO.IL/",
  ])("allows bank host %s", (url) => {
    expect(isAllowedUrl("discount", url)).toBe(true);
  });

  it.each([
    "https://discountbank.co.il.evil.com/",
    "https://evil-discountbank.co.il/",
    "https://evildiscountbank.co.il/",
    "https://telebank.co.il.evil.com/login",
    "https://xtelebank.co.il/",
    "https://discountbank.co.il@evil.com/",
    "https://evil.com/?u=https://start.telebank.co.il/",
    "https://evil.com/start.telebank.co.il",
    "https://www.googletagmanager.com/gtm.js",
    "https://www.google-analytics.com/collect",
    "https://awa-eucn1-1.advanced-web-analytics.com/",
    "https://www.cal-online.co.il/",
    "https://1.1.1.1/",
    "https://[::1]/",
    "http://start.telebank.co.il/",
    "https://start.telebank.co.il:8443/",
    "wss://start.telebank.co.il/",
    "chrome-extension://invalid/",
    "file:///etc/passwd",
    "not a url",
    "",
  ])("blocks %s", (url) => {
    expect(isAllowedUrl("discount", url)).toBe(false);
  });
});

describe("allowlist: visaCal", () => {
  it.each([
    "https://www.cal-online.co.il/",
    "https://connect.cal-online.co.il/col-rest/calconnect/authentication/SSO",
    "https://digital-web.cal-online.co.il/dashboard",
    "https://api.cal-online.co.il/Transactions/api/transactionsDetails/getCardTransactionsDetails",
  ])("allows card host %s", (url) => {
    expect(isAllowedUrl("visaCal", url)).toBe(true);
  });

  it.each([
    "https://cal-online.co.il.evil.com/",
    "https://evil-cal-online.co.il/",
    "https://start.telebank.co.il/",
    "https://connect.facebook.net/en_US/fbevents.js",
    "https://googleads.g.doubleclick.net/pagead/",
  ])("blocks %s", (url) => {
    expect(isAllowedUrl("visaCal", url)).toBe(false);
  });
});

describe("allowlist: every enabled provider", () => {
  const cases = ENABLED_PROVIDERS.flatMap((p) => ALLOWED_HOSTS[p].map((suffix) => [p, suffix] as const));

  it("has at least one host for every enabled provider, and its login site is on it", () => {
    for (const provider of ENABLED_PROVIDERS) {
      expect(ALLOWED_HOSTS[provider].length, provider).toBeGreaterThan(0);
      expect(isAllowedUrl(provider, `https://${providerInfo(provider).site}/`), provider).toBe(true);
    }
  });

  it.each(cases)("%s allows its own host %s and its subdomains", (provider, suffix) => {
    expect(isAllowedUrl(provider, `https://${suffix}/`)).toBe(true);
    expect(isAllowedUrl(provider, `https://www.${suffix}/login?x=1`)).toBe(true);
    expect(isAllowedUrl(provider, `https://a.b.${suffix.toUpperCase()}/`)).toBe(true);
  });

  it.each(cases)("%s blocks look-alikes of %s", (provider, suffix) => {
    const [label] = suffix.split(".");
    for (const url of [
      `https://${suffix}.evil.com/`,
      `https://evil-${suffix}/`,
      `https://evil${suffix}/`,
      `https://${label}.co.il.evil.com/`,
      `https://${suffix}@evil.com/`,
      `https://evil.com/?u=https://${suffix}/`,
      `https://evil.com/${suffix}`,
      `http://${suffix}/`,
      `https://${suffix}:8443/`,
      `wss://${suffix}/`,
    ]) {
      expect(isAllowedUrl(provider, url), url).toBe(false);
    }
  });

  it.each(ENABLED_PROVIDERS)("%s blocks every other provider's hosts and the usual trackers", (provider) => {
    const mine = new Set(ALLOWED_HOSTS[provider]);
    const others = ENABLED_PROVIDERS.flatMap((p) => ALLOWED_HOSTS[p]).filter((s) => !mine.has(s));
    for (const host of [...others, "www.googletagmanager.com", "www.google-analytics.com", "connect.facebook.net"]) {
      expect(isAllowedUrl(provider, `https://${host}/`), host).toBe(false);
    }
    expect(isAllowedUrl(provider, "https://www.google.com/pagead/1p-user-list/1/")).toBe(false);
  });
});

describe("third-party captcha, path by path", () => {
  const withCaptcha = Object.keys(THIRD_PARTY) as EnabledProviderId[];

  it("is given only to providers whose login page runs reCAPTCHA", () => {
    expect(withCaptcha.sort()).toEqual(["amex", "behatsdaa", "isracard"]);
  });

  it.each(withCaptcha)("%s may load reCAPTCHA and nothing else from Google", (provider) => {
    for (const url of [
      "https://www.google.com/recaptcha/api.js",
      "https://www.google.com/recaptcha/api2/anchor?k=x",
      "https://www.gstatic.com/recaptcha/releases/abc/recaptcha__en.js",
    ]) {
      expect(isAllowedUrl(provider, url), url).toBe(true);
    }
    for (const url of [
      "https://www.google.com/",
      "https://www.google.com/pagead/1p-user-list/1/",
      "https://www.google.com/rmkt/collect/1/",
      "https://www.google.com/recaptcha/../pagead/x",
      "https://www.google.com/recaptcha/%2e%2e/ccm/collect",
      "https://www.google.com/RECAPTCHA/api.js",
      "https://google.com/recaptcha/api.js",
      "https://evil.google.com/recaptcha/api.js",
      "https://www.google.com.evil.com/recaptcha/api.js",
      "https://www.recaptcha.net/recaptcha/api.js",
      "https://fonts.gstatic.com/s/roboto.woff2",
      "http://www.google.com/recaptcha/api.js",
    ]) {
      expect(isAllowedUrl(provider, url), url).toBe(false);
    }
  });

  it("is not given to banks that do not need it", () => {
    for (const provider of ENABLED_PROVIDERS.filter((p) => !withCaptcha.includes(p))) {
      expect(isAllowedUrl(provider, "https://www.google.com/recaptcha/api.js"), provider).toBe(false);
    }
  });

  it("lets the captcha hosts resolve exactly, without their other subdomains", () => {
    const rules = hostResolverRules("isracard");
    expect(rules).toContain("EXCLUDE www.google.com");
    expect(rules).toContain("EXCLUDE www.gstatic.com");
    expect(rules).not.toContain("*.google.com");
    expect(rules).not.toContain("*.gstatic.com");
    expect(hostResolverRules("hapoalim")).not.toContain("google");
  });

  it("blocks Isracard's automation detector even on its own host, as the library does", () => {
    for (const provider of ["isracard", "amex"] as const) {
      expect(isAllowedUrl(provider, "https://digital.isracard.co.il/gb-isracard/js-glassbox/prod/detector-dom.min.js")).toBe(
        false,
      );
    }
    expect(isAllowedUrl("isracard", "https://digital.isracard.co.il/personalarea/Login")).toBe(true);
  });
});

describe("local schemes", () => {
  it.each(["data:text/plain,hi", "blob:https://www.cal-online.co.il/abc", "about:blank"])(
    "allows %s (never leaves the machine)",
    (url) => {
      expect(isAllowedUrl("visaCal", url)).toBe(true);
    },
  );
});

describe("blocked counting", () => {
  it("counts by host only, never path or query", () => {
    const counter = new BlockedCounter();
    counter.add("https://www.google-analytics.com/j/collect?cid=123&uid=secret");
    counter.add("https://www.google-analytics.com/other");
    counter.add("https://evil.com/");
    counter.add("chrome-extension://invalid/");
    counter.add("::nonsense::");
    const snap = counter.snapshot();
    expect(snap).toEqual({
      "evil.com": 1,
      invalid: 1,
      "invalid-url": 1,
      "www.google-analytics.com": 2,
    });
    expect(JSON.stringify(snap)).not.toContain("secret");
  });

  it("labels a hostless URL by its scheme", () => {
    expect(blockedLabel("data:text/plain,x")).toBe("data:");
  });
});

describe("host resolver rules", () => {
  it("maps everything to NOTFOUND except the provider's suffixes", () => {
    expect(hostResolverRules("discount")).toBe(
      "MAP * ~NOTFOUND, EXCLUDE telebank.co.il, EXCLUDE *.telebank.co.il, " +
        "EXCLUDE discountbank.co.il, EXCLUDE *.discountbank.co.il",
    );
    expect(hostResolverRules("visaCal")).toBe(
      "MAP * ~NOTFOUND, EXCLUDE cal-online.co.il, EXCLUDE *.cal-online.co.il",
    );
  });
});
