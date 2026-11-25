# Handoff: CoinLeak
_Last session: 2026-11-25 (evening and night) · branch: dev · last commit: the "docs: handoff" commit after 3ca10db (not pushed; nothing pushed since d837cdd)_

## Today in one line
Wave 14 review fixes and all of wave 15 (Budgets page, chart clicks and chooser, backup and restore) built by herdr agents, merged, reviewed; the owner tested wave 15 and sent feedback (F87 to F94), which plus the review fixes is "wave 15 round 2", not started.

## What we did
- **Wave 14 review fixes** (owner said go), merged: `00bcde4` keys (last lists on `useRoving`, `arrowFocus` deleted), `42e17c4` categories (closed picker does no work), `59bc7c9` ruleticks (ticking back keeps a hand-set row yours; editor list on useRoving; "Already here" / "Higher rule" rows). OWNER-TESTS 10.6 and 10.13.
- **Wave 15**, specs `docs/specs/37-budgets-page.md`, `38-chart-clicks-and-chooser.md`, `39-backup-and-restore.md`, merged: `1891ebf` charts (F78, F79), `d8a4a2b` budgets (F73), `712698d` backup (F56), plus `35d61bf` chart keys in the `?` list. `npm run check` green, 1276 tests. Screenshots: `.claude/shots/wave15/` (`merged/` is the combined app).
- **Wave 15 code review**: `docs/reviews/2026-11-25-wave15-review.md` (`8f2ef3c`): merge after fixes. Must fix: (1) `src/core/db/backup.ts:114` a trigger renamed `sqlite_stat1` passes the restore check (drop that filter, compare every entry, add the test); (2) `budgets.ts:153` lowering a budget is refused when its parent is already over (refuse only changes that make it worse). Should fix: summed curve name as a keyboard button; budget keys in the `?` list; core sends "left inside". Nice to have 1 to 5 (Ignore rule over hand-ignored rows; `settings:set` refuses `budgetTotal`; backup temp file 0600 first and CSV guard on every text column; hide "Use this" at ₪0 income; new screenshot hooks to the backlog).
- **Owner tested wave 15** (OWNER-TESTS section 11): month by month clicks, backup and CSV work. Feedback logged as **F87 to F94** in `docs/FEATURES.md` (owner's words there).
- The night sleep block (`coinleak-awake4`) was stopped at the end of the session.

## Where we stopped
- `dev` clean and committed, check green (1276 tests). **Not pushed** (70+ commits since `d837cdd`). `main` untouched.
- herdr tab 2: idle agents `wave15-budgets` (`w1:pW`), `wave15-charts` (`w1:pX`), `wave15-backup` (`w1:pY`), `wave15-review` (`w1:pJ`, done). Worktrees `.claude/worktrees/wave14-*` and `wave15-*` still exist (all merged). Tab 1 runs the owner's `npm run dev`.
- **Wave 15 round 2 not started**: no spec written, nothing sent to agents.
- After a reboot the panes are gone; each agent resumes with `claude --continue --model opus --effort xhigh --permission-mode auto` inside its worktree (or `herdr agent start <name> --kind claude --pane <id> -- --continue ...`).

## Open questions / decisions for the user
- F93: restore "choose what to keep" covers "just the transactions", so no CSV import (CSV stays for Excel). OK?
- F92: lead's reading: a new rule goes on top (wins), starter lists stay at the bottom, manual reordering on the Rules page stays. OK?
- F28 update button for the friend: step 1 (opens GitHub Releases) or step 2 (in-app download)?
- Section 8 tests (waves 10 to 12) before `dev` goes to `main`. Section 10 (wave 14): owner confirmed items 2 and 7 tonight; the rest of 10 still open.

## Next steps
1. Write `docs/specs/40-wave15-round2.md` from F87 to F94 and the review, in four parts, then send each to an agent (each worktree: `git merge --ff-only dev` first; report to `.claude/shots/REPORT-round2.md`):
   - **Budgets agent** (`wave15-budgets`): F87 budgets onto the Categories page (total card, split bar, usual month, boxes, raise offer; remove the Budgets page, route and `U`; Home link to Categories), F88 on Categories (guide lines, clear indent), F89 thousands separators in money boxes, F90 Finance accounts key `A`, moving a category that breaks a budget: allow and warn (owner, tonight), review must 2, should 1b (budget keys in `?`), should 2, nice 2, nice 4.
   - **Charts agent** (`wave15-charts`): F91 chooser rework (tree tick boxes with cascade and partial state, a "Selected" chips row, Clear all, clear nesting), review should 1a (summed line name as a button).
   - **Backup agent** (`wave15-backup`): review must 1 and nice 3, F93 choose what to keep on restore, F94 no third-level defaults for new (empty) profiles only (migration 0017 guarded on an empty database; the Demo seed makes its own level 3 examples; existing and restored profiles keep theirs).
   - **Rules agent**: resume `wave14-ruleticks` in a new tab 2 pane with `--continue`: F92 (new rules on top, so every row of a new rule gets a box; contradiction hints naming the other rule, in the editor and on the Rules page), review nice 1. New rules are placed by `nextPosition` in `src/core/rules/store.ts:95` today (bottom).
2. Review each report and screenshots, merge, screenshot the combined app (lesson: bugs appear only after merging), `npm run check`, then a fresh `/review-code` of round 2.
3. Owner tests round 2, then push `dev` when the owner says. Then release prep for the friend (0.1.0, F28, F57, pre-release).
4. Later: rethink default categories (F94), F67 net worth design note.

## History
- 2026-11-25 (evening, night): wave 14 review fixes merged; wave 15 (specs 37 to 39: Budgets page, chart clicks and chooser, backup, restore, CSV) built, merged, reviewed (merge after fixes); owner tested and sent F87 to F94; not pushed.
- 2026-11-25 (overnight, morning-lead): wave 13 code review and its two fixes; wave 14 (specs 34 to 36) built by herdr agents, merged with two fixes found after merging; not pushed.
- 2026-11-25: Sure comparison; feedback F67 to F86; wave 13 (specs 31 to 33) built by herdr agents, merged, owner tested, pushed.
- 2026-11-23: short session; F66 keyboard shortcuts requested and logged, next feature.
- 2026-11-19: whole-code review; 5 fixes merged (startup without window, today rollover, one shekel parser, Transactions page split, chart helpers); dev pushed; F65 refund idea logged.
- 2026-11-18: wave 12, Saved or overspent bars per month (spec 30, F62), merged; clicking a bar opens that month.
- 2026-11-17: security docs and Windows VM results merged; Add cash on the Transactions welcome screen.
- 2026-11-16: shipping plan; herdr agents ran the Windows VM test (passed) and wrote the security docs; both on branches, unmerged.
- 2026-11-15: wave 11 merged (spec 26 average lines, F61 curve categories); specs 27 and 28 merged; publish checklist written; repo is public.
- 2026-11-14: wave 10 started (specs 27 budgets, 28 categories/fixes, 29 Windows); Windows installer merged and built.
