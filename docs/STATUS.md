# Status

Where the project stands, for the owner and the next lead session. Update
at the end of every session.

## 2026-11-08

### In `main` (all checks green)

- Foundation: Electron app with no server, sandboxed window, own SQLite
  database (works offline), typed IPC, fixed error codes.
- Sync with self-login for Discount and Cal. **Discount verified live end
  to end** (274 rows, one year). Cal login verified; Cal download not yet
  confirmed.
- Ledger: dedup, card bills counted once, pending rows settle or go "gone",
  foreign pending purchases wait for their shekel amount.
- Rules engine (core): ordered rules run on every sync; user choices win.
- Screens in Spent's look: Home charts, Transactions with review actions,
  Categories, Accounts with card mode, Settings, first-run welcome.
- Amounts shown as ₪9,353.

### In progress at the end of the session

- Spec 08 (every bank and card company) and spec 09 (rules screen) were
  asked to stop at a clean point. Their branches are merged if they were
  ready; otherwise see "Next" for what is left.

### Next

1. Finish whatever is left of specs 08 and 09 (see their reports in
   `docs/BACKLOG.md` once merged).
2. Owner: `npm run sync:try -- visaCal` to confirm Cal's download.
3. Spec 10: installers (Windows and Linux) with Electron fuses.
4. Push `main` to GitHub (skipped during the night session: it needs a
   permission outside the sandbox).

### How to resume

Start Claude Code in `~/Projects/CoinLeak` (so this project's settings and
`CLAUDE.md` load), and say "continue from docs/STATUS.md".
