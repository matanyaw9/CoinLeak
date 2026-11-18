# Handoff: CoinLeak
_Last session: 2026-11-19 · branch: dev · last commit: ca4a27e Merge fix/transactions-page-split: the Transactions page in smaller parts_

## Today in one line
Reviewed the whole codebase, then fixed the 1 must-fix and 4 should-fix findings. Each fix was its own `fix/...` branch, merged into `dev` and pushed. `main` is untouched.

## What we did
- **Full code review.** Verdict: healthy. `npm run check` was green: typecheck, lint, 992 tests, build.
- **Fixes**, all merged into `dev`. The check is still green, now 1017 tests.
  1. `fix/startup-error`: a data file that will not open no longer leaves CoinLeak running with no window.
     - The window opens and shows the DATABASE message (`src/main/startup.ts`).
     - Any other startup failure shows an error box and quits (`src/main/index.ts`).
     - Verified by breaking `profiles.json` on purpose.
  2. `fix/today-rollover`: `useToday()` in `src/renderer/src/lib/month-context.tsx` re-reads the date every minute and on window focus. A new day refreshes all queries. Verified by faking a jump to December 1st.
  3. `fix/one-shekel-parser`: one float-free `parseShekels` and `shekelText` in `src/shared/money.ts`, used by the rule editor (`readAmount`), cash rows and budgets. The window no longer uses `toAgorot`.
  4. `fix/transactions-page-split`: `transactions-page.tsx` went from 562 to 375 lines.
     - New files in `components/transactions/`: `use-selection.ts`, `row-menu-entries.ts` (tested), `rule-offer.ts`, `day-header.tsx`, `demo-shot.ts`.
     - The shift-click rule is `toggleRow` in `selection.ts`, now tested.
  5. `fix/chart-slice-helpers`: `categorySlice` and `otherSlice` in `lib/categories.ts`. The dead `topSlices` is removed.
- Fixes 4 and 5 were checked with screenshots taken on `dev` before and on the branch after. All 13 pairs are byte-identical.
- Pushed `dev` to GitHub: 25 commits, including the unpushed work from 11-17 and 11-18.
- Owner idea logged as **F65** in `docs/FEATURES.md`: money back for a purchase should count as less spending, not income. See the open questions below.

## Where we stopped
- `dev` is clean and pushed, except this handoff and the F65 line, which are committed at wrap-up but not pushed.
- The worktree and branches used for the fixes are deleted. No background processes are running.
- The owner has not yet tested today's fixes, or F62 (the Saved or overspent bars) from 11-18.

## Dead ends / don't retry
- **zsh does not split `for n in $list`.** One screenshot loop silently shot a single wrong page. Write multi-shot loops as a bash script, or as explicit calls.
- **Vitest picks the wrong folder when the shell's working directory is wrong.** The aliases in `vitest.config.ts` resolve from the working directory, so a run from inside `src/shared` failed with "Cannot find package @shared/errors". Run from the checkout root.

## Open questions / decisions for the user
- **Test today's fixes:**
  - Add a cash row of "12.5".
  - Set a budget.
  - Make a rule with amount "58.90", then reopen it and check the amount is unchanged.
  - Shift-click a range of rows; use the "…" menu; sort a row by hand to see the "Always put X in Y?" offer.
  - If possible, leave the app open overnight: next day, "Last 7 days" should include today.
- **F65, refunds:** the money model already counts money in with a spending category as a refund (less spending). The seeded "Refunds & Reimbursements" category is an *income* category, though, so refunds put there count as income.
  - Workaround now: give the refund the spending category it came back for.
  - Later: decide how to make this obvious (a "This is a refund" choice, or change the seeded category).
- Still open from 11-16:
  - GitHub settings by hand: private vulnerability reporting, Dependabot, secret scanning with push protection, protect `main`.
  - Ship 0.1.0 to the brother as a pre-release?

## Next steps
1. The owner tests `dev` (list above, plus F62). If good, merge `dev` into `main`.
2. Release 0.1.0 (plan in `docs/PUBLISH-CHECKLIST.md`):
   - bump the version
   - `npm run check`
   - merge into `main`, tag `v0.1.0`
   - build in the **main checkout** with `npm run dist:win` (never in a worktree with a symlinked `node_modules`)
   - draft a GitHub pre-release with the `.exe` and its SHA-256
3. Retest SmartScreen in the VM from the draft Release, using the `clean` snapshot.
4. Optional cleanups from the review's nice-to-have list:
   - dead code: `hasFilters`, `formatDateNumeric`, `Separator`, and core's test-only `monthSummary` and `trend`
   - the card-bill count query on Transactions runs even when unused
   - a quadratic array copy in `wouldCategorize` (`src/core/rules/engine.ts`)
   - a settings save inside a `setAdded` updater (`lib/sync.tsx`)
5. Before strangers: F28 step 1, F56 backup, F57 experimental labels, F27 feedback buttons. Also, "Delete everything" leaves the theme setting behind.
6. Later: design F65 (refunds as less spending).

## History
- 2026-11-19: whole-code review; 5 fixes merged (startup without window, today rollover, one shekel parser, Transactions page split, chart helpers); dev pushed; F65 refund idea logged.
- 2026-11-18: wave 12, Saved or overspent bars per month (spec 30, F62), merged; clicking a bar opens that month.
- 2026-11-17: security docs and Windows VM results merged; Add cash on the Transactions welcome screen.
- 2026-11-16: shipping plan; herdr agents ran the Windows VM test (passed) and wrote the security docs; both on branches, unmerged.
- 2026-11-15: wave 11 merged (spec 26 average lines, F61 curve categories); specs 27 and 28 merged; publish checklist written; repo is public.
- 2026-11-14: wave 10 started (specs 27 budgets, 28 categories/fixes, 29 Windows); Windows installer merged and built.
- 2026-11-10 (later): Uncategorized filter matches Needs review (F64); budgets F59 planned; F63 yearly average line requested.
- 2026-11-10: spec 25 cleanup merged; wave 9 done; F62 savings chart requested; month-by-month bar fixes.
- 2026-11-09 (evening): waves 8 and 9 (specs 20 to 24) merged; F61 chart controls requested.
- 2026-11-09 (later): F45 decided; specs 16, 17, 18, 19 merged; profiles replace the demo; owner test lists written.
