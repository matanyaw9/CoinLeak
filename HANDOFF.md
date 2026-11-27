# Handoff: CoinLeak
_Last session: 2026-11-27 (day) · branch: dev · last commit: this handoff · not pushed (dev is 131+ commits ahead of origin)_

## Today in one line
Wave 17 (spec 43) merged by the main lead session, and a Splitwise plan (F95) written for after v1; a whole-code review was still running at handoff.

## What we did
- **Wave 17, spec 43** (lead session `coinleak-bb`, agents `wave17-showall`, `wave17-ruleundo`, `wave17-cleanup`): "Show all" on every chart you can narrow (F61); deleting a rule and pressing Undo brings it back exactly (same place, same exceptions); screenshot hooks cleanup; Demo seed gained a "Phone" rule and an ignored savings move. Owner tests: `docs/OWNER-TESTS.md` section 15.
- **Splitwise plan (F95)**, side session `coinleak-1d`: `docs/research/splitwise.md`. No scraper needed: Splitwise has a CSV export per group and an official API. Proposal: a Splitwise account like the Cash wallet, one row per shared expense worth "what you paid minus your share", settle-ups internal like card bills, CSV import first. Listed in `docs/FEATURES.md` (Later, F95) and the "later" row of `REQUIREMENTS.md` section 8.

## Where we stopped
- `dev` committed (Splitwise plan committed with this handoff). **Not pushed.** `main` untouched.
- At handoff, the lead session `coinleak-bb` was busy and a `whole-review` session (whole-code review) had just started. Their results are not in this file: check `docs/reviews/` and `git log` for anything newer.
- No code touched by the Splitwise work, so no `npm run check` for it. Last recorded green run: 1332 tests (before wave 17); wave 17's own run is in that session.
- Many finished agent sessions still open in herdr (round2-*, round3-*, wave16-*, wave17-*); all merged, panes can be closed. Merged worktrees under `.claude/worktrees/` can be removed.

## Open questions / decisions for the user
- **Splitwise (F95), four decisions** at the end of `docs/research/splitwise.md`: count my share or only show Splitwise beside the bank view; CSV first or wait for a live connection; foreign-currency expenses (type the shekel amount, or skip with a count); when (lead: after the first public version).
- Carried over from the night handoff: chooser "Other in <group>" line later?; chooser footer "Top 5"/"All spending" next to "Clear all", keep both?; restore keeps an emptied account a kept rule needs, OK?; first release 0.1.0 as an unsigned GitHub pre-release, say go.

## Next steps
1. Read the whole-code review result (`docs/reviews/`, newest) and do its fixes, if the `coinleak-bb` session did not finish them.
2. Owner tests `docs/OWNER-TESTS.md` sections 12 to 15 (round 2, spec 41, wave 16, wave 17), plus the open parts of 8 and 10.
3. Push `dev` when the owner says; merge into `main` after the tests.
4. First release: 0.1.0 on `main`, secrets re-scan, `npm run dist:win`, tag, draft pre-release with `SHA256SUMS.txt` (`docs/RELEASE.md`), Windows VM re-run (14.6), publish for the friend.
5. Splitwise, only after v1 and the owner's four decisions: owner makes a made-up test group and exports its CSV (step 1 of the plan), then wave A (core + window), then wave B (settle-up matching).

## History
- 2026-11-27 (day): wave 17 (spec 43) merged; whole-code review started; Splitwise plan written (F95); not pushed.
- 2026-11-27 (night): wave 15 rounds 2 and 3 (specs 40, 41) and wave 16 (spec 42, ready for Windows) built by Sonnet agents, merged, two Opus reviews, all fixes done; not pushed.
- 2026-11-25 (evening, night): wave 14 review fixes merged; wave 15 (specs 37 to 39) built, merged, reviewed; owner tested and sent F87 to F94; not pushed.
- 2026-11-25 (overnight, morning-lead): wave 13 code review and its two fixes; wave 14 (specs 34 to 36) merged; not pushed.
- 2026-11-25: Sure comparison; feedback F67 to F86; wave 13 (specs 31 to 33) merged, owner tested, pushed.
- 2026-11-23: F66 keyboard shortcuts requested.
- 2026-11-19: whole-code review; 5 fixes merged; dev pushed.
- 2026-11-18: wave 12, Saved or overspent bars (spec 30, F62).
- 2026-11-17: security docs and Windows VM results merged.
- 2026-11-16: shipping plan; Windows VM test passed.
