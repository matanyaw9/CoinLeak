# Handoff: CoinLeak
_Last session: 2026-11-27 (night; new session at 06:10) · branch: dev · last commit: this handoff · not pushed (nothing pushed since d837cdd)_

## Tonight in one line
Wave 15 rounds 2 and 3, wave 16 ("ready for Windows") and wave 17 (show all, exact rule undo, screenshot hooks) built, merged, reviewed: `dev` is green (1336 tests) and waits for the owner's tests. A whole-code Opus review was started last (see Where we stopped).

## How we work now (owner, 2026-11-27)
Builders: Sonnet 5.5 at high effort in herdr tab 2, tight specs, short reports (each agent took 5 to 10 minutes). The lead does small precise and security fixes itself. One Opus review per round in its own pane. One combined screenshot pass after merging. (Memory: pro-plan-model-choice.)

## What we did
- **Lead fixes** (wave 15 review): restore check compares every schema entry, a budget can always go down, `settings:set` refuses `budgetTotal`, backup temp file private first, CSV guards every text column, core sends `leftInside`; F89 "16,000" in money boxes; F90 `A` opens Finance accounts; F94 migration 0017 (new empty profiles get no level 3 defaults).
- **Spec 40** (round 2): budgets on the Categories page, Budgets page and `U` gone (F87); tree guide lines (F88); tick-box chooser with Selected chips and Clear all (F91); summed line name as a button.
- **Spec 41** (round 3): a new rule goes on top and wins; hints "Overrides X on N rows" / "X decides N of these rows"; "Set by you" (F92). Restore asks what to bring over: transactions, rules, budgets; categories always (F93). Lead: the copy is trimmed before it becomes a profile.
- **Spec 42 + lead** (wave 16, ready for Windows): About CoinLeak in Settings with version, Check for updates, Report a bug, Star (F27, F28 step 1) through `app:openLink` (three fixed GitHub pages by name, `src/main/links.ts`); README install, update and banks steps; `docs/RELEASE.md` publish steps; `SHA256SUMS.txt` from `npm run dist:win`; round 2 review polish. F57 was already built. Trial installer build: fuses and asar as required.
- **Spec 43** (wave 17): "Show all" checked on every chart, added to the money flow two levels deep (F61 built); Undo of a rule delete is exact and one call (`rules:delete` / `rules:restore`); screenshot hooks no longer run per line or write data (the Demo seed holds the rules shots; rule in `docs/BACKLOG.md`); `isMac` / `isFindKey` in `lib/shortcuts.ts`. Owner tests section 15.
- F58 debts: owner wants only a debt size estimate and whether it grows or shrinks, no live prices; will think about it another time.
- **Reviews:** `docs/reviews/2026-11-27-round2-review.md`, `docs/reviews/2026-11-27-round3-wave16-review.md`: both "good to merge into `main` once the owner has tested it"; every should-fix and nice-to-have done.
- Screenshots: `.claude/shots/round2/` and `.claude/shots/night/`.

## Where we stopped
- `dev` clean, committed, `npm run check` green (1336 tests). **Not pushed.** `main` untouched.
- Whole-code review (Opus, agent `whole-review`, worktree `.claude/worktrees/night-shots`) writes `docs/reviews/2026-11-27-whole-code-review.md` there (not committed). If it is missing, the usage limit stopped it: rerun it next session. Its findings are not fixed yet.
- herdr tab 2: finished agents `round2-budgets`, `round2-chooser`, `round3-rules`, `round3-restore`, `wave16-about`, `wave16-polish`, `round2-review` (Opus). All merged; panes can be closed.
- Worktrees under `.claude/worktrees/` (wave14-*, wave15-*, round2-*, round3-*, wave16-*, night-shots) are all merged and can be removed (lead was not allowed to delete them unattended). `round2-shots/release/` holds a trial 0.0.1 installer (not for sharing).
- Sleep block `coinleak-awake5` ends by itself about 06:30.

## Open questions for the owner
- Chooser: a group's own rows (not in any subcategory) count when the group is fully ticked, not when partly ticked; the chooser now says so. Want an "Other in <group>" line later (needs the "only this level" filter, backlog)?
- Chooser footer: "Top 5" / "All spending" applies at once, next to "Clear all" that only unticks until Apply. Keep both?
- Restore: an account a kept rule is limited to stays (emptied) when transactions are left out. OK?
- First release: version `0.1.0`, GitHub pre-release, unsigned (PUBLISH-CHECKLIST section 4 recommendations). Say go.
- Section 8 tests (waves 10 to 12) before `dev` goes to `main`; section 10 partly open.

## Next steps
1. Owner tests `docs/OWNER-TESTS.md` sections 12 to 15 (round 2, spec 41, waves 16 and 17). Mouse items to try: 12.4, 14.3. Lead: read the whole-code review and fix its must-fixes.
2. Push `dev` when the owner says; merge into `main` after the tests.
3. First release: bump to 0.1.0 on `main`, secrets re-scan, `npm run dist:win`, tag, draft GitHub pre-release with the installer and `SHA256SUMS.txt` (`docs/RELEASE.md`), then the short Windows VM re-run from that draft (14.6), then publish for the friend.
4. Later: rethink default categories (F94), F67 net worth design note, F1 scraper review routine (owner: new scrapers only ever ship inside a release), Linux AppImage (F55).

## History
- 2026-11-27 (night): wave 15 rounds 2 and 3 (specs 40, 41), wave 16 (spec 42, ready for Windows) and wave 17 (spec 43) built by Sonnet agents, merged, two Opus reviews fixed, whole-code review started; not pushed.
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
