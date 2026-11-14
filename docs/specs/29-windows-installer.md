# 29 Windows installer (wave 10)

## Goal

A Windows installer the owner can hand to his brother today: double
click, install, open CoinLeak from the Start menu, sync with Edge. Part
of F55 (`docs/FEATURES.md`). Linux packaging is a bonus only if it falls
out of the same config for free.

## Owns

- `package.json`: build config, new scripts (`dist:win`, and `dist:linux`
  only if free), the one new dev dependency below
- a new `electron-builder.yml` (or the `build` key in `package.json`)
- `build/**` (icons: add `icon.ico` rendered from `build/icon.svg`;
  extend `scripts/make-icons.sh` if needed)
- `scripts/**`: a new fuses step if electron-builder's own `electronFuses`
  option is not enough
- `src/main/index.ts`: only the window icon path for packaged builds
  (see `docs/BACKLOG.md`, "The window icon path assumes `build/` sits
  next to `out/`") and nothing in `webPreferences`
- `src/main/sync/**`: only browser discovery, if Windows paths are missing
- `.github/workflows/**`: optional Windows build job, manual trigger only
- `README.md`: an "Install on Windows" section; `docs/RELEASE.md` (new)

Do not touch core, the renderer, or the security files. Do not add an
auto-updater (F28 says no).

Read first: `AGENTS.md`, `REQUIREMENTS.md` section 3 (fuses) and the
"Which Chromium?" answer in section 9, `src/main/index.ts`, how the sync
finds the system browser (`COINLEAK_CHROME`).

## Build

1. **Tool.** `electron-builder`, one exact version at least two weeks old
   (`npm install -D --before=<two weeks ago> --save-exact`). Install
   scripts stay off; note any extra setup step in the README.
2. **Windows target.** NSIS installer, per-user install (no admin
   prompt), Start menu and desktop shortcuts, app name CoinLeak, icon from
   `build/`. `wine` is installed on the owner's Linux machine, so
   `npm run dist:win` must build the `.exe` from Linux. Output under
   `release/` (add it to `.gitignore`).
3. **Fuses** (REQUIREMENTS section 3): RunAsNode off,
   EnableNodeOptionsEnvironmentVariable off,
   EnableNodeCliInspectArguments off, asar integrity validation on,
   OnlyLoadAppFromAsar on. Verify them on the built binary
   (`npx @electron/fuses read --app <exe>` or the builder's log) and put
   the output in your report.
4. **What ships.** Only `out/**`, `build/` icons the app needs at
   runtime, and production dependencies. Puppeteer must not download a
   bundled Chromium (the app uses the system browser); confirm no
   Chromium download lands in the package. `node:sqlite` is built into
   Electron's Node: confirm no native module needs rebuilding.
5. **Windows runtime checks** (by reading the code; we cannot run Windows
   here): the data folder is under `%APPDATA%` via `app.getPath`, file
   modes like `0o600` do not throw on Windows, the sync finds Edge at its
   standard paths (`Program Files (x86)\Microsoft\Edge\Application\
   msedge.exe` and `Program Files\...`) and Chrome when present, paths are
   joined with `node:path`, nothing assumes `/`. Fix what is missing within
   Owns; list anything outside Owns in your report.
6. **Unsigned.** No code-signing certificate. `docs/RELEASE.md` explains
   in plain words what the brother sees ("Windows protected your PC" ->
   "More info" -> "Run anyway") and how to make a build.

## Tests (definition of done)

- `npm run check` green (the packaged build must not break it).
- `npm run dist:win` produces `release/CoinLeak-Setup-<version>.exe` on
  Linux. Report its size and the fuse readout.
- Unit tests for any browser-discovery change (Windows paths, faked).
- The installed app's window icon path works when packaged (by reading
  the resolved path logic; test it if it is a function).

## Report

Tool version and why, the build command, output file, fuse readout,
Windows code issues found and fixed, anything outside Owns, doubts.
