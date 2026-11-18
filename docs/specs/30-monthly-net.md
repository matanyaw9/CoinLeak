# 30 Saved or overspent, month by month (wave 12)

## Goal

One glance answers "did I end each month up or down?". Owner feature F62
(`docs/FEATURES.md`), asked again 2026-11-18 before the first release:
"for each month, what is the difference in my money, +1000 or -500, as
bars, red and green".

## The one definition (core owns it)

**A month's net** = income minus spending, over the whole calendar month,
with the same flows as every other total (`totals()` in
`src/core/ledger/period.ts`): refunds lower spending, card bills count
once, excluded, internal, trashed and gone rows count nowhere, pending
rows count.

**Money moved to savings is not part of the net** (owner, 2026-11-18). A
month with income 10,000, spending 8,000 and 3,000 moved to savings has
net +2,000, green. The savings move is reported next to the net so the
tooltip can show it. This is on purpose different from Home's "Left this
month" card, which subtracts savings moves.

Integer agorot, computed in core. The renderer only draws what core
returns. The chart ignores Home's All / Routine / Treats filter: the net
is about all money.

## Owns

- `src/core/ledger/period.ts` (or a new `src/core/ledger/net.ts` with
  `net.test.ts` if that keeps `period.ts` readable), `period.test.ts`,
  `src/core/ledger/index.ts` (export line)
- `src/main/handlers.ts`: only the new channel
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- New `src/renderer/src/components/home/net-card.tsx`
- `src/renderer/src/components/home/period-data.ts`,
  `src/renderer/src/pages/home-page.tsx` (place the card)
- `src/renderer/src/lib/api.ts`, `hooks.ts`, `query-keys.ts`: additive only
  (the new query must refresh with the others in `refreshLedger`)
- `src/renderer/src/strings.ts`: append at the end in a `// spec 30` block

Do not touch the other Home cards, budgets, categories, profiles, sync or
packaging.

Read first: `AGENTS.md`, `docs/ARCHITECTURE.md`, `totals`, `periodTrend`
and `thisMonth` in `src/core/ledger/period.ts`, `average.ts`,
`trend-card.tsx` (how the month bars are drawn and clicked).

## Build

1. **Core.** A new channel `summary:monthlyNet`, args `DateRange`, result
   one point per month: `{ month, income, spending, transfers, net,
   partial }`. Same months as the month-by-month bars (`periodTrend`'s
   window: at least 12, ending at the period's last month, never past the
   current month). `partial` is true for the current month. Months before
   the profile's first transaction (`firstMonth` in `average.ts`) are left
   out of the result, not returned as zero.
2. **The card**, "Saved or overspent", full width, placed right after the
   Month by month card. Recharts bar chart, one bar per month from a zero
   line: up and `--status-on-track` (green) when net is above zero, down
   and `--status-over` (red) when below. Net exactly zero: no bar, the
   month label stays. Y axis in shekels, whole numbers, symmetric enough
   that a small red month is still visible next to a big green one (the
   domain includes zero and both extremes). The current month is drawn
   lighter (lower opacity) and its tooltip says "so far".
3. **Labels.** Each bar shows its net above (green) or below (red) the
   bar, signed and in whole shekels: "+₪1,000", "-₪500". If labels
   collide at 12+ months on a narrow window, show them only in the
   tooltip; decide from the screenshots.
4. **Tooltip** (the shared `ChartTooltip`): the month, Income, Spending,
   the net in its color, and, only when not zero, "₪X moved to savings
   (not counted)" (negative: "₪X taken from savings").
5. **Click** a bar or month label: open that month's Transactions (all rows),
   setting the month like the month-by-month card does (owner, 2026-11-18).
6. **Empty and short history.** No months with data: a quiet one-line
   empty state, no chart. Pending rows count as everywhere else.

## Tests (definition of done)

- Core: net = income - spending; refunds and card bills as on the bars;
  savings moves change `transfers` but not `net`; excluded and trashed
  rows ignored; the current month is `partial`; months before the first
  transaction are left out; a period longer than 12 months returns all its
  months; a future period stops at the current month.
- Handler: bad ranges are rejected like the other summary channels.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  the card with green and red months (exclude some income in the Demo
  database through a `?shot=net-mixed` hook like `useOverspentShot` if the
  Demo data has no red month), and the tooltip of a month with a savings
  move.

## Report

What you built, the channel's shape, commits, anything outside Owns,
screenshot paths, doubts.
