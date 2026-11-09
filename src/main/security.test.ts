// The window security wiring with Electron mocked: every permission is
// denied, remote requests are cancelled, and windows can neither open new
// windows nor navigate away from our own pages.

import { afterEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => ({ appListeners: new Map<string, (...args: unknown[]) => void>() }));

vi.mock("electron", () => ({
  app: { on: (name: string, listener: (...args: unknown[]) => void) => electron.appListeners.set(name, listener) },
}));

const { hardenAllWebContents, hardenSession } = await import("./security");

const DEV = "http://localhost:5173/";

/** A fake session that keeps every callback security.ts hands it. */
function fakeSession() {
  const got: Record<string, (...args: never[]) => unknown> = {};
  const keep = (name: string) => (fn: (...args: never[]) => unknown) => (got[name] = fn);
  const ses = {
    setPermissionRequestHandler: keep("permissionRequest"),
    setPermissionCheckHandler: keep("permissionCheck"),
    setDevicePermissionHandler: keep("devicePermission"),
    webRequest: { onBeforeRequest: keep("beforeRequest"), onHeadersReceived: keep("headersReceived") },
  };
  return { ses: ses as never, got };
}

/** Runs `web-contents-created` on a fake window and returns its handlers. */
function fakeContents(devServerUrl?: string) {
  electron.appListeners.clear();
  hardenAllWebContents(devServerUrl);
  const on = new Map<string, (event: { preventDefault: () => void }, url?: string) => void>();
  let openHandler: (() => { action: string }) | undefined;
  const contents = {
    setWindowOpenHandler: (fn: () => { action: string }) => (openHandler = fn),
    on: (name: string, fn: (event: { preventDefault: () => void }, url?: string) => void) => on.set(name, fn),
  };
  electron.appListeners.get("web-contents-created")?.({}, contents);
  /** True when the handler blocked the event. */
  const blocked = (name: string, url?: string): boolean => {
    const preventDefault = vi.fn();
    on.get(name)?.({ preventDefault }, url);
    return preventDefault.mock.calls.length > 0;
  };
  return { openHandler, blocked, events: [...on.keys()] };
}

afterEach(() => vi.restoreAllMocks());

describe("hardenSession", () => {
  it("denies every permission request, check and device", () => {
    const { ses, got } = fakeSession();
    hardenSession(ses);
    for (const permission of ["media", "geolocation", "notifications", "clipboard-read"]) {
      const callback = vi.fn();
      (got["permissionRequest"] as (wc: unknown, p: string, cb: (ok: boolean) => void) => void)({}, permission, callback);
      expect(callback).toHaveBeenCalledWith(false);
    }
    expect((got["permissionCheck"] as () => boolean)()).toBe(false);
    expect((got["devicePermission"] as () => boolean)()).toBe(false);
  });

  it("cancels remote requests and logs the kind only, never the address", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { ses, got } = fakeSession();
    hardenSession(ses);
    const request = got["beforeRequest"] as (d: { url: string; resourceType: string }, cb: (r: { cancel: boolean }) => void) => void;
    const answer = (url: string) => {
      const callback = vi.fn();
      request({ url, resourceType: "script" }, callback);
      return callback.mock.calls[0]?.[0];
    };
    expect(answer("app://coinleak/index.html")).toEqual({ cancel: false });
    expect(answer("https://fonts.googleapis.com/css?family=secret")).toEqual({ cancel: true });
    expect(answer("http://127.0.0.1:41234/api")).toEqual({ cancel: true });
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.flat().join(" ")).not.toMatch(/googleapis|127\.0\.0\.1|secret/);
  });

  it("adds the dev CSP header only with a dev server", () => {
    const prod = fakeSession();
    hardenSession(prod.ses);
    expect(prod.got["headersReceived"]).toBeUndefined();

    const dev = fakeSession();
    hardenSession(dev.ses, DEV);
    const callback = vi.fn();
    (dev.got["headersReceived"] as (d: unknown, cb: (r: unknown) => void) => void)({ responseHeaders: { A: ["1"] } }, callback);
    const headers = (callback.mock.calls[0]?.[0] as { responseHeaders: Record<string, string[]> }).responseHeaders;
    expect(headers["A"]).toEqual(["1"]);
    expect(headers["Content-Security-Policy"]?.[0]).toContain("default-src 'none'");
  });
});

describe("hardenAllWebContents", () => {
  it("denies every new window", () => {
    const { openHandler } = fakeContents();
    expect(openHandler?.()).toEqual({ action: "deny" });
  });

  it("blocks navigation and redirects away from our own pages", () => {
    const { blocked } = fakeContents();
    for (const event of ["will-navigate", "will-redirect"]) {
      expect(blocked(event, "app://coinleak/index.html#/home")).toBe(false);
      expect(blocked(event, "https://evil.example/")).toBe(true);
      expect(blocked(event, "file:///etc/passwd")).toBe(true);
      expect(blocked(event, DEV)).toBe(true);
    }
  });

  it("allows the dev server only in dev runs", () => {
    const { blocked } = fakeContents(DEV);
    expect(blocked("will-navigate", `${DEV}#/transactions`)).toBe(false);
    expect(blocked("will-navigate", "https://evil.example/")).toBe(true);
  });

  it("blocks every webview", () => {
    const { blocked, events } = fakeContents();
    expect(events).toEqual(expect.arrayContaining(["will-navigate", "will-redirect", "will-attach-webview"]));
    expect(blocked("will-attach-webview")).toBe(true);
  });
});
