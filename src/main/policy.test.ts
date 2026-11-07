import { describe, expect, it } from "vitest";
import { isAllowedRequest, isAppUrl } from "./policy";

const DEV = "http://localhost:5173/";

describe("isAppUrl", () => {
  it("accepts only our own origin", () => {
    expect(isAppUrl("app://coinleak/index.html")).toBe(true);
    expect(isAppUrl("app://evil/index.html")).toBe(false);
    expect(isAppUrl("https://coinleak/index.html")).toBe(false);
    expect(isAppUrl("file:///etc/passwd")).toBe(false);
    expect(isAppUrl("not a url")).toBe(false);
  });

  it("accepts the dev server only when one is given", () => {
    expect(isAppUrl("http://localhost:5173/#/x", DEV)).toBe(true);
    expect(isAppUrl("http://localhost:5173/#/x")).toBe(false);
    expect(isAppUrl("http://localhost:5174/", DEV)).toBe(false);
  });
});

describe("isAllowedRequest", () => {
  it("blocks every remote request from the app window", () => {
    for (const url of [
      "https://www.discountbank.co.il/",
      "https://fonts.googleapis.com/css",
      "http://127.0.0.1:41234/api",
      "file:///home/me/.ssh/id_rsa",
    ]) {
      expect(isAllowedRequest(url)).toBe(false);
      expect(isAllowedRequest(url, DEV)).toBe(false);
    }
  });

  it("allows our files, devtools, and the dev server socket in dev", () => {
    expect(isAllowedRequest("app://coinleak/assets/index.js")).toBe(true);
    expect(isAllowedRequest("devtools://devtools/bundled/x.html")).toBe(true);
    expect(isAllowedRequest("ws://localhost:5173/", DEV)).toBe(true);
    expect(isAllowedRequest("ws://localhost:5173/")).toBe(false);
  });
});
