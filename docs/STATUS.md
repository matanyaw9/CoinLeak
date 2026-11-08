# Status

Where the project stands, for the owner and the next lead session. Update
at the end of every session.

## 2026-11-08

### In `main` (all checks green, 607 tests)

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
- Wave 4: Money accounts with an Add picker for every provider and last
  sync on hover; Trash, right-click menu, rules from rows, card bills
  hidden by default, bigger checkboxes; category curves on Home, Today
  button, chart research in `docs/research/money-charts.md`.

### Next

Wave 4 merged (specs 10, 11, 12; 607 tests). Owner to test it (see the
lead's message of 2026-11-08). Then plan wave 5 from `docs/FEATURES.md`
plus the must-fix "Empty trash" item in `docs/BACKLOG.md`, then installers.

### How to resume

Start Claude Code in `~/Projects/CoinLeak` (so this project's settings and
`CLAUDE.md` load), and say "continue from docs/STATUS.md".
