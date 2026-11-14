# Handoff: CoinLeak
_Last session: 2026-11-14 · branch: dev · last commit: 6da9356 Merge wave 10: Windows installer (spec 29)_

## Today in one line
Wave 10 started with three agents: the Windows installer is built and merged; budgets and the categories/fixes work are committed on their own branches but not reviewed or merged yet.

## What we did
- This computer: installed packages (`npm ci`, `npm run setup`), set the repo-local git name and email (copied from earlier commits), switched to `dev`.
- Owner decisions today:
  - Weekly budget = monthly budget / 4. Weeks run Sunday to Saturday.
  - New default categories also apply to existing profiles, but only to categories that still look like the defaults.
  - Clothes & Shoes is one category. A new Work group.
  - "Essentials / Extras" becomes "Routine / Treats" in the app.
  - The "Me" profile (any profile) can be deleted.
  - No separate "hide" switch: fix the "Card bill?" flag instead.
- Specs written and committed: `docs/specs/27-budgets.md`, `28-categories-and-fixes.md`, `29-windows-installer.md` (70aa9a8).
- **Spec 29, Windows: merged into `dev`** (6da9356), `npm run check` green.
  - `npm run dist:win` builds `release/CoinLeak-Setup-0.0.1.exe` (135 MB, unsigned, per user) from Linux, using electron-builder 26.18.0.
  - Fuses are checked on the built exe.
  - Production dependencies are unchanged.
  - The built installer is at `release/` in the main checkout. It is git-ignored and does NOT include specs 27 and 28 yet.
- **Spec 27, Budgets:** branch `wave10/budgets` (2 commits), worktree `.claude/worktrees/agent-ac6fa12a6e40d45e3`.
  - Migration 0012 (`categories.monthly_budget`) and core `budgetStatus` / `setBudget` in `src/core/ledger/budgets.ts`.
  - A Budget field on Categories, a Budgets card on Home with a month/week toggle, and Demo budgets.
  - Full check was green before the last small Demo change; core tests and the build passed after it.
- **Spec 28, Categories and fixes:** branch `wave10/categories` (4 commits), worktree `.claude/worktrees/agent-a2f7551039d924242`.
  - Card-bill fix (8c94b9c): "Count again" after "This pays a card I track" plus Ignore now hands the line back to the matcher.
  - Migration 0013: the new category layout, with tests.
  - Starter lists and Demo moved to the new categories.
  - Routine/Treats strings.
  - 931 tests pass. Full `npm run check` not run.

## Where we stopped
- `dev` is clean apart from this file. It is 6 commits ahead of `origin/dev` (not pushed).
- Both agent branches are local only, committed, and not reviewed or merged.
- No agents or processes are running.
- **Spec 28 part 3 (delete any profile, including the open one and the last real one) is NOT started.**
- No screenshots were taken for spec 28. Spec 27 has 4 screenshots nobody has looked at, in its worktree's `.claude/shots/`. The Categories ones are the important ones.

## Dead ends / don't retry
- Do not run built `.exe` files under wine: it pops up Wine Mono on the owner's desktop. `scripts/dist-win.sh` uses its own wine folder (`~/.cache/coinleak-wine`) with Mono and Gecko turned off. That works silently.
- electron-builder's NSIS step always runs wine once (to make the uninstaller). That is expected.
- Agent worktrees started at ab7ba89 (old `main`), not `dev`. Both agents branched from `dev` themselves. When starting new agents, tell them to branch from `dev` explicitly.
- A stale `npm run dev` keeps old main-process code after a merge. Restart it.
- `strings.ts` conflicts on merges: keep both blocks.

## Open questions / decisions for the user
- Send the brother the installer now (no budgets yet), or wait for the rebuild after 27 and 28 merge? Recommended: wait.
- `~/.wine` was created by the first, failed build. It is not needed; the owner may delete it.
- Push `dev` and the two `wave10/*` branches (owner only).
- Still open from 2026-11-10:
  - an example of the Home charts that contradict each other
  - the owner tests from that day (Uncategorized filter, month-by-month bars, rule editor bug details)

## Next steps
1. Finish spec 28 part 3 (delete any profile) on `wave10/categories`:
   - `src/main/profiles.ts` `deleteProfile`, the delete channel in `handlers.ts`, the Settings dialog wording, `profiles.test.ts`.
   - Then `npm run check` and screenshots.
   - Also fix the `newMetaIntro` hint, which still says "Food holds Groceries".
2. Review spec 28 outside Owns: test fixture changes in `src/core/testing/` (`newDb()` now skips 0013). Also its note: `undoInternal` in `src/renderer/src/lib/review.ts` returns true for any internal row, so undo can leave an auto-matched line protected. Decide whether to fix it.
3. On `wave10/budgets`: rerun `npm run check`, then look at all screenshots (Categories budget field in rows and group headers).
4. Merge `wave10/budgets`, then `wave10/categories`, into `dev`. Expect `strings.ts` and Demo conflicts. Rerun `npm run check` after each merge.
5. Rebuild the installer: `npm run dist:win`, output in `release/`.
6. Tell the owner what to test:
   - budgets month and week
   - the new categories on a real profile
   - Routine/Treats
   - the card-bill undo
   - deleting "Me"
   - the brother installs the `.exe` on Windows (Edge sync)
7. After testing: update `docs/FEATURES.md` (F59, F55) and `docs/STATUS.md`, merge `dev` into `main`.

## History
- 2026-11-14: wave 10 started (specs 27 budgets, 28 categories/fixes, 29 Windows); Windows installer merged and built; 27 and 28 committed on branches, unmerged.
- 2026-11-10 (later): Uncategorized filter matches Needs review (F64); budgets F59 planned; F63 yearly average line requested; chart contradictions reported.
- 2026-11-10: spec 25 cleanup merged; wave 9 done; F62 savings chart requested; month-by-month bar fixes.
- 2026-11-09 (evening): waves 8 and 9 (specs 20 to 24) merged; F61 chart controls requested.
- 2026-11-09 (later): F45 decided; specs 16, 17, 18, 19 merged; profiles replace the demo; owner test lists written.
- 2026-11-09: wave 5 merged; skipped-migration fix; wave 6 specs 16 to 18 started (17 done); code review saved.
- 2026-11-08: Cal verified; feature list; waves 4 and spec 14 merged; specs 13 and 15 in flight.
