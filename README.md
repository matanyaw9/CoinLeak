# CoinLeak

Local-only personal finance for Israeli bank and credit card accounts.
Press Sync, log in to your bank yourself, and see where the money goes in
clear, friendly charts. Your data stays in one file on your computer.
No cloud, no AI, no telemetry, and the app never asks for your bank password.

Status: early development. See `REQUIREMENTS.md` for the plan.

## Run it (developers)

```bash
npm ci
npm run setup      # downloads the Electron binary (install scripts are off)
npm run dev
```

`npm run check` runs types, lint, tests and the build.

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
