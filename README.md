# CoinLeak

Local-only personal finance for Israeli bank and credit card accounts.
Press Sync, log in to your bank yourself, and see where the money goes in
clear, friendly charts. Your data stays in one file on your computer.
No cloud, no AI, no telemetry, and the app never asks for your bank password.

Status: early development. See `REQUIREMENTS.md` for the plan.

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
and its fork by matanyaw9. Bank downloads by
[israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers).
Files that carry copied code say so in their header.

## License

MIT, see `LICENSE`.
