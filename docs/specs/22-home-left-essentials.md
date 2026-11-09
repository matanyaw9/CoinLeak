# 22 Home: money left this month, essentials vs extras (wave 8)

## Goal

Home answers "how much can I still spend this month, per day" and "where
can I cut": essential and extra spending on the charts that exist today.
Owner features F51, F49 (`docs/FEATURES.md`).

## Owns

- `src/core/ledger/queries.ts`: only summary functions (add yours after
  the existing summary functions; spec 20 may add transaction functions),
  `period.ts`, `curves.ts`, `money-flow.ts`, with tests
- `src/main/handlers.ts`: only your new channels or args
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/renderer/src/pages/home-page.tsx`, `components/home/**`,
  `components/charts/**`, `lib/api.ts` (your channels)
- `src/core/demo/seed.ts` only if the Demo data needs income dates that
  make the "left" card meaningful (coordinate by keeping it to one small
  function; spec 20 also edits the demo seed)
- `src/renderer/src/strings.ts`: append at the end in a `// spec 22` block

Do not touch Transactions, Categories, Rules, Accounts, `app-shell.tsx`,
or any migration (specs 20 and 21). No migration.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 4 and 7,
`docs/specs/16-periods-home.md`, `docs/specs/18-categories-sync-feel.md`
(the essential tag).

## Build

1. **Left this month (F51).** A card at the top of Home, always about the
   current calendar month (Israel time), whatever period the rest of Home
   shows. Owner decision, 2026-11-09: left = income received this month
   minus spending this month (same flows as everywhere: transfers and
   internal rows count as neither). Days left = days from today to the end
   of the month, today included. Per day = left divided by days left,
   rounded down to whole shekels. Core computes all of it in one new
   channel (`summary:thisMonth` or similar); the window only renders.
   - Positive: "₪3,240 left for 21 days: about ₪154 a day."
   - Zero or negative: no per-day number; "You spent ₪820 more than came
     in this month" in the overspent style spec 16 uses. If no income
     arrived yet this month, add "No income this month yet."
   - Hover or a small line: income so far and spent so far.
2. **Essentials vs extras on the charts (F49).** One control on Home:
   All / Essentials / Extras (segmented, remembered per profile in
   `settings` if a key fits, else in memory). It applies to the spending
   charts: hero spent number, spending curve (this vs last), the monthly
   bars (trend), the category donut and the category curves. Income lines
   stay as they are. Core filters by the category's `essential` tag
   (rows in a subcategory inherit its tag; uncategorized and untagged
   spending are neither and show only under All). Add an optional
   `essential?: boolean` arg to the period channels you need; never filter
   in the window.
   - In the trend bars under All, each bar can split into essential, extra
     and untagged (stacked), so the difference is visible at a glance; the
     tooltip shows the three amounts.
   - Under Essentials or Extras, a small line says how much spending is
     untagged or uncategorized and links to it on Transactions.
   - The money flow (Sankey) is not filtered; leave it as is.
3. **Hover highlights what a click will do (F60).** On every Home chart,
   hovering a clickable category (a bar segment, a donut slice, a curve, a
   legend entry, a Sankey stream) highlights that category in the chart:
   the others fade, and its parts in every bar light up together. The
   pointer becomes a hand. Leaving the chart restores it. Owner,
   2026-11-09: clicking a bar segment filters to that category, so the
   hover should show which category that is.

## Tests (definition of done)

- Core: left, days left and per day on the first day, a middle day, the
  last day of a month, with and without income, overspent; Israel time at
  midnight edges; transfers and internal rows excluded.
- Core: essential filter on each changed channel; totals of Essentials +
  Extras + untagged equal All for the same period.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  the left card positive and overspent, Home under All (stacked bars),
  Essentials and Extras.

## Report

What you built, channel or type changes, commits, anything outside Owns,
screenshot paths.
