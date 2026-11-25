# 38 Charts: click through to Transactions, and a better category chooser (wave 15)

## Goal

Owner features F78 and F79 (`docs/FEATURES.md`), owner feedback of
2026-11-25.

1. **Month by month bars click through (F78).** Owner: "clicking on a
   category bar when it's already only one category that appears, should
   send me to the transactions tab, to the relevant time where I clicked
   ... [the category] on the legend [opens] the entire year, filtered on
   the category."
2. **"Spending by category through the month" gets a better chooser
   (F79).** Owner: the dropdown "looks a bit hard to interact with", and
   the 5-category limit "seems a bit funny ... look up what they did in
   Sure." Sure: one button ("All categories" or "3 categories") opens a
   searchable list with tick boxes and Apply; the chosen categories are
   added up into one line and compared with earlier months, so there is no
   limit. We do the same.

## Owns

- `src/core/ledger/period.ts`: only `periodCurves` and what a summed curve
  needs (a match on a list of categories); `period-curves.test.ts`
- `src/core/settings.ts`: only the `homeCurveCategories` validator (the
  length cap), and its test
- `src/shared/types.ts`, `ipc.ts`: additive only;
  `src/main/handlers.ts`: only your channels
- Renderer: `components/home/trend-card.tsx`, `trend-category-picker.tsx`,
  `trend-filter.ts`, `category-curves-card.tsx`,
  `curve-category-picker.tsx`, `curve-selection.ts`, `period-data.ts`,
  their tests, a new shared chooser (for example
  `components/home/category-chooser.tsx`), `pages/home-page.tsx` (only
  the open handlers), `lib/api.ts`, `lib/hooks.ts`, `lib/query-keys.ts`
  (additive)
- `src/renderer/src/strings.ts`: edit the `curves`, `curvePick` and trend
  hint strings, and append new ones in a `// spec 38` block at the end

Do not touch budgets, the Budgets card, the Categories page, Settings,
profiles, migrations or any window security file (specs 37 and 39 work
there now). Ask in your report for any change outside Owns.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 6 and 7,
`docs/specs/16-periods-home.md`, `26-average-lines.md`,
`34-nested-categories.md` (one level at a time),
`36-keyboard-lists-and-trash.md` and `lib/roving.ts` (use it for every
list here; never a new helper), `trend-card.tsx`, `category-curves-card.tsx`,
`components/transactions/list-view.ts` (the `category=` link takes several
categories).

## Build

### F78: Month by month

1. **All spending** (nothing ticked): as today, clicking a segment or a
   legend name ticks that group and shows it one level down.
2. **Ticked view**, one level at a time (spec 34):
   - Clicking a segment whose category has children ticks that category
     (one more level down; `toggleTick` already unticks its parent).
   - Clicking a segment with no children, "Other in <name>" or
     Uncategorized opens Transactions for **that month**, filtered to that
     category (everything under it; "Other in" only the category's own
     rows, as today).
   - Clicking a **legend name** opens Transactions for **the whole range
     the bars show** (the 12 months or more), filtered to that category.
     Unticking moves to the picker and the Back button.
   - Update the hints under the tooltip and on the legend names to say so.
3. **Keyboard.** The legend is one roving list (arrows move, Enter does
   what a click does). The bars are one Tab stop: Left and Right move the
   lit month (the same look as pointing), Enter opens that month in
   Transactions with the chart's filter (the ticked categories, or all
   spending).
4. Opening a range: set the app's period to that custom range (the period
   context already has custom dates), then open Transactions with the
   category link, as the month case does.

### F79: Spending by category through the month

5. **One chooser button** in the card header replaces the "Top 5 /
   Choose" switch and the old dropdown. Its label: "Top 5" (the default),
   the category's name when one is chosen, or "3 categories".
6. **The chooser** (a popover): a search box on top (matches full paths,
   "Groceries › Weekly shop", like the category picker), the spending tree
   with a tick box per line (three levels, indented), Uncategorized at the
   end, and a footer with "Top 5" (clear) and "Apply". Ticks are a draft
   until Apply; Esc or clicking outside drops them. **No limit.** Ticks
   never overlap, as on the bars: ticking a category unticks everything
   under and above it (reuse `toggleTick`). Keyboard: typing goes to the
   search box, Down moves into the list (one roving list), Space ticks,
   Enter applies, Esc closes.
7. **Drawing.**
   - "Top 5": as today, one line per top category, the legend toggles
     lines, the dashed comparison as today.
   - Chosen categories: **one line, the chosen categories added up**,
     against last month or the average month (the Compare switch, as on
     the "Spending through the month" card). The legend names them
     ("Groceries, Coffee and Fuel", or "Groceries and 4 more" past three).
     Clicking a point opens Transactions for that period with all chosen
     categories (`category=` takes several).
   - The choice is still saved in `homeCurveCategories`; raise its cap to
     what a full tree can hold (500), and drop `MAX_CHOSEN`.
8. **Core.** A summed curve for a list of categories (each row counted
   once; the list never overlaps, but do not rely on that: match a row
   when its category is any of them or under any of them), with its
   previous period and average month, from the same code as the single
   curves (a list `Match`, not a copy). One new channel or an optional
   argument on `summary:periodCurves`, your choice; say which in the report.
9. **The month by month card's picker** uses the same chooser (search,
   tick boxes, Apply), with that card's own meaning (ticked categories
   are shown side by side as stacked bars, as today), so both pickers look
   and work alike. Keep its limit if core has one, and say so in the
   chooser.

## Tests (definition of done)

- Core: a summed curve equals the sum of the single curves for categories
  that do not overlap; a parent and its child together count each row once;
  Uncategorized in the list; previous and average for the sum; the
  settings cap.
- Renderer (plain functions): what a click does in each case of item 2
  (drill, open month, open range) as a tested function; the chooser's
  draft, Apply, clear and the no-overlap rule; the chooser's label
  ("Top 5", one name, "3 categories").
- `npm run check` green. Screenshots light and dark on the Demo profile:
  the chooser open with a search typed and three ticked; the curves card
  with the summed line and its comparison; the bars drilled two levels
  down; the Transactions page after a legend click (the range and the
  category filter visible).

## Report

Write it to `.claude/shots/REPORT.md`: what you built, the channel choice,
commits, anything outside Owns, screenshot paths, doubts.
