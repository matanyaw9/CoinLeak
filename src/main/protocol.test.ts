// The app:// file server with Electron mocked: only our host, only files
// inside the built folder, and every page carries the strict CSP header.

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CSP_PROD } from "./policy";

type FileHandler = (request: { url: string }) => Promise<Response>;

const electron = vi.hoisted(() => ({
  handlers: new Map<string, unknown>(),
  schemes: [] as unknown[],
}));

vi.mock("electron", () => ({
  protocol: {
    handle: (scheme: string, handler: unknown) => electron.handlers.set(scheme, handler),
    registerSchemesAsPrivileged: (schemes: unknown[]) => electron.schemes.push(...schemes),
  },
}));

const { registerAppScheme, serveAppFiles } = await import("./protocol");

let serve: FileHandler;

beforeAll(() => {
  // A built folder with a page and a script, and a secret next to it.
  const top = mkdtempSync(join(tmpdir(), "coinleak-protocol-"));
  const root = join(top, "renderer");
  mkdirSync(join(root, "assets"), { recursive: true });
  writeFileSync(join(root, "index.html"), "<p>page</p>");
  writeFileSync(join(root, "assets", "app.js"), "run()");
  writeFileSync(join(top, "secret.txt"), "do not serve");
  mkdirSync(join(top, "renderer-evil"));
  writeFileSync(join(top, "renderer-evil", "x.js"), "evil()");
  serveAppFiles(root);
  serve = electron.handlers.get("app") as FileHandler;
});

describe("registerAppScheme", () => {
  it("makes app:// a standard, secure scheme", () => {
    registerAppScheme();
    expect(electron.schemes).toEqual([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
  });
});

describe("serveAppFiles", () => {
  it("serves the page with the strict CSP and no sniffing", async () => {
    const res = await serve({ url: "app://coinleak/" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<p>page</p>");
    expect(res.headers.get("Content-Security-Policy")).toBe(CSP_PROD);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  });

  it("serves files inside the folder with their type and the CSP", async () => {
    const res = await serve({ url: "app://coinleak/assets/app.js" });
    expect(await res.text()).toBe("run()");
    expect(res.headers.get("Content-Type")).toBe("text/javascript; charset=utf-8");
    expect(res.headers.get("Content-Security-Policy")).toBe(CSP_PROD);
  });

  it("refuses any other host", async () => {
    const res = await serve({ url: "app://evil/index.html" });
    expect(res.status).toBe(404);
  });

  it("never serves a file outside the folder, however the path is written", async () => {
    for (const url of [
      "app://coinleak/%2e%2e/secret.txt",
      "app://coinleak/assets/%2e%2e/%2e%2e/secret.txt",
      "app://coinleak/..%2fsecret.txt",
      "app://coinleak/%2e%2e%2fsecret.txt",
      "app://coinleak/..%5csecret.txt",
      "app://coinleak/%2e%2e/renderer-evil/x.js",
    ]) {
      const res = await serve({ url });
      expect(res.status, url).toBe(404);
      expect(await res.text(), url).toBe("Not found");
    }
  });

  it("answers a missing file with 404", async () => {
    expect((await serve({ url: "app://coinleak/nope.js" })).status).toBe(404);
  });
});
