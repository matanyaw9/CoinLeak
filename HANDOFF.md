# Handoff: CoinLeak
_Last session: 2026-11-25 · branch: dev · last commit: see `git log -1` (wave 13 merged, owner tests written)_

## Today in one line
Wave 13 (specs 31, 32, 33) built by three herdr agents, reviewed and merged into `dev`; `npm run check` green (1093 tests). Waiting on the owner's tests.

## What we did
- Compared CoinLeak with Sure (`we-promise/sure`, AGPL fork of Maybe Finance). It does not fit (no Israeli banks, Rails server plus Docker, saved bank passwords via moneyman), but its budgets UI and net worth, investments and loans are what the owner wants next. Ideas only, never code (AGPL vs our MIT).
- Logged the owner's feedback as F67 to F82 in `docs/FEATURES.md`, with decisions: 3 category levels (F69), remove Routine / Treats (F72), card bills by last 4 digits (F75, D14), no history older than a year for Discount (F81 closed), Cal sync too slow (F82).
- Wave 13, three agents in herdr tab 2 (all Opus 5.5; Fable needs paid credits on the owner's Pro plan), each in its own worktree, reviewed and sent back once with fixes, then merged:
  - Spec 31 `wave13/keyboard`: page keys H T C R B X S, `?` list, key badges, Ctrl+A, Esc, Shift and Ctrl click, Enter and Esc in dialogs (destructive dialogs need Ctrl+Enter: lead's safety call, owner to confirm), sticky sort headers with date_asc and name_desc in core.
  - Spec 32 `wave13/cardbills`: a money-out bank line naming exactly one synced card's last 4 digits (standalone, not a year on a non-card line, not an ATM line) is that card's bill; quick sync from last sync minus 60 days, "Download everything again", Settings hint, `[sync]` timing log line.
  - Spec 33 `wave13/paidback`: migration 0014 `paid_back_for`, "Paid back for a purchase..." in the row menu, Investments and Savings starter lists, "Finance accounts" rename, bigger emojis, a Demo pizza paid back by a friend.
- Merge conflicts were only side-by-side additive blocks (`strings.ts`, `types.ts`, `core/ledger/index.ts`).
- `docs/OWNER-TESTS.md` section 9 lists what to test; FEATURES and REQUIREMENTS wave 13 marked built.
- Answered "how far from a Windows installer with remote updates" (see open questions).

## Where we stopped
- `dev` has all of wave 13, checks green, not yet pushed after the merges (push when the owner says).
- herdr tab 2 still has the three idle agent sessions (keyboard, cardbills, paidback). They can be closed; their branches are merged.
- The `wave13-keyboard` worktree is detached at the merged `dev` commit (used for the combined screenshot). All `wave13-*` worktrees and the old wave 10 to 12 ones can be removed once the owner agrees.

## Open questions / decisions for the user
- Run the tests in `docs/OWNER-TESTS.md` section 9; tell the lead the `[sync] visaCal mode=quick` timing numbers.
- Destructive dialogs: keep Ctrl+Enter, or plain Enter as first asked?
- Friend's Windows trial: option 1 (version in Settings plus "Check for updates" opening GitHub Releases, small, no new risk) now, option 2 (real auto-updates via electron-updater: new dependency, app contacts GitHub, unsigned so trust rests on the GitHub account) later? Lead recommends 1 now, 2 later.
- Which bank and card does the friend use? Only Discount and Cal are verified live.
- Still open: test the 11-19 fixes and F62 (section 8), GitHub settings by hand, ship 0.1.0.

## Next steps
1. After the owner's tests: fix what they find, then merge `dev` into `main`.
2. Release prep spec (34): version 0.1.0, F28 step 1, F57 experimental labels, secrets re-scan, GitHub pre-release with the `.exe` and SHA-256 (`docs/PUBLISH-CHECKLIST.md`, `docs/RELEASE.md`). Build the release from the main checkout, not a symlinked worktree.
3. Wave 14 specs: nested categories to 3 levels, new defaults (F70 names still to agree), remove Routine / Treats, rule editor tick boxes (F69, F70, F72, F71). Small follow-up: add the Paid back dialog keys to the `?` list.
4. Write the F67 design note (net worth, investments, loans) for the owner.

## History
- 2026-11-25: Sure comparison; feedback F67 to F82; wave 13 (specs 31 to 33) built by herdr agents on Opus 5.5, reviewed, merged, owner tests written.
- 2026-11-23: short session; F66 keyboard shortcuts requested and logged, next feature.
- 2026-11-19: whole-code review; 5 fixes merged (startup without window, today rollover, one shekel parser, Transactions page split, chart helpers); dev pushed; F65 refund idea logged.
- 2026-11-18: wave 12, Saved or overspent bars per month (spec 30, F62), merged; clicking a bar opens that month.
- 2026-11-17: security docs and Windows VM results merged; Add cash on the Transactions welcome screen.
- 2026-11-16: shipping plan; herdr agents ran the Windows VM test (passed) and wrote the security docs; both on branches, unmerged.
- 2026-11-15: wave 11 merged (spec 26 average lines, F61 curve categories); specs 27 and 28 merged; publish checklist written; repo is public.
- 2026-11-14: wave 10 started (specs 27 budgets, 28 categories/fixes, 29 Windows); Windows installer merged and built.
- 2026-11-10 (later): Uncategorized filter matches Needs review (F64); budgets F59 planned; F63 yearly average line requested.
- 2026-11-10: spec 25 cleanup merged; wave 9 done; F62 savings chart requested; month-by-month bar fixes.
