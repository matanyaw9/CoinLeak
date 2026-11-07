// Picks the Chromium used for syncing: the system's own Chrome, Chromium or
// Edge (kept up to date by the OS or vendor), or COINLEAK_CHROME if set.

import { constants } from "node:fs";
import { access, realpath } from "node:fs/promises";
import { win32 } from "node:path";
import { CodedError } from "@shared/errors";

type Env = Readonly<Record<string, string | undefined>>;

/** Install locations to try, best first. Pure, so it is testable per platform. */
export function browserCandidates(platform: NodeJS.Platform, env: Env): string[] {
  if (platform === "win32") {
    const roots = [env["PROGRAMFILES"], env["PROGRAMFILES(X86)"], env["LOCALAPPDATA"]].filter(
      (r): r is string => !!r,
    );
    const chrome = roots.map((r) => win32.join(r, "Google", "Chrome", "Application", "chrome.exe"));
    const edge = roots.map((r) => win32.join(r, "Microsoft", "Edge", "Application", "msedge.exe"));
    return [...chrome, ...edge];
  }
  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  }
  return [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/opt/google/chrome/chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/microsoft-edge-stable",
    "/usr/bin/microsoft-edge",
    "/opt/microsoft/msedge/msedge",
  ];
}

export interface BrowserProbe {
  isExecutable(path: string): Promise<boolean>;
  /** Resolved real path, used to skip browsers we cannot clean up after. */
  resolve(path: string): Promise<string>;
}

const nodeProbe: BrowserProbe = {
  async isExecutable(path) {
    try {
      await access(path, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  },
  resolve: (path) => realpath(path),
};

/**
 * Snap packages see a private /tmp, so the temporary profile would land
 * somewhere we cannot delete. Never use them.
 */
function isSnap(realPath: string): boolean {
  return realPath.startsWith("/snap/");
}

export async function findBrowser(
  env: Env = process.env,
  platform: NodeJS.Platform = process.platform,
  probe: BrowserProbe = nodeProbe,
): Promise<string> {
  const override = env["COINLEAK_CHROME"];
  if (override) {
    if (await probe.isExecutable(override)) return override;
    throw new CodedError("BROWSER_MISSING");
  }
  for (const candidate of browserCandidates(platform, env)) {
    if (!(await probe.isExecutable(candidate))) continue;
    const real = await probe.resolve(candidate).catch(() => candidate);
    if (!isSnap(real)) return candidate;
  }
  throw new CodedError("BROWSER_MISSING");
}
