# CoinLeak

Local-only personal finance for Israeli bank and credit card accounts.
Press Sync, log in to your bank yourself, and see where the money goes in
clear, friendly charts. Your data stays in one file on your computer.
No cloud, no AI, no telemetry, and the app never asks for your bank password.

Status: early development. See `REQUIREMENTS.md` for the plan.

## Install on Windows

1. Get `CoinLeak-Setup-<version>.exe` from whoever built it (see
   `docs/RELEASE.md`).
2. Double click it. It installs for your Windows user only, with no admin
   prompt, and adds CoinLeak to the Start menu and the desktop.
3. The installer is not code-signed, so Windows shows "Windows protected
   your PC". Click "More info", then "Run anyway".
4. Open CoinLeak from the Start menu. Sync uses Chrome if it is installed,
   otherwise Microsoft Edge, which every Windows has.

Your data lives in `%APPDATA%\CoinLeak\data`. Uninstalling from Windows
Settings keeps it.

## Privacy

- **CoinLeak never asks for your bank password and never stores it.** When
  you press Sync, a browser window opens on your bank's own login page. You
  type your password there, the same as on the bank's website. CoinLeak has
  no password field anywhere. If something that looks like CoinLeak asks
  for your bank password, it is not CoinLeak.
- **Your data does not leave your computer.** The CoinLeak window itself is
  blocked from the internet: no cloud, no AI, no tracking, no ads, no
  update checks. The only thing that goes online is the sync browser, and
  it may only reach your bank's or card company's own websites. Everything
  else it tries to load is blocked. (One exception: the Isracard, American
  Express and Behatsdaa login pages need Google's "I'm not a robot" check,
  so for those the sync browser may also reach that one Google service.)
- **The sync browser starts empty and is thrown away.** Each sync uses a
  fresh browser profile that cannot see your normal browsing, and it is
  deleted as soon as the download ends. It is set to never offer to save
  your password.
- **Where your data lives.** On Windows, in `%APPDATA%\CoinLeak\data`: one
  database file per profile. Nobody else has a copy, including us.
- **How to delete it.** In CoinLeak, open Settings, then "Danger zone", then
  "Delete everything". That deletes every profile and all its data. To
  remove every trace, also uninstall CoinLeak (Windows Settings, Apps) and
  then delete the folder `%APPDATA%\CoinLeak`, which also holds small window
  settings such as the theme. Uninstalling alone keeps your data.
- On a laptop, turn on disk encryption (BitLocker on Windows). It protects
  your data if the computer is lost or stolen, which CoinLeak cannot do by
  itself.

## Disclaimer

CoinLeak is an unofficial, free, open source project. It is not made by,
for, or with any bank or card company, and none of them support it.
CoinLeak is not financial advice: it only shows what your bank sends.
Numbers can be wrong or missing, so check anything important with your bank.
Use it at your own risk; the software comes with no warranty (see
`LICENSE`).

Only **Discount Bank** and **Cal** have been tested with real accounts. All
other banks and card companies are **experimental**: built from the same
code and tested against fake pages, but not yet confirmed with a real
account. They may fail to sync or miss transactions.

## Run it (developers)

You need Node 22.13 or newer (the database uses `node:sqlite`) and, for
syncing, a system Chrome, Chromium or Edge: the sync opens your installed
browser so you log in to the bank yourself.

```bash
git switch dev     # day-to-day work lives on dev; main holds tested work
npm ci
npm run setup      # downloads the Electron binary (install scripts are off)
npm run dev
```

`npm run check` runs types, lint, tests and the build. After pulling new
code, stop `npm run dev` and start it again: a running dev window keeps
the old main process and database code.

## Where to start reading

1. `REQUIREMENTS.md`: what and why, the money model (section 4) and the
   layers (section 7).
2. `docs/ARCHITECTURE.md`: the path of a request, adding a channel, flows
   and `LEDGER_SQL`, migrations, the Demo profile and screenshots.
3. `AGENTS.md`: the rules every change follows.
4. `docs/STATUS.md`: where the project stands now.
5. `docs/specs/`: one spec per piece of work, newest last.

### Linux dock icon

GNOME on Wayland shows an app's logo only when a desktop entry for it is
installed. Run this once from the checkout you start CoinLeak from:

```bash
npm run desktop:install
```

It writes `~/.local/share/applications/coinleak.desktop` (which runs this
checkout's `npm run dev`) and the icons under `~/.local/share/icons/hicolor/`,
for your user only. Start CoinLeak from the app grid or with `npm run dev`.
Run it again if you move the checkout. The icon files live in `build/`
(`scripts/make-icons.sh` renders them from `build/icon.svg`).

## How it is built

- `REQUIREMENTS.md`: what and why, decisions, security model.
- `AGENTS.md`: rules for every contributor, human or AI.
- `docs/HOW-WE-WORK.md`: the workflow.
- `docs/specs/`: one spec per piece of work.

## Credits

Design and ideas from [Spent](https://github.com/Shaya16/Spent) by Shaya16
and its fork by matanyaw9 (MIT License). Bank downloads by
[israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers)
(MIT License, Copyright (c) 2017 Elad Shaham). Files that carry copied or
adapted code say so in their header. The license notices are in
`THIRD-PARTY-NOTICES.md`.

CoinLeak is not connected to these projects, and they do not support it.

## License

MIT, see `LICENSE`.
