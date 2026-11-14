# Making a Windows build

CoinLeak ships to Windows as one unsigned installer,
`release/CoinLeak-Setup-<version>.exe`, built on Linux (spec 29). There is
no auto-updater (F28): a new version is a new installer, installed over the
old one. Data in `%APPDATA%\CoinLeak\data` stays.

## Build it (on Linux)

You need the normal developer setup (`npm ci`, `npm run setup`) and `wine`
(the `wine` package of your distribution).

```bash
npm run dist:win
```

This builds the app (`npm run build`), then runs `electron-builder`
with `electron-builder.yml`. The first run downloads the Windows Electron
zip and the NSIS tools into `~/.cache/electron-builder/`.

Why wine: making the NSIS uninstaller on Linux means running one small
Windows program. `scripts/dist-win.sh` gives wine its own folder
(`~/.cache/coinleak-wine`, or `COINLEAK_WINEPREFIX`), created once with the
Mono and Gecko install prompts turned off, so it never touches `~/.wine`.
Never run the built installer under wine.

No extra install step: electron-builder needs no install scripts, and the
app has no native modules to rebuild (`node:sqlite` is built into
Electron). Puppeteer's browser download never runs (install scripts are off
in `.npmrc`); the app always uses the system Edge or Chrome.

## Check it

- The output is `release/CoinLeak-Setup-<version>.exe`.
  `release/` is in `.gitignore`: never commit it.
- Fuses (REQUIREMENTS section 3) on the packaged app:

  ```bash
  npx @electron/fuses read --app release/win-unpacked/CoinLeak.exe
  ```

  RunAsNode, EnableNodeOptionsEnvironmentVariable and
  EnableNodeCliInspectArguments must be Disabled;
  EnableEmbeddedAsarIntegrityValidation and OnlyLoadAppFromAsar Enabled.
- What ships: `npx @electron/asar list release/win-unpacked/resources/app.asar`
  shows `out/`, `build/icon.png`, `package.json` and production
  `node_modules/` only.

## What the person installing sees

The installer has no code-signing certificate, so Windows SmartScreen warns
before it runs:

1. A blue box says "Windows protected your PC".
2. Click "More info".
3. Click "Run anyway".

The installer then runs without more questions: it installs for that
Windows user only (no admin prompt), adds CoinLeak to the Start menu and the
desktop, and opens it. Uninstall from Settings, Apps; it keeps the data
folder.
