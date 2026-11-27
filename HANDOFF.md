# Handoff: CoinLeak
_Last session: 2026-11-27 (night into morning; owner away) · branch: dev · last commit: this handoff · not pushed (dev is 150+ commits ahead of origin)_

## Today in one line
Waves 15b to 18 built by Sonnet agents, merged, and reviewed by Opus (round 2, round 3 + wave 16, the whole code, then wave 18); every finding is fixed or on the backlog. `dev` is green (1360 tests) and ready for the owner's tests and the first release.

## How we work now (owner, 2026-11-27)
Builders: Sonnet 5.5 at high effort in herdr (tabs 2 and 3), tight specs, short reports, about 5 to 15 minutes each. The lead does small precise and security fixes itself. One Opus review per round. One combined screenshot pass after merging. (Memory: pro-plan-model-choice.)

## What we did
- **Round 2, spec 40:** budgets on the Categories page (F87), tree guide lines (F88), tick-box chooser (F91); lead: "16,000" (F89), key A (F90), two-level defaults (F94), the wave 15 review fixes.
- **Round 3, spec 41:** a new rule goes on top and names the rules it overrides (F92); restore asks what to bring over (F93).
- **Wave 16, spec 42 (ready for Windows):** About in Settings (version, Check for updates, Report a bug, Star) through `app:openLink` (three fixed GitHub pages by name); README install, update and bank steps; `docs/RELEASE.md` publish steps; `SHA256SUMS.txt` from `npm run dist:win`.
- **Wave 17, spec 43:** "Show all" checked on every chart, added to the money flow two levels deep (F61); exact rule Undo (`rules:delete` / `rules:restore`); screenshot hooks no longer per line or writing data.
- **Wave 18, spec 44 (whole-code review fixes):** card-bill Undo is exact (must fix: it could hide ₪200 of spending); refunds show as "₪300 back" on the donut and month bars (core sends both ready to draw); quitting mid-sync waits for the sync and every start removes leftover bank browser profiles; `rules:create` removed; one `src/shared/limits.ts`; risky rule patterns refused when new, with the editor saying why (`src/shared/pattern-guard.ts`); deleting a category says its budget goes too.
- **Reviews** in `docs/reviews/`: `2026-11-27-round2-review.md`, `-round3-wave16-review.md`, `-whole-code-review.md` (verdict: ready for a friend on Windows after one fix), `-wave18-review.md` (good to merge into `main` after the owner's tests; its findings fixed in `17c97de`).
- **Release prep:** light secrets scan of all history, nothing found (`docs/PUBLISH-CHECKLIST.md` section 1); draft release notes `docs/release-notes-0.1.0.md`; trial installer built at 8387f66 (fuses and asar as required).
- **Splitwise plan (F95)**, side session `coinleak-1d`: `docs/research/splitwise.md`. No scraper needed: Splitwise has a CSV export per group and an official API. Proposal: a Splitwise account like the Cash wallet, one row per shared expense worth "what you paid minus your share", settle-ups internal like card bills, CSV import first. Listed in `docs/FEATURES.md` (Later, F95) and the "later" row of `REQUIREMENTS.md` section 8.
- F58 debts: owner wants only a debt size estimate and whether it grows or shrinks, no live prices; will think about it another time.
- Screenshots: `.claude/shots/round2/`, `.claude/shots/night/`, `.claude/shots/morning/`.

## Where we stopped
- `dev` clean, committed, `npm run check` green (1360 tests). **Not pushed.** `main` untouched.
- herdr tabs 2 and 3: all agents finished and merged; panes can be closed. Merged worktrees under `.claude/worktrees/` can be removed (the lead was not allowed to delete them unattended).
- Sleep block `coinleak-awake6` ends by itself about 10:10.

## Open questions / decisions for the user
- **First release:** 0.1.0 as an unsigned GitHub pre-release, with the draft notes in `docs/release-notes-0.1.0.md`? Say go.
- **Chooser:** a group's own rows count when it is fully ticked, not when partly ticked (the chooser says so). Want an "Other in <group>" line later? Keep both "Top 5 / All spending" and "Clear all"?
- **Restore:** an account a kept rule is limited to stays (emptied) when transactions are left out. OK?
- **Splitwise (F95), four decisions** at the end of `docs/research/splitwise.md`: count my share or only show Splitwise beside the bank view; CSV first or wait for a live connection; foreign-currency expenses (type the shekel amount, or skip with a count); when (lead: after the first public version).

## Next steps
1. Owner tests `docs/OWNER-TESTS.md` sections 12 to 16 (round 2, spec 41, waves 16 to 18), plus the open parts of 8 and 10. Mouse items: 12.4, 14.3. Windows only: 16.3.
2. Push `dev` when the owner says; merge into `main` after the tests.
3. First release: 0.1.0 on `main`, optional gitleaks scan, `npm run dist:win`, tag, draft pre-release with the installer, `SHA256SUMS.txt` and the notes (`docs/RELEASE.md`), Windows VM re-run from the draft (14.6, 16.3), publish for the friend.
4. Later, no owner decision needed: split `src/core/ledger/queries.ts` (backlog), money flow from the keyboard (backlog).
5. Splitwise, only after v1 and the owner's four decisions: owner makes a made-up test group and exports its CSV (step 1 of the plan), then wave A (core + window), then wave B (settle-up matching).

## History
- 2026-11-27 (night into morning): waves 15b to 18 (specs 40 to 44) built by Sonnet agents, merged, four Opus reviews, all findings fixed or on the backlog; release prep (scan, notes, trial build); Splitwise plan (F95) in a side session; not pushed.
- 2026-11-25 (evening, night): wave 14 review fixes merged; wave 15 (specs 37 to 39) built, merged, reviewed; owner tested and sent F87 to F94; not pushed.
- 2026-11-25 (overnight, morning-lead): wave 13 code review and its two fixes; wave 14 (specs 34 to 36) merged; not pushed.
- 2026-11-25: Sure comparison; feedback F67 to F86; wave 13 (specs 31 to 33) merged, owner tested, pushed.
- 2026-11-23: F66 keyboard shortcuts requested.
- 2026-11-19: whole-code review; 5 fixes merged; dev pushed.
- 2026-11-18: wave 12, Saved or overspent bars (spec 30, F62).
- 2026-11-17: security docs and Windows VM results merged.
- 2026-11-16: shipping plan; Windows VM test passed.
- 2026-11-15: wave 11 merged; repo is public.
- 2026-11-14: wave 10 started; Windows installer merged.
