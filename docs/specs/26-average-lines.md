# 26 Average lines on the Home charts (wave 11)

## Goal

Help the owner choose budgets ("what should my supermarket budget be?") by
showing what an average month looks like on the charts he already uses.
Owner feature F63 (`docs/FEATURES.md`), widened 2026-11-14 to the line
charts.

## The one definition (core owns it)

**The average month** for a chart = the mean of the spending of the
*average months*: every full calendar month inside the chart's 12-month
window (the same months the month-by-month bars show), excluding

- the current month (not finished yet), and
- months before the profile's first transaction (no data yet, not zero
  spending).

Same filter as the chart: All / Routine / Treats / Neither and the ticked
categories. Spending uses the same rules as the bars (refunds, card bills
once, excluded, internal, trashed and gone rows). Fewer than 2 average
months: no average is shown (one line, "Not enough history for an
average yet").

Integer agorot, rounded to whole agorot, computed in core. The renderer
only draws what core returns.

## Owns

- `src/core/ledger/period.ts` (or a new `src/core/ledger/average.ts`
  with tests if that keeps `period.ts` readable), `period.test.ts`,
  `period-curves.test.ts`, `src/core/ledger/index.ts` (export line)
- `src/main/handlers.ts`: only the trend and curve channels
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/renderer/src/components/home/trend-card.tsx`,
  `spending-curve-card.tsx`, `category-curves-card.tsx`, `period-data.ts`
- `src/renderer/src/lib/api.ts`, `hooks.ts`, `query-keys.ts`: additive only
- `src/renderer/src/strings.ts`: append at the end in a `// spec 26` block

Do not touch budgets, categories, profiles, card bills or packaging.

Read first: `AGENTS.md`, `docs/ARCHITECTURE.md`, `periodTrend` and
`periodCurves` in `src/core/ledger/period.ts`, the three cards above.

## Build

1. **Month-by-month bars.** A horizontal dashed line at the average
   month, across the whole chart, labeled at its right end "Avg ₪X". It
   follows the filter and ticked categories. Hovering the label (or the
   tooltip of any bar) says "Average of N full months, <first> to
   <last>". The line never changes the bars' scale so much that bars
   become unreadable (the Y axis already starts at 0; just make sure the
   line is inside the domain).
2. **Spending through the month** (`spending-curve-card`) and the
   **category curves** (`category-curves-card`): an *average-month curve*.
   For day d (1 to 31), the average across the average months of
   cumulative spending up to day d; a month shorter than d contributes
   its month-end total. Its last point equals the bar line's value for
   the same filter and category. Drawn as a dashed line in a neutral color
   with the legend "Average month".
   - These charts already show a dashed "last month" line. Add a small
     switch "Compare with: Last month | Average month". Default: Last
     month (today's look is unchanged until the owner chooses). Remember
     the choice per profile like Home's All / Routine / Treats switch.
   - Category curves: one average curve per shown category, same color as
     the category, dashed.
   - Only for month periods. For other period lengths keep today's
     comparison and hide the switch.
3. **Core API.** Return the average with the data the charts already
   fetch (for example an `average` field next to the trend points and an
   `average` series next to `previous` on each curve), plus the months it
   used (`from`, `to`, `count`). Keep the existing fields as they are.

## Tests (definition of done)

- Average: excludes the current month and months before the first
  transaction; 12, 5 and 1 full months (1 gives none); follows the filter
  and ticked categories; refunds and card bills as on the bars.
- Average curve: a 28-day February next to 31-day months (day 31 uses
  February's month-end total), cumulative and non-decreasing for
  spending-only data, last point equals the bar average.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  the bars with the average line (All, and one ticked category), the
  spending curve and the category curves in "Average month" mode.

## Report

What you built, how the API carries the average, commits, anything
outside Owns, screenshot paths, doubts.
