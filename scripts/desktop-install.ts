// `npm run desktop:install`: puts CoinLeak's icon and a desktop entry for this
// checkout's dev run into ~/.local/share, for the current user only, so GNOME
// on Wayland shows the logo in the dock. Nothing outside the home folder.

import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { APP_ID, ICON_SIZES, desktopEntry } from "./desktop-entry";

function main(): number {
  if (process.platform !== "linux") {
    console.error("desktop:install is for Linux only.");
    return 1;
  }
  const checkout = resolve(import.meta.dirname, "..");
  const npmCli = process.env["npm_execpath"];
  if (!npmCli) {
    console.error("Run this through npm: npm run desktop:install");
    return 1;
  }
  const share = process.env["XDG_DATA_HOME"] || join(homedir(), ".local/share");

  const icons = join(share, "icons/hicolor");
  for (const size of ICON_SIZES) {
    const dir = join(icons, `${size}x${size}/apps`);
    mkdirSync(dir, { recursive: true });
    copyFileSync(join(checkout, `build/icons/${size}x${size}.png`), join(dir, `${APP_ID}.png`));
  }
  const scalable = join(icons, "scalable/apps");
  mkdirSync(scalable, { recursive: true });
  copyFileSync(join(checkout, "build/icon.svg"), join(scalable, `${APP_ID}.svg`));

  const apps = join(share, "applications");
  mkdirSync(apps, { recursive: true });
  const entry = join(apps, `${APP_ID}.desktop`);
  writeFileSync(entry, desktopEntry({ checkout, node: process.execPath, npmCli }), { mode: 0o644 });

  // Best effort: refresh the caches so the shell picks the icon up at once.
  for (const [cmd, args] of [
    ["update-desktop-database", [apps]],
    ["gtk-update-icon-cache", ["-f", "-t", icons]],
  ] as const) {
    try {
      execFileSync(cmd, [...args], { stdio: "ignore" });
    } catch {
      // Not installed or not needed: GNOME rescans on its own.
    }
  }

  console.log(`Wrote ${entry}`);
  console.log(`Wrote the icons under ${icons}`);
  console.log("Start CoinLeak from the app grid, or run `npm run dev`: the dock shows its logo.");
  return 0;
}

process.exitCode = main();
