# 12 Home: spending by category through the month, Today, chart research (wave 4)

## Goal

Owner features F4, F5 and F13 (`docs/FEATURES.md`). Let the owner see how
one category, or the top categories, build up through the month, jump
back to the current month in one click, and get a short research report on
which charts show the flow of money best.

## Owns

- `src/core/ledger/curves.ts` (new) and its test; export it from
  `src/core/ledger/index.ts`
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/main/handlers.ts`: the new channel only
- `src/renderer/src/pages/home-page.tsx`, `src/renderer/src/components/home/**`,
  `src/renderer/src/components/charts/**`
- `src/renderer/src/components/layout/month-picker.tsx`,
  `src/renderer/src/lib/month*.ts*`
- `src/renderer/src/lib/demo.ts`: answer the new channel only
- `src/renderer/src/strings.ts`: append at the end in a block headed
  `// spec 12`
- `docs/research/money-charts.md` (new)

Do not touch `queries.ts` or `flow.ts` (another agent changes them
tonight). Read rows only through `LEDGER_SQL` and `SPENDING_FLOWS_SQL` so
new flows (a `trashed` flow is coming) are handled automatically.

## Build

1. **Core: category curves.** `categoryCurves(db, { month, categoryIds })`
   returns, for each requested category, cumulative spending per day of
   that month and of the previous month (for a faint comparison line).
   A top-level id includes its subcategories; `null` means uncategorized.
   Agorot, refunds reduce spending, same flows as `summary:month`. Channel
   `summary:curves`.
2. **Home card "Spending by category through the month"**, next to or
   below the existing spending curve, same look:
   - Mode "One category": a category picker (top-level and subcategories);
     the line for this month and a faint line for last month.
   - Mode "Top categories": one line per top-level category for the top 5
     by this month's spending (order taken from `summary:month`'s
     `byParent`), each in its category color, with a legend that toggles
     lines on and off.
   - Hover shows the day and the amount; clicking a point opens
     Transactions filtered to that category and month, like the other
     charts.
3. **Today button** (F13) next to the `< Month >` arrows: jumps to the
   current month; hidden or disabled when already there. Works wherever
   the month picker appears.
4. **Research report** `docs/research/money-charts.md`, for the owner (plain
   words, no code): 6 to 10 chart types that show where money comes from
   and goes (for example Sankey flow, waterfall of a month, calendar
   heatmap, treemap, stacked area by category, small multiples), each
   with what question it answers, when it misleads, how well it fits
   CoinLeak's data and look, and whether Recharts can draw it. End with
   a ranked recommendation of the top 3 to build next. Use your own
   knowledge plus the Recharts docs in `node_modules`; no web access is
   needed and none of the owner's data.

## Tests (definition of done)

- `categoryCurves`: cumulative per day, a parent includes its children,
  uncategorized, refunds reduce, excluded and internal and gone rows do
  not count, previous month for comparison, empty month.
- The Today button's month logic.
- `npm run check` green. Screenshots, light and dark: the new card in both
  modes with demo data, the Today button.

## Report

What you built, the new channel, the research file's top 3, and the
screenshot paths.
