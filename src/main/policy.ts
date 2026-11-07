// Pure security decisions for the app window, kept free of Electron imports
// so they can be unit tested. security.ts applies them.

export const APP_SCHEME = "app";
export const APP_HOST = "coinleak";
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

/** Production page policy: our own files only, nothing remote, no eval. */
export const CSP_PROD = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join("; ");

/** Dev only: Vite's hot reload needs inline scripts and a websocket. */
export function cspDev(devServerUrl: string): string {
  const http = new URL(devServerUrl);
  const ws = `ws://${http.host}`;
  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline' ${http.origin}`,
    `style-src 'self' 'unsafe-inline' ${http.origin}`,
    `img-src 'self' data: ${http.origin}`,
    `font-src 'self' data: ${http.origin}`,
    `connect-src 'self' ${http.origin} ${ws}`,
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join("; ");
}

/** True when `url` is one of our own pages (the window may show it). */
export function isAppUrl(url: string, devServerUrl?: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol === `${APP_SCHEME}:` && u.host === APP_HOST) return true;
  if (devServerUrl) return u.origin === new URL(devServerUrl).origin;
  return false;
}

/**
 * True when the app window may load `url` at all. The window never talks to
 * the internet: only our own files, devtools, and in dev the Vite server.
 */
export function isAllowedRequest(url: string, devServerUrl?: string): boolean {
  if (isAppUrl(url, devServerUrl)) return true;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol === "devtools:" || u.protocol === "data:") return true;
  if (devServerUrl && u.protocol === "ws:") return u.host === new URL(devServerUrl).host;
  return false;
}
