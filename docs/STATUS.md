# Status

Where the project stands, for the owner and the next lead session. Update
at the end of every session.

## 2026-11-08

### In `main` (all checks green, 563 tests)

- Foundation: Electron app with no server, sandboxed window, own SQLite
  database (works offline), typed IPC, fixed error codes.
- Sync with self-login. **Discount verified live end to end** (274 rows,
  one year). Cal login verified; Cal download not yet confirmed.
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

1. Spec 08, UI part: Accounts page and Sync panel list providers from the
   registry ("Experimental" tag, "Why isn't my bank here?"), an "Add a
   bank or card" picker, generic welcome copy. Files:
   `pages/accounts-page.tsx`, `components/sync/**`,
   `components/common/welcome.tsx`.
2. Spec 09, Transactions part: "Make a rule" in the bulk bar, the "Always
   put X in Y?" toast after a hand categorization, the rule chip on rows.
   The agent's notes on how are in its report (summarized in the spec 09
   section of `docs/BACKLOG.md`).
3. Owner: `npm run sync:try -- visaCal` to confirm Cal's download; and any
   other bank the family uses (`npm run sync:try -- hapoalim`, etc.).
4. Spec 10: installers (Windows and Linux) with Electron fuses.
5. Push `main` to GitHub (it needs a permission outside the sandbox).

### How to resume

Start Claude Code in `~/Projects/CoinLeak` (so this project's settings and
`CLAUDE.md` load), and say "continue from docs/STATUS.md".
