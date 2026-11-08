// The Linux desktop entry for a dev checkout, as text. GNOME on Wayland
// matches a window to its entry by app id: Electron uses the package `name`
// ("coinleak"), so the file is coinleak.desktop with the same WM class.

export const APP_ID = "coinleak";
export const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256, 512] as const;

export interface EntryPaths {
  /** This checkout, where `npm run dev` runs. */
  checkout: string;
  /** Absolute path of the node binary. */
  node: string;
  /** Absolute path of npm's CLI script. */
  npmCli: string;
}

/** Desktop entry Exec arguments are double-quoted with \, ", ` and $ escaped. */
export function quoteArg(arg: string): string {
  return `"${arg.replace(/[\\"`$]/g, (c) => `\\${c}`)}"`;
}

export function desktopEntry({ checkout, node, npmCli }: EntryPaths): string {
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Name=CoinLeak (dev)",
    "Comment=Local-only personal finance for Israeli banks and cards",
    `Exec=${[node, npmCli, "run", "dev"].map(quoteArg).join(" ")}`,
    `Path=${checkout}`,
    `Icon=${APP_ID}`,
    `StartupWMClass=${APP_ID}`,
    "Terminal=false",
    "Categories=Office;Finance;",
    "",
  ].join("\n");
}
