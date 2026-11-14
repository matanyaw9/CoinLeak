# Handoff: CoinLeak
_Last session: 2026-11-10 · branch: main · last commit: ab7ba89 docs: F59 budgets planned, F63 yearly average line, F64 uncategorized filter_

## Today in one line
The Uncategorized filter now shows the same rows as Needs review's uncategorized part. Three new owner requests are recorded: budget bars, a yearly average line, and chart contradictions (details still needed).
I am making changes here.

## What we did
- Fix `693fd9d` (lead, no agent), owner item 3:
  - `listTransactions` in `src/core/ledger/queries.ts`: the `null` category filter now uses `ledger.flag_uncategorized` (spending or income with no category).
  - The filter used to be `category_id IS NULL`, which also took in ignored rows and moves between own accounts.
  - Tests updated in `queries.test.ts`, including one that checks the filter and Needs review return the same ids.
- Owner chose to keep possible card bills and rows the bank stopped reporting in Needs review ("keep all three, match counts").
- `docs/FEATURES.md`:
  - **F59 budgets:** moved from "after v1" to planned (spec 27). The owner wants a monthly amount per category, set on the Categories page, and a Home card with one horizontal bar per budgeted category showing spent as a percent of its budget for the chosen month.
  - **F63, new:** a horizontal line at the yearly average on the month-by-month bars (spec 26).
  - **F64, new:** the filter fix, done.
- Earlier today, before this session: waves 8 and 9 merged, and the month-by-month bar fixes (c05d830, c4ec573).

## Where we stopped
- `main` is clean and `npm run check` is green (921 tests). Nothing pushed. No agents running.
- Specs 26 and 27 are not written yet.
- The F59 row still sits in the ideas table near the bottom of FEATURES.md. Move it up when writing spec 27.

## Dead ends / don't retry
- A stale `npm run dev` causes "failed" errors after merges: the main process keeps old code. The owner must restart it.
- Rule editor closing after typing a name: could not reproduce in Demo. Waiting on owner details.
- `.claude/shots` is read-only in agent worktrees; agents save shots elsewhere, and the lead copies them.
- "Device or resource busy" on worktree removal is the sandbox; the worktrees still leave the list.
- `strings.ts` conflicts on every merge; keep both blocks and close the first with `},`.
- An agent can stop on the usage limit. Resume it with SendMessage after the reset.

## Open questions / decisions for the user
- **Charts contradict each other (owner item 1):** waiting for an example or a screenshot:
  - which two charts disagree
  - which month or period
  - whether All, Essentials or Extras was selected
  - whether categories were ticked
  - Alternative offered: the lead cross-checks every Home chart on Demo data.
- Owner to test the filter fix: restart `npm run dev`, compare Needs review's uncategorized rows with All plus the Uncategorized filter.
- Owner to test the bar fixes from earlier today:
  - tick Food and check Restaurants and Cafes show
  - hover and click Neither
  - click "All spending" from each state
- Rule editor bug details:
  - what showed after it closed
  - New rule or Make a rule
  - last action
  - was `npm run dev` restarted
- Confirm: "Left" subtracts savings; ATM withdrawals move to the wallet only from the wallet's first month.
- Owner test results: `docs/OWNER-TESTS.md` sections 3 to 6.
- `git push` (owner only).

## Next steps
1. Get the chart-contradiction example from the owner, or cross-check the Home charts on Demo if they ask. Find the cause in core (`src/core/ledger/period.ts`).
2. Write spec 26 (Home charts):
   - the contradiction fix
   - F62 monthly saved or overspent bars
   - F63 yearly average line
   - F61 All / Top 5 / Choose plus "Show all"
3. Write spec 27 (budgets, F59):
   - migration for a per-category monthly amount
   - core budget-vs-spent query
   - Categories page input
   - Home card with horizontal percent bars
4. Run specs 26 and 27 as one wave, two agents. Check file ownership overlap: both touch Home.
5. Then plan wave 10 (first public version): F55, F27, F28, F56, F57, F1.

## History
- 2026-11-10 (later): Uncategorized filter matches Needs review (F64); budgets F59 planned; F63 yearly average line requested; chart contradictions reported.
- 2026-11-10: spec 25 cleanup merged; wave 9 done; F62 savings chart requested; month-by-month bar fixes.
- 2026-11-09 (evening): waves 8 and 9 (specs 20 to 24) merged; F61 chart controls requested.
- 2026-11-09 (later): F45 decided; specs 16, 17, 18, 19 merged; profiles replace the demo; owner test lists written.
- 2026-11-09: wave 5 merged; skipped-migration fix; wave 6 specs 16 to 18 started (17 done); code review saved.
- 2026-11-08: Cal verified; feature list; waves 4 and spec 14 merged; specs 13 and 15 in flight.
