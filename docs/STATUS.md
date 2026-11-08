# Status

Where the project stands, for the owner and the next lead session. Update
at the end of every session.

## 2026-11-08

### In `main` (all checks green, 563 tests)

- Foundation: Electron app with no server, sandboxed window, own SQLite
  database (works offline), typed IPC, fixed error codes.
- Sync with self-login. **Discount and Cal verified live end to end**
  (Discount 274 rows over a year; Cal 6 accounts, 2026-11-08).
- `npm run dev` prints each sync stage and the counts in the terminal.
- **All 18 providers researched** (spec 08): a registry, generic self-login
  and per-provider allowlists. 16 can self-login (Discount verified, the
  rest experimental), 2 cannot: One Zero (its login sends the password
  from the app) and Union Bank (merged into Mizrahi, site gone). Each has a
  doc in `docs/banks/`. `npm run sync:try -- <id>` works for every enabled
  provider; the app's screens still offer only Discount and Cal.
- Ledger: dedup, card bills counted once, pending rows settle or go "gone",
  foreign pending purchases wait for their shekel amount.
- Rules: engine runs on every sync (user choices win); **Rules page and
  rule editor with live preview** (spec 09, first slice).
- Screens in Spent's look: Home charts, Transactions with review actions,
  Categories, Rules, Accounts with card mode, Settings, first-run welcome.
- Amounts shown as ₪9,353.

### Next

Wave 4 is running: specs 10 (money accounts and Sync panel), 11
(transactions workbench: trash, right click, rules from rows), 12 (category
curves, Today button, chart research). Then wave 5 from `docs/FEATURES.md`,
then installers. Owner: try any other bank the family uses with
`npm run sync:try -- <id>`, and push `main` to GitHub.

### How to resume

Start Claude Code in `~/Projects/CoinLeak` (so this project's settings and
`CLAUDE.md` load), and say "continue from docs/STATUS.md".
