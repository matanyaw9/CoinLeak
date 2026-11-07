// Choosing the sync browser, with the file system faked.

import { describe, expect, it } from "vitest";
import { CodedError } from "@shared/errors";
import { browserCandidates, findBrowser, type BrowserProbe } from "./find-browser";

function probe(existing: Record<string, string>): BrowserProbe {
  return {
    isExecutable: async (p) => p in existing,
    resolve: async (p) => existing[p] ?? p,
  };
}

describe("browserCandidates", () => {
  it("prefers Chrome, then Edge, on Windows", () => {
    const list = browserCandidates("win32", {
      PROGRAMFILES: "C:\\Program Files",
      "PROGRAMFILES(X86)": "C:\\Program Files (x86)",
      LOCALAPPDATA: "C:\\Users\\me\\AppData\\Local",
    });
    expect(list[0]).toBe("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe");
    expect(list).toContain("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe");
    expect(list.findIndex((p) => p.endsWith("msedge.exe"))).toBeGreaterThan(
      list.findLastIndex((p) => p.endsWith("chrome.exe")),
    );
  });

  it("lists Chrome, Chromium and Edge on Linux", () => {
    const list = browserCandidates("linux", {});
    expect(list).toContain("/usr/bin/google-chrome-stable");
    expect(list).toContain("/usr/bin/chromium-browser");
    expect(list).toContain("/usr/bin/microsoft-edge-stable");
  });
});

describe("findBrowser", () => {
  it("uses COINLEAK_CHROME when set", async () => {
    const path = await findBrowser({ COINLEAK_CHROME: "/opt/cft/chrome" }, "linux", probe({ "/opt/cft/chrome": "/opt/cft/chrome" }));
    expect(path).toBe("/opt/cft/chrome");
  });

  it("fails with BROWSER_MISSING when COINLEAK_CHROME points nowhere, without falling back", async () => {
    const err = await findBrowser(
      { COINLEAK_CHROME: "/nope" },
      "linux",
      probe({ "/usr/bin/chromium": "/usr/bin/chromium" }),
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CodedError);
    expect((err as CodedError).code).toBe("BROWSER_MISSING");
  });

  it("picks the first installed system browser", async () => {
    const path = await findBrowser({}, "linux", probe({ "/usr/bin/chromium-browser": "/usr/lib64/chromium-browser/chromium-browser" }));
    expect(path).toBe("/usr/bin/chromium-browser");
  });

  it("skips snap browsers, whose private /tmp would keep the profile", async () => {
    const path = await findBrowser(
      {},
      "linux",
      probe({ "/usr/bin/chromium": "/snap/bin/chromium", "/usr/bin/microsoft-edge": "/opt/microsoft/msedge/msedge" }),
    );
    expect(path).toBe("/usr/bin/microsoft-edge");
  });

  it("fails with BROWSER_MISSING when nothing is installed", async () => {
    await expect(findBrowser({}, "linux", probe({}))).rejects.toMatchObject({ code: "BROWSER_MISSING" });
  });
});
