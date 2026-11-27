# Handoff: CoinLeak
_Last session: 2026-11-27 (day) · branch: dev · last commit: this handoff · pushed (dev = origin/dev)_

## Today in one line
Pushed `dev`, the owner started the owner tests, and their feedback is on the fix list (F96 to F100 plus one keyboard bug). Nothing fixed yet, as the owner asked.

## What we did
- Pushed `dev` to GitHub (was 150+ commits ahead). `main` untouched.
- Gave the owner the open test list (below, under Next steps).
- Owner tested: restore choices (all, transactions only, budgets only, rules only), the About buttons, category editor Tab and arrows, dragging categories. All work except the points below.
- Logged, owner's words and lead notes, in `docs/FEATURES.md` "Owner feedback from testing, 2026-11-27":
  - F96 rename a profile by double-clicking its name in Settings (keep a keyboard way).
  - F97 "Back up now" becomes "Export profile".
  - F98 Add profile asks: empty, restore a `.coinleak` file, or Demo.
  - F99 restore tick boxes become Transactions, Categories (budgets included), Rules. Transactions only and rules only still brought the owner's test category (today categories always come, F93). Needs decision.
  - F100 small animation when dragging a category.
- Bug in `docs/BACKLOG.md` "Owner tests, 2026-11-27": in the category editor, a parent picked from the keyboard is lost (saved as top level); with the mouse it works.

## Where we stopped
- `dev` clean, committed and pushed. Only docs changed today; `npm run check` was last green at `b8621a6` (1365 tests).
- Owner said: "Don't fix rn, just keep it on a fix list." No fix wave started.
- Merged worktrees under `.claude/worktrees/` (about 20) can still be removed; owner has not answered yet.

## Open questions / decisions for the user
- **F99 restore:** lead proposal: ticking Rules ticks and locks Categories (rules point at categories); Transactions without Categories arrive in the new profile's default categories, keeping a category when one of the same name exists, else uncategorized, and the done message says how many. Owner to confirm.
- **First release:** 0.1.0 as an unsigned GitHub pre-release with `docs/release-notes-0.1.0.md`? Probably after the fix list.
- **Chooser:** "Other in <group>" line later? Keep both "Top 5 / All spending" and "Clear all"?
- **Restore:** an account a kept rule is limited to stays (emptied) when transactions are left out. OK? (F99 may change this.)
- **Splitwise (F95):** four decisions at the end of `docs/research/splitwise.md` (after v1).
- **Worktrees:** delete the merged ones under `.claude/worktrees/`?

## Next steps
1. Owner finishes `docs/OWNER-TESTS.md` (restart `npm run dev`, Demo first). Still open, by page:
   - Home: 8.1 (own), 8.2, 12.7, 12.8, 14.2, 15.1, 16.2, 17.1, 17.2
   - Transactions: 8.4 (cash), 8.5, 10.3, 10.9, 10.10, 10.11, 10.12a, 16.1 (must), 16.6
   - Categories: 8.3, 10.1, 10.4, 10.5 (own), 12.1 to 12.3, 12.5, 12.6, 14.3 (mouse), 16.4, 10.13c
   - Rules: 8.4 (rule), 10.6, 10.13a and b, 13.1 to 13.3, 15.2, 15.3, 16.5
   - Settings: 12.9, 12.10 (own), 13.5, 14.4, and 10.8 (Tab out of lists)
   - Later on Windows: 14.6, 16.3. Optional: 8.6, 10.12b.
2. When the owner says go: a fix wave (spec 46) for the keyboard parent bug, F96 to F100 (F99 after the decision), and whatever the remaining tests find.
3. Then merge `dev` into `main` and the 0.1.0 release (`docs/RELEASE.md`): optional gitleaks scan, `npm run dist:win`, tag, draft pre-release, Windows VM re-run (14.6, 16.3), publish for the friend.
4. Later: the rest of `docs/BACKLOG.md`; Splitwise after v1 and the owner's decisions.

## History
- 2026-11-27 (day): pushed `dev`; owner tested restore, About, category editor, dragging; feedback F96 to F100 and a keyboard bug on the fix list; pushed.
- 2026-11-27 (night into morning): waves 15b to 19 (specs 40 to 45) built by Sonnet agents, merged, five Opus reviews, all findings fixed or on the backlog; release prep (scan, notes, trial build); Splitwise plan (F95) in a side session; not pushed.
- 2026-11-25 (evening, night): wave 14 review fixes merged; wave 15 (specs 37 to 39) built, merged, reviewed; owner tested and sent F87 to F94; not pushed.
- 2026-11-25 (overnight, morning-lead): wave 13 code review and its two fixes; wave 14 (specs 34 to 36) merged; not pushed.
- 2026-11-25: Sure comparison; feedback F67 to F86; wave 13 (specs 31 to 33) merged, owner tested, pushed.
- 2026-11-23: F66 keyboard shortcuts requested.
- 2026-11-19: whole-code review; 5 fixes merged; dev pushed.
- 2026-11-18: wave 12, Saved or overspent bars (spec 30, F62).
- 2026-11-17: security docs and Windows VM results merged.
- 2026-11-16: shipping plan; Windows VM test passed.
