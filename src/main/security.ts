// Applies the window security policy: no permissions, no navigation away,
// no new windows, no network except our own files.

import { app, type Session } from "electron";
import { cspDev, isAllowedRequest, isAppUrl } from "./policy";

export function hardenSession(ses: Session, devServerUrl?: string): void {
  ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  ses.setDevicePermissionHandler(() => false);

  ses.webRequest.onBeforeRequest((details, callback) => {
    const allowed = isAllowedRequest(details.url, devServerUrl);
    if (!allowed) console.warn(`[security] blocked a ${details.resourceType} request`);
    callback({ cancel: !allowed });
  });

  if (devServerUrl) {
    const policy = cspDev(devServerUrl);
    ses.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [policy] },
      });
    });
  }
}

export function hardenAllWebContents(devServerUrl?: string): void {
  app.on("web-contents-created", (_event, contents) => {
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-navigate", (event, url) => {
      if (!isAppUrl(url, devServerUrl)) event.preventDefault();
    });
    contents.on("will-redirect", (event, url) => {
      if (!isAppUrl(url, devServerUrl)) event.preventDefault();
    });
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });
}
