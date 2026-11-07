// The allowlist: bank hosts pass, look-alikes and everything else are blocked.

import { describe, expect, it } from "vitest";
import { BlockedCounter, blockedLabel, hostResolverRules, isAllowedUrl } from "./allowlist";

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
