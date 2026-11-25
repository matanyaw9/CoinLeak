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

## Open questions / decisions for the user
- Updates for the friend's first version: step 1 (Settings shows the version, "Check for updates" opens GitHub Releases, the friend downloads the new installer himself, no file passing) or step 2 (the app downloads and installs after a click: new dependency `electron-updater`, the app contacts GitHub, unsigned so trust rests on the GitHub account)? The owner said "updates button from the start"; confirm which.
- Which bank and cards does the friend use? Owner will check. Only Discount and Cal are verified live.
- Section 8 tests (waves 10 to 12), then merge `dev` into `main`?
- F70 default category names (Weekly shop, Top-up, Specialty food; Transport list) still to agree before wave 14.

## Next steps
1. `git pull`, then ask the owner the update question above and whether section 8 is tested (then merge `dev` into `main`).
2. Plan the next wave (3 parallel specs, separate files): (a) release prep for the friend: version 0.1.0, F28 (step 1 or 2), F57 experimental labels, secrets re-scan, GitHub pre-release with `.exe` and SHA-256 (`docs/PUBLISH-CHECKLIST.md`, `docs/RELEASE.md`; build from the main checkout); (b) keyboard and Trash: F83, F84, F85, F86, plus the Paid back dialog keys in the `?` list; (c) wave 14 categories: 3 levels, defaults, remove Routine / Treats, rule editor tick boxes (F69, F70, F72, F71), likely its own wave since it touches many files.
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
