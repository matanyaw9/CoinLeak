# Handoff: CoinLeak
_Last session: 2026-11-25 · branch: dev · last commit: the "docs: handoff for 2026-11-25" commit (pushed)_

## Today in one line
Wave 13 (specs 31, 32, 33) built by three herdr agents, merged into `dev`, and passed every owner test; four new keyboard and Trash requests (F83 to F86) logged.

## What we did
- Compared CoinLeak with Sure (`we-promise/sure`, AGPL fork of Maybe Finance): not a fit (no Israeli banks, Rails server plus Docker, bank passwords saved via moneyman), but its budgets UI and net worth, investments and loans are what the owner wants next. Ideas only, never code (AGPL vs our MIT).
- Logged feedback F67 to F82 in `docs/FEATURES.md` with decisions: 3 category levels (F69), remove Routine / Treats (F72), card bills by last 4 digits (F75, D14), nothing older than a year for Discount (F81 closed), Cal sync too slow (F82).
- Wave 13, built by three agents in herdr tab 2 on Opus 5.5, reviewed, sent back once each, merged (`npm run check` green, 1093 tests):
  - Spec 31: page keys H T C R B X S, `?` list, key badges, Ctrl+A, Esc, Shift and Ctrl click, Enter and Esc in dialogs (destructive dialogs: Ctrl+Enter), sticky sort headers.
  - Spec 32: a bank line naming one synced card's last 4 digits is its bill; quick sync from last sync minus 60 days, "Download everything again", `[sync]` timing log.
  - Spec 33: "Paid back for a purchase" (migration 0014), Investments and Savings starter lists, "Finance accounts", bigger emojis, a Demo pizza paid back.
- Owner tested all of wave 13: everything works. Quick Cal sync: download 7 s (`downloadMs=7097`); the remaining ~28 s is the login itself. Results in `docs/OWNER-TESTS.md` section 9.
- New requests logged: F83 arrow keys inside lists and Tab between lists, F84 Delete key trashes the selection, F85 a key to toggle Ignore, F86 select and delete for good in Trash. F28 note: owner wants the update button in the first release for the friend.

## Where we stopped
- `dev` pushed, all checks green, nothing uncommitted. `main` not updated: the section 8 tests (waves 10 to 12 and the 11-19 fixes) are still not confirmed by the owner.
- herdr: the three agent sessions are closed; tab 2 is one shell at the project root. Tab 1 still runs the owner's `npm run dev`.
- Worktrees `.claude/worktrees/wave13-{keyboard,cardbills,paidback}` and the old wave 10 to 12 ones still exist; all their branches are merged. Remove them when convenient (`git worktree remove --force <path>`; the `node_modules` symlink makes `--force` needed).

## Overnight run status (morning-lead, 2026-11-25, updated as it goes)
- 05:20 review done: `docs/reviews/2026-11-25-wave13-review.md` (2 must fix, 3 should fix, 5 nice to have; checks green).
- Both must-fix bugs fixed on `fix/review-wave13`, merged into `dev` (1099 tests green): a new category on a paid-back row ends the link; quick sync counts from each syncing account's own last save. Review findings logged in `docs/BACKLOG.md`; `REQUIREMENTS.md` section 5 now describes quick sync.
- Specs 34, 35, 36 written and committed on `dev`. Old merged worktrees removed (their screenshots kept in `.claude/shots/archive/`).
- About 05:40: three agents started in herdr tab 2 (panes split off the lead's), Opus 5.5, xhigh, auto: `wave14-categories` (spec 34), `wave14-ruleticks` (spec 35), `wave14-keys` (spec 36), worktrees `.claude/worktrees/wave14-*`. Reports go to each worktree's `.claude/shots/REPORT.md`.
- 06:00: spec 35 (rule tick boxes) reviewed, three small fixes sent back and done, merged into `dev` (1124 tests green).
- About 06:00 to 10:20: the Pro usage limit stopped everything; the two agents still building continued on their own when it reset. At 10:20 spec 34 had phases 1 to 3 committed (3 levels in core and on screen, new defaults) and was on phase 4 (Routine / Treats); spec 36 had Trash delete for good, the emoji and color grid keys and the key table committed.
- Next: review 34 and 36, send fixes back, merge one at a time, screenshot, update docs.

## Overnight plan (owner asked 2026-11-25 at 02:15; runs at 05:20)
A systemd user timer (`coinleak-morning`) runs `~/.local/share/coinleak-morning/run.sh` at 05:20: it starts a fresh lead session (`morning-lead`, Opus 5.5) in herdr tab "2", sends `/review-code` for `6255ff3..dev` (saved to `docs/reviews/2026-11-25-wave13-review.md`), then the wave 14 prompt. Log: `~/.local/share/coinleak-morning/run.log`. Lead in the morning, do this:

1. **From the review:** add each important finding to `docs/BACKLOG.md`. Fix only clear, small bugs in files wave 14 will not touch, on a `fix/...` branch merged into `dev` before the agents start. Everything else waits for the owner.
2. **Write specs 34, 35, 36** (format of specs 31 to 33, under two pages each, owner's words quoted from `docs/FEATURES.md`), commit them on `dev`:
   - **34 Nested categories and new defaults (F69, F70, F72).** Migration 0015: up to 3 levels, every level a real category (holds rows and a budget), the same kind all the way down; a category's totals include everything under it; charts drill down one level at a time; pickers, the Categories page, move and delete work with 3 levels. New defaults for new and existing profiles, touching only categories still under their default name and parent (the 0013 rules): Groceries gets Weekly shop, Top-up, Specialty food; Transportation gets Bus, Train, Fuel, Parking, Taxi & rides, Tolls, Car repairs, Car insurance, Car license & test. These are the lead's names; the owner can rename in the app. Routine / Treats goes from every screen (the `essential` column stays; no data deleted). Biggest spec: give it category core, migration 0015, the Categories page, the category picker and the Home filters. If it is too big for one agent, build the core and migration now and the UI next wave; never two agents on the same files.
   - **35 Rule editor tick boxes (F71).** Migration 0016 for rule exceptions. The editor's affected-rows list gets a box per row; an unticked row keeps its category and this rule never touches it again, also after later edits. Keyboard per `AGENTS.md`.
   - **36 Keyboard lists and Trash (F83 to F86).** One roving-focus helper (arrows inside a list, Tab to the next list) used by menus, the Paid back list, the Transactions rows and the emoji and color grids; Delete moves the selection to Trash with Undo; `I` toggles Ignore on the selection; Trash gets selection and "Delete for good" (Ctrl+Enter confirm, spec 31); the Paid back dialog keys and the new keys in the `?` list. In the category editor, 36 owns only the emoji and color grids; 34 owns the rest.
3. **Agents** as in the memory note `parallel-agents-in-herdr`: one worktree each, Opus 5.5, xhigh, auto, split off your own pane in tab 2. Review each branch against its spec, send fixes back, merge into `dev` one at a time, `npm run check` after each merge, screenshot the merged app.
4. **Rules for tonight:** never push, never touch `main`, no real bank sync, no new dependencies, no answers to permission or payment dialogs (note them in HANDOFF and skip). Before stopping, update `docs/FEATURES.md`, `REQUIREMENTS.md` section 8, `docs/OWNER-TESTS.md` (new section 10) and this file. If usage runs low, update this file first.

## Open questions / decisions for the user
- Updates for the friend's first version: step 1 (Settings shows the version, "Check for updates" opens GitHub Releases, the friend downloads the new installer himself, no file passing) or step 2 (the app downloads and installs after a click: new dependency `electron-updater`, the app contacts GitHub, unsigned so trust rests on the GitHub account)? The owner said "updates button from the start"; confirm which.
- Which bank and cards does the friend use? Owner will check. Only Discount and Cal are verified live.
- Section 8 tests (waves 10 to 12), then merge `dev` into `main`?
- F70 default category names: the overnight run uses the lead's (Groceries › Weekly shop, Top-up, Specialty food; Transportation › Transport › Bus, Train; Transportation › Taxi & rides, Tolls, Car repairs, Car insurance, Car license & test). Rename any in the app, or say which to change.
- F71 (rule tick boxes), lead's choice in spec 35: an unticked row this rule had categorized keeps that category, now as set by you, and the rule leaves it alone from then on. The other reading is "goes back to Needs review". OK as built?
- Paid back (review, owner question): when a purchase's category changes, should the rows that paid it back follow? Today they keep the old category.
- Quick sync fix trade-off: an account the bank stopped reporting (for example an old card) keeps its "last synced" date old, so that bank's quick syncs reach further back each time (slower, never missing rows) until you remove the account from syncing. If a Cal sync is slow again, check the Finance accounts page for a card with an old "last synced".

## Next steps
0. **If you are the 05:20 `morning-lead`: follow "Overnight plan" above, not the steps below.** Owner, back in the morning: read `~/.local/share/coinleak-morning/run.log`, the review in `docs/reviews/`, and this file.
1. `git pull`, then ask the owner the update question above and whether section 8 is tested (then merge `dev` into `main`).
2. After wave 14 (see "Overnight plan"): release prep for the friend as wave 15: version 0.1.0, F28 (step 1 or 2, owner to choose), F57 experimental labels, secrets re-scan, GitHub pre-release with `.exe` and SHA-256 (`docs/PUBLISH-CHECKLIST.md`, `docs/RELEASE.md`; build from the main checkout). Then budgets page and charts (F73, F78, F79) and backup (F56).
3. Run agents in herdr tab 2 as today (see memory note: worktree per agent, `claude --model opus --effort xhigh --permission-mode auto`; `herdr agent read` scrollback is short, ask agents to write the report to `.claude/shots/REPORT.md`).
4. Write the F67 design note (net worth, investments, loans) for the owner.

## History
- 2026-11-25: Sure comparison; feedback F67 to F86; wave 13 (specs 31 to 33) built by herdr agents, merged, owner tested, pushed.
- 2026-11-23: short session; F66 keyboard shortcuts requested and logged, next feature.
- 2026-11-19: whole-code review; 5 fixes merged (startup without window, today rollover, one shekel parser, Transactions page split, chart helpers); dev pushed; F65 refund idea logged.
- 2026-11-18: wave 12, Saved or overspent bars per month (spec 30, F62), merged; clicking a bar opens that month.
- 2026-11-17: security docs and Windows VM results merged; Add cash on the Transactions welcome screen.
- 2026-11-16: shipping plan; herdr agents ran the Windows VM test (passed) and wrote the security docs; both on branches, unmerged.
- 2026-11-15: wave 11 merged (spec 26 average lines, F61 curve categories); specs 27 and 28 merged; publish checklist written; repo is public.
- 2026-11-14: wave 10 started (specs 27 budgets, 28 categories/fixes, 29 Windows); Windows installer merged and built.
- 2026-11-10 (later): Uncategorized filter matches Needs review (F64); budgets F59 planned; F63 yearly average line requested.
- 2026-11-10: spec 25 cleanup merged; wave 9 done; F62 savings chart requested; month-by-month bar fixes.
