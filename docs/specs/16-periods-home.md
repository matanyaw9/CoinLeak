# 16 Time periods and Home charts (wave 6)

## Goal

Look at any stretch of time, not only a calendar month, and make Home's
charts calmer and more useful. Owner features F14, F30, F31, F40
(`docs/FEATURES.md`), plus F43 and F44.

## Owns

- New `src/core/ledger/period.ts` and its tests: summaries for a date range
- `src/core/ledger/queries.ts`: only `totals`, `spendingByParent`,
  `monthSummary`, `trend` (keep them working; month functions may call the
  range ones)
- `src/core/ledger/money-flow.ts`, `src/core/ledger/curves.ts` and tests
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only (new channels
  next to the month ones; do not remove month channels)
- `src/main/handlers.ts`: your new channels only
- `src/renderer/src/lib/month-context.tsx` (add a period context),
  `lib/month.ts` (add period helpers), `components/layout/month-picker.tsx`
- `src/renderer/src/pages/home-page.tsx`, `components/home/**`
- `src/renderer/src/lib/demo.ts`: summary channels only;
  `lib/demo-flow*.ts`
- `src/renderer/src/strings.ts`: append at the end in a `// spec 16` block

Do not touch `transactions-page.tsx` or `components/transactions/**`
(spec 17), categories, rules or sync files (spec 18). Keep `useMonth()`
working exactly as today, so Transactions keeps running; the lead moves it
to the period at merge. No migration expected; if you need one, it is 0010.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 3, 5 and 7,
`docs/specs/12-home-charts.md`, `docs/specs/14-money-flow.md`,
`docs/research/money-charts.md`, and the `dataviz` guidance if available.

## Build

1. **Periods (F14).** A period is `{ from: IsoDate; to: IsoDate }` plus
   how it was chosen. The picker in the top bar offers: This month (the
   default, with the existing arrows and Today), Last 7 days, Last 30 days,
   Last 12 months, This year, and Custom (from and to dates). Arrows step a
   month or a year when that is the choice; hidden otherwise. The choice
   lasts for the session, not across restarts.
2. **Core by range.** Totals, by-category, by-parent, transfers, money
   flow and curves for any range, with exactly the month rules (flows,
   card bills, transfers, trash, ignored). A range equal to a month must
   give the same numbers as the month functions (test it). Daily series
   for ranges up to 62 days; weekly beyond that; monthly beyond a year.
   Core says which bucket it used.
3. **Home follows the period.** Every card uses it. Labels say the period
   ("Spent in the last 7 days", "Spent this year"). The trend card shows
   the last 12 months up to the period's end, more when the period is
   longer. Clicking Neither shows only that spending, by category; "All
   spending" in its category list always goes back to everything.
4. **Pie chart hover (F40).** One tooltip at a time that never covers the
   slice under the pointer; no labels drawn on top of each other. Small
   slices group into "Other" in the chart, but the list beside it shows
   every category.
5. **Overspending (F30).** When spending plus transfers is more than
   income, the Sankey does not show "From savings / earlier months".
   Instead it shows one node on the left, "Spent beyond income", in a
   warning color, and the hero card says "You spent ₪X more than you
   earned" in the same color. Core returns the shortfall; the window only
   draws it.
6. **Group drill-down (F31).** Clicking a spending group in the Sankey
   (Food) opens a Sankey of that group: the group's total on the left, its
   categories on the right, with a clear Back. Core provides the group
   flow (`summary:groupFlow` or similar); the window never sums rows.
7. **One category over time (F43).** The bar chart (trend card) gets a
   category filter: tick one or more categories or groups (or click a bar
   segment or legend item to add it) to see only their spending month by
   month, stacked as today, with a clear "All spending" to go back. Core
   returns one series per category; the window only hides the unticked
   ones. Keep it one simple list of checkboxes, no extra modes.
8. **This month stops at today (F44).** In the "this month vs last month"
   line chart, the current month's line ends at today's date, not at the
   end of the month. Last month's line stays full length.
9. **Demo** answers the new channels with numbers that add up.

## Tests (definition of done)

- A month range equals the month functions, for every number.
- Last 7 days, 12 months and a custom range across a year boundary.
- Buckets: day, week, month by range length.
- Overspent month: no from-savings node, shortfall equals spending plus
  transfers minus income; balanced month: no shortfall.
- Group flow: categories sum to the group's total in the main flow.
- Per-category trend: each month equals that category's month total.
- Custom from and to dates: both pickable by hand; from after to is
  refused with a clear message, not silently swapped.
- The current month's daily series ends at today; past months are full.
- `npm run check` green. Screenshots light and dark: Home on This month,
  on Last 12 months, the picker open with Custom, the pie hover, an
  overspent month, a group drill-down.

## Report

What you built, the new channel shapes, how Transactions should switch to
the period (the lead does it), commits, anything outside Owns, screenshot
paths.
