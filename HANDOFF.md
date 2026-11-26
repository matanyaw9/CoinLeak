# Handoff: CoinLeak
_Last session: 2026-11-27 (night, owner asleep; new session at 06:10) · branch: dev · not pushed (nothing pushed since d837cdd)_

## Tonight in one line
Wave 15 round 2 done and merged (lead fixes + spec 40 by two Sonnet agents); spec 41 (F92 rules, F93 restore) and an Opus review of round 2 running overnight.

## How we work now (owner, 2026-11-27)
Builders: Sonnet 5.5 at high effort in herdr tab 2, tight specs, 40-line reports. Lead does small precise fixes itself. One Opus review per round, in its own pane. One combined screenshot pass after merging. (Memory: pro-plan-model-choice.)

## What we did
- **Lead fixes on dev:** review must 1 (`622e517`, restore check compares every schema entry; temp file 0600 first; CSV guards every text column), must 2 (`5f72f7e`, a budget can always go down), nice 2 (`5666dd4`, `settings:set` refuses `budgetTotal`; one `BUDGET_MAX` in `@shared/money`), should 2 core (`526d73c`, `leftInside`), F90 (`7af8fde`, `A` opens Finance accounts), F94 (`bd474bb`, migration 0017: new empty profiles get no level 3 defaults; Demo makes its own), F89 (`533774e`, `shekelText` writes "16,000"), nice 5 (backlog line).
- **Spec 40** (`docs/specs/40-wave15-round2.md`), merged: A budgets on Categories, Budgets page and `U` gone, guide lines, move warning (F87, F88); B tick-box chooser with Selected chips and Clear all, summed line name as a button (F91, F88). Lead merge fixes `4841035`: budgets and chooser keys in `?`, stale strings. Check green, 1298 tests. Screenshots `.claude/shots/round2/`.
- **Spec 41** (`docs/specs/41-newer-rules-and-restore-choices.md`) written; owner confirmed the F92 and F93 readings.

## Where we stopped
(updated through the night; see the end of this file)

## Open questions for the owner
- Chooser (spec 40 B): (1) a parent's own rows (not in any child) count when the parent is fully ticked, not when partly ticked; with one child, ticking it ticks the parent. OK? (2) The footer "Top 5" / "All spending" applies at once, next to "Clear all" that only unticks until Apply. Keep both?
- Budgets on Categories (spec 40 A): group headings now have their own budget box, drag handle and Move button; the list is now on `lib/roving.ts`. Please try mouse drag-and-drop, and selecting digits in a budget box (the line must not start dragging): OWNER-TESTS 12.4.
- F28 update button for the friend: step 1 (opens GitHub Releases) or step 2 (in-app download)?
- Section 8 tests (waves 10 to 12) before `dev` goes to `main`; section 10 partly open.

## Next steps
1. Owner tests OWNER-TESTS section 12 (round 2) and, once merged, section 13 (spec 41).
2. Push `dev` when the owner says.
3. Release prep for the friend (0.1.0, F28, F57, pre-release).
4. Later: rethink default categories (F94), F67 net worth design note.

## History
- 2026-11-27 (night): round 2 (lead fixes, spec 40) merged; spec 41 and the round 2 review overnight; not pushed.
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

## Night log
- 01:45 round 2 merged, check green (1298 tests). Sleep block `coinleak-awake5` on until about 06:30.
- 01:55 spec 41 agents `round3-rules`, `round3-restore` (Sonnet) and `round2-review` (Opus) started in tab 2.
- 02:10 round 2 review (Opus, `docs/reviews/2026-11-27-round2-review.md`): good to merge after owner tests; should 1 (chooser drops a parent's own rows when partly ticked: note now, "Other in <parent>" later is the owner's call) and nice 1 to 4 sent to spec 42 B; should 2 (REQUIREMENTS row) done by the lead.
- 02:20 spec 41 B (restore choices, F93) merged; lead fix `302490c`: the copy is trimmed before it becomes a profile.
- 02:30 owner: F1 not tonight (new scrapers only ship in releases); focus on Windows download and use. Lead: `app:openLink` (`7d03552`, three fixed GitHub pages by name), README install/update/banks, RELEASE.md publish steps, SHA256SUMS in `dist:win`, spec 42 (About section, round 2 polish) to `wave16-about` and `wave16-polish`.
- 02:40 spec 41 A (newer rules win, hints, "Set by you", F92) merged; check green, 1324 tests. Trial `dist:win` build running.
