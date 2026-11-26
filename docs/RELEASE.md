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

## Publish a version (GitHub Releases)

Releases come from tagged versions on `main`, never from every push (F28).
The app's "Check for updates" button (Settings, About) opens
`https://github.com/matanyaw9/CoinLeak/releases`; there is no updater.

1. `dev` is tested by the owner and merged into `main`.
2. Set the version in `package.json` (for example `0.1.0`), commit
   `chore: version 0.1.0` on `main`.
3. Re-run the secrets scan (`docs/PUBLISH-CHECKLIST.md` section 1).
4. `npm run dist:win`. It prints the installer's SHA-256 and writes
   `release/SHA256SUMS.txt`.
5. Check the fuses and the asar contents (above).
6. `git tag v0.1.0` and push the tag.
7. On GitHub, Releases, "Draft a new release" from the tag. Upload
   `release/CoinLeak-Setup-0.1.0.exe` and `release/SHA256SUMS.txt`. Notes
   in plain words: what is new, which banks are verified (Discount, Cal)
   and which are experimental, and the SmartScreen steps below. Tick
   "Set as a pre-release" until a friend has used it for a while.
8. Publish. The friend's "Check for updates" now lands on it.

To check a download on Windows (PowerShell):
`Get-FileHash .\CoinLeak-Setup-0.1.0.exe` must match the line in
`SHA256SUMS.txt`.
