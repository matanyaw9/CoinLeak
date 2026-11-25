# Handoff: CoinLeak
_Last session: 2026-11-25 (overnight run and morning) · branch: dev · last commit: the "docs: wave 14 merged" commit (not pushed)_

## Today in one line
Overnight: the wave 13 code review and its two bug fixes, then wave 14 (specs 34, 35, 36) built by three herdr agents, reviewed, merged into `dev` with two more fixes found after merging; all checks green (1179 tests). Not pushed, `main` untouched. Owner to test (`docs/OWNER-TESTS.md` section 10).

## What we did
- **05:20 code review** of everything since 2026-11-19 (`6255ff3..dev`): `docs/reviews/2026-11-25-wave13-review.md`. Two must fix, fixed on `fix/review-wave13` and merged: a new category on a paid-back row ends the link (so "Not paid back" can no longer empty a category you chose); quick sync counts from each syncing account's own last save (a card added back after a gap no longer loses months). The rest is in `docs/BACKLOG.md`; `REQUIREMENTS.md` section 5 now describes quick sync.
- **Specs 34, 35, 36** written and committed on `dev`; old merged worktrees removed (their screenshots kept in `.claude/shots/archive/`).
- **Wave 14**, three agents in herdr tab 2 (Opus 5.5, xhigh, auto), started about 05:40; the Pro usage limit paused everything from about 06:00 to 10:20, and the agents continued on their own:
  - Spec 35 (F71): a tick box on every row in the rule editor; unticked rows are the rule's exceptions and keep their category (migration 0016). Three small fixes sent back, then merged.
  - Spec 34 (F69, F70, F72): categories up to 3 levels, every level real (rows, rules, budgets), totals include everything under a category, money flow drills one level at a time with "Other in <name>", picker searches full paths; new default categories (migration 0015); Routine / Treats removed everywhere (the column and its data stay). The lead dropped four unused strings and a dead problem code, then merged.
  - Spec 36 (F83 to F86): `lib/roving.ts` (arrow keys inside a list or grid, one Tab stop per list) on the emoji and color grids, Transactions rows and Trash rows; Delete moves to Trash with Undo; `I` toggles Ignore; Trash selection and "Delete N for good" (asks, Ctrl+Enter); the Paid back dialog now opens from the page and Enter waits for the search (review should-fix 1 and 2). Merged.
- **Found only after merging**, fixed on `fix/picker-outside-router` and merged, each with a test that fails without the fix: (1) opening any rule editor blanked the window (spec 34's picker used a router hook; the rule editor renders outside the router); (2) a rule offered to move rows you sorted into a subcategory of its own category (Weekly shop, for a Groceries rule) back up to it.
- Screenshots of the merged app, light and dark: `.claude/shots/wave14/` (each agent's own shots and report in the subfolders).
- Docs: FEATURES (F69 to F72, F83 to F86 done, owner to test), REQUIREMENTS (D13, glossary, section 8), OWNER-TESTS section 10, AGENTS.md keyboard rule (use `lib/roving.ts`), BACKLOG.

## Where we stopped
- `dev` has everything, `npm run check` green (101 files, 1179 tests), nothing uncommitted. **Not pushed** (owner's rule for tonight). `main` untouched.
- herdr tab 2: the lead's pane plus three idle agent panes (`wave14-categories`, `wave14-ruleticks`, `wave14-keys`), kept open so you can scroll back; close them when done. Tab 1 still runs your `npm run dev`: restart it to get migrations 0015 and 0016.
- Worktrees `.claude/worktrees/wave14-{categories,ruleticks,keys,shots}` still exist (all merged), kept in case a test sends work back. Remove with `git worktree remove --force <path>` and delete the `wave14/*` and `fix/picker-outside-router` branches after your tests.

## Overnight run status (paused for a PC restart, 2026-11-25 late morning)
- **No merge in progress; `dev` is clean** after this commit. Every wave 14 branch is merged; no review or merge is waiting.
- **Spec 34** (`wave14/categories`, `.claude/worktrees/wave14-categories`): all 4 phases done, merged (`e36603f`).
- **Spec 35** (`wave14/ruleticks`, `.claude/worktrees/wave14-ruleticks`): done, 3 review fixes done, merged (`83778ce`).
- **Spec 36** (`wave14/keys`, `.claude/worktrees/wave14-keys`): done, merged (`4e88d8f`).
- **Fixes after merging** (`fix/picker-outside-router`, built in `.claude/worktrees/wave14-shots`): merged (`2c4b670`); `npm run check` green, 1179 tests.
- **Docs**: FEATURES, REQUIREMENTS (D13, glossary, section 8), OWNER-TESTS section 10, AGENTS.md, BACKLOG and this file are committed with this pause.
- **Left to do:** only the owner's tests (OWNER-TESTS section 10), then push `dev` when the owner says so.
- **Resume after the restart:** the herdr panes are gone, but each agent's conversation is saved. To reopen one (only if a test sends work back), open a terminal in its worktree and continue that session, for example `cd ~/Projects/CoinLeak/.claude/worktrees/wave14-keys && claude --continue --model opus --effort xhigh --permission-mode auto`, or start it in a herdr pane with `herdr agent start <name> --kind claude --pane <id> -- --continue --model opus --effort xhigh --permission-mode auto`. The lead resumes with `claude --continue` in `~/Projects/CoinLeak`, then `git pull` is not needed (nothing pushed).

## Open questions / decisions for the user
- Updates for the friend's first version: step 1 (Settings shows the version, "Check for updates" opens GitHub Releases, the friend downloads the new installer himself, no file passing) or step 2 (the app downloads and installs after a click: new dependency `electron-updater`, the app contacts GitHub, unsigned so trust rests on the GitHub account)? The owner said "updates button from the start"; confirm which.
- Which bank and cards does the friend use? Owner will check. Only Discount and Cal are verified live.
- Section 8 tests (waves 10 to 12), then merge `dev` into `main`?
- F70 default category names: the overnight run uses the lead's (Groceries › Weekly shop, Top-up, Specialty food; Transportation › Transport › Bus, Train; Transportation › Taxi & rides, Tolls, Car repairs, Car insurance, Car license & test). Rename any in the app, or say which to change.
- F71 (rule tick boxes), lead's choice in spec 35: an unticked row this rule had categorized keeps that category, now as set by you, and the rule leaves it alone from then on. The other reading is "goes back to Needs review". OK as built?
- Paid back (review, owner question): when a purchase's category changes, should the rows that paid it back follow? Today they keep the old category.
- Quick sync fix trade-off: an account the bank stopped reporting (for example an old card) keeps its "last synced" date old, so that bank's quick syncs reach further back each time (slower, never missing rows) until you remove the account from syncing. If a Cal sync is slow again, check the Finance accounts page for a card with an old "last synced".

## Next steps
00. **Lead, first thing after the restart (owner asked 2026-11-25 10:40):** run a `/review-code` session, in a fresh session (for example a herdr pane in tab 2), on everything since the morning review: `8c052ad..dev` (the two review fixes, wave 14 and the two fixes after merging). Save it to `docs/reviews/2026-11-25-wave14-review.md` and commit it on `dev`; no fixes without the owner, no push.
0. **Owner:** restart `npm run dev`, run `docs/OWNER-TESTS.md` section 10 (Demo first, then your own profile) and answer the open questions above. Item 10.8 (Tab out of the lists) could not be tested without a real keyboard.
1. Lead: fix whatever section 10 finds (the wave 14 agent panes and worktrees are still there to send work back), then push `dev` when the owner says so. Section 8 tests (waves 10 to 12), then merge `dev` into `main`.
2. Wave 15: release prep for the friend as wave 15: version 0.1.0, F28 (step 1 or 2, owner to choose), F57 experimental labels, secrets re-scan, GitHub pre-release with `.exe` and SHA-256 (`docs/PUBLISH-CHECKLIST.md`, `docs/RELEASE.md`; build from the main checkout). Then budgets page and charts (F73, F78, F79) and backup (F56).
3. Run agents in herdr tab 2 as today (see memory note: worktree per agent, `claude --model opus --effort xhigh --permission-mode auto`; `herdr agent read` scrollback is short, ask agents to write the report to `.claude/shots/REPORT.md`).
4. Write the F67 design note (net worth, investments, loans) for the owner.

## History
- 2026-11-25 (overnight, morning-lead): wave 13 code review and its two fixes; wave 14 (specs 34 to 36: 3 category levels and new defaults, no Routine / Treats, rule tick boxes, arrow keys in lists, Delete and I keys, Trash delete for good) built by herdr agents, merged with two fixes found after merging; not pushed.
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
