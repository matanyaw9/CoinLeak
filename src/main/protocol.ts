// Serves the built window files from app://coinleak/ instead of file://,
// so the page has a real origin and a strict CSP header.

import { protocol } from "electron";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { APP_HOST, APP_SCHEME, CSP_PROD } from "./policy";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

/** Must run before the app is ready. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);
}

export function serveAppFiles(rootDir: string): void {
  const root = resolve(rootDir);
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) return new Response("Not found", { status: 404 });
    const path = decodeURIComponent(url.pathname);
    const file = resolve(root, `.${path === "/" ? "/index.html" : path}`);
    if (!file.startsWith(root + sep)) return new Response("Not found", { status: 404 });
    try {
      const body = await readFile(file);
      return new Response(body, {
        headers: {
          "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
          "Content-Security-Policy": CSP_PROD,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}
