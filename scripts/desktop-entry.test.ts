import { describe, expect, it } from "vitest";
import { desktopEntry, quoteArg } from "./desktop-entry";

describe("desktopEntry", () => {
  it("runs this checkout's dev build and matches the window by app id", () => {
    const text = desktopEntry({ checkout: "/home/u/CoinLeak", node: "/usr/bin/node", npmCli: "/usr/lib/npm/bin/npm-cli.js" });
    expect(text).toContain('Exec="/usr/bin/node" "/usr/lib/npm/bin/npm-cli.js" "run" "dev"\n');
    expect(text).toContain("Path=/home/u/CoinLeak\n");
    expect(text).toContain("Icon=coinleak\n");
    expect(text).toContain("StartupWMClass=coinleak\n");
    expect(text.startsWith("[Desktop Entry]\n")).toBe(true);
  });

  it("quotes Exec arguments safely", () => {
    expect(quoteArg('a "b" $c `d` \\e')).toBe('"a \\"b\\" \\$c \\`d\\` \\\\e"');
  });
});
