# 27 Budgets: monthly and weekly (wave 10)

## Goal

Let the owner set a monthly budget per spending category and see, at a
glance, how much of it is spent this month and this week. Owner feature
F59 (`docs/FEATURES.md`).

Owner decisions (2026-11-10 and 2026-11-14):

- A monthly amount per spending category, set on the Categories page.
- The weekly budget is the monthly budget divided by 4 (exactly; round
  down to whole agorot). There is no separate weekly amount.
- Weeks run Sunday to Saturday (Israel). Months are calendar months, as
  everywhere else in the app.
- A Home card shows one horizontal bar per budgeted category: spent as a
  percent of its budget.

## Owns

- `src/core/db/migrations/0012_*.sql` (spec 28 owns 0013; do not take it),
  `src/core/db/migrations.ts` if new files must be listed
- a new `src/core/ledger/budgets.ts` with `budgets.test.ts`,
  `src/core/ledger/index.ts` (export line)
- `src/core/ledger/categories.ts`: only what saving a budget needs
- `src/core/demo/**`: budgets on a few Demo categories, one over budget,
  one near it, one well under
- `src/main/handlers.ts`: only your channels
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/renderer/src/pages/categories-page.tsx`,
  `src/renderer/src/components/categories/**`
- `src/renderer/src/pages/home-page.tsx` (place the card only), a new
  `src/renderer/src/components/home/budget-card.tsx`
- `src/renderer/src/lib/query-keys.ts`, `lib/api.ts`, `lib/hooks.ts`:
  additive only
- `src/renderer/src/strings.ts`: append at the end in a `// spec 27` block

Do not touch the default categories, the essentials/extras words, card
bills, profiles or packaging (specs 28 and 29). Do not change how "Left"
on Home is computed in this spec.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 4 and 5,
`docs/ARCHITECTURE.md`, `src/core/ledger/period.ts` (how spending for a
period is counted: refunds, card bills once, excluded and internal rows),
`src/core/ledger/dates.ts` (Israel dates).

## Build

1. **Store it.** Migration 0012 adds `categories.monthly_budget INTEGER`
   (agorot, NULL = no budget, CHECK > 0). Only spending (`expense`)
   categories may have one, groups and subcategories alike.
2. **Core query.** `budgetStatus(db, { month, today })` returns, per
   budgeted category: id, monthly budget, spent this month, weekly budget
   (`Math.floor(monthly / 4)`), spent this week (the Sunday to Saturday
   week containing `today`, or the last week of `month` when `month` is
   not the current month; a week crossing a month edge counts its days in
   both months, but only rows inside the chosen month count toward the
   monthly figure). A group's spent includes its subcategories. Spending
   uses exactly the same rules as Home's category totals (reuse that code,
   do not copy it): refunds lower spending, card bills count once,
   excluded, internal, trashed and gone rows do not count.
3. **Set it on Categories.** Each spending category row gets a small
   "Budget" field: monthly amount in shekels, cleared to remove. Shows
   "≈ ₪X a week" under it. Saving validates (positive, under a sane max
   shared with other money inputs) and refreshes Home.
4. **Home card "Budgets".** Toggle "This month" / "This week". One
   horizontal bar per budgeted category, sorted by percent spent, highest
   first. Each bar: emoji and name, "₪spent of ₪budget", percent. Colors:
   under 80% calm, 80 to 100% warning, over 100% red with the overspend
   ("₪240 over"). Clicking a bar opens Transactions filtered to that
   category and period. No budgets yet: one quiet line, "Set a monthly
   budget on any category" linking to Categories. The card follows the
   period Home shows (the chosen month); "This week" only appears when
   the chosen month is the current month.
5. Money is integer agorot end to end. The renderer never computes
   percents from raw rows: core returns spent and budget, the renderer
   divides for display only.

## Tests (definition of done)

- Migration 0012 on a database with categories and rows keeps everything.
- Budget on a subcategory, on a group (includes children), none.
- Weekly budget is monthly / 4 rounded down (for example 1001 agorot
  gives 250).
- Week edges: Sunday start, a week crossing the month edge, a past month.
- Spent matches Home's category total for the same month on the Demo
  profile (refund, card bill, excluded and trashed rows).
- Saving rejects zero, negative, non-integer and income categories.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  Home with the Budgets card (month and week), Categories with a budget
  field filled in.

## Report

What you built, the week rule, migration, channel and type changes,
commits, anything outside Owns, screenshot paths, doubts.
