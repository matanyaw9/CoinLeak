// The fixed links (F27, F28): each name opens its one GitHub page, and
// nothing else gets through, not even a GitHub address.

import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ shell: { openExternal: vi.fn() } }));

import { LINKS, openAppLink } from "./links";

const code = async (p: Promise<unknown>) => p.then(() => undefined, (e: { code?: string }) => e.code);

describe("openAppLink", () => {
  it("opens each fixed page, and only https on github.com", async () => {
    const open = vi.fn<(url: string) => Promise<void>>(async () => undefined);
    for (const link of ["feedback", "star", "releases"] as const) await openAppLink(link, open);
    expect(open.mock.calls.map((c) => c[0])).toEqual([
      "https://github.com/matanyaw9/CoinLeak/issues/new",
      "https://github.com/matanyaw9/CoinLeak",
      "https://github.com/matanyaw9/CoinLeak/releases",
    ]);
    for (const url of Object.values(LINKS)) expect(new URL(url).origin).toBe("https://github.com");
  });

  it("refuses an address, an unknown name or a name from the object prototype", async () => {
    const open = vi.fn<(url: string) => Promise<void>>(async () => undefined);
    for (const bad of ["https://github.com/matanyaw9/CoinLeak", "file:///etc/passwd", "toString", "__proto__", "", null, 1, { link: "star" }]) {
      expect(await code(openAppLink(bad, open))).toBe("BAD_REQUEST");
    }
    expect(open).not.toHaveBeenCalled();
  });
});
