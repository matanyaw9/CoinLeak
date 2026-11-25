# 37 Budgets page (wave 15)

## Goal

Owner feature F73 (`docs/FEATURES.md`), building on F59 (spec 27). The
owner liked Sure's budget screen. Owner, 2026-11-25: "the total sum of
nested categories cannot exceed their mother category. The total budget
should be visible when setting a budget, alongside the average income in
the past X time (let's say, 3 months)."

A **Budgets** page of its own in the sidebar, where you plan the month:

1. Set the month's **total** first, next to your **average income over the
   last 3 full months** (and your average spending, for scale).
2. Split it across spending categories at any of the three levels
   (spec 34). A bar says how much of the total is split so far: "82% set,
   ₪1,200 left to split".
3. **Children never add up to more than their parent**, and the top level
   never adds up to more than the total. Raising a category past its
   parent's room offers to raise the parent too.
4. Each category shows its **usual month** (its average spending over the
   same 3 full months) and what it has spent in the chosen month, next to
   its budget box.

Budgets stay one standing monthly amount per category, as in spec 27 (no
per-month budgets, so no "copy last month"). The weekly figure stays the
monthly one divided by 4.

## Owns

- `src/core/ledger/budgets.ts`, `budgets.test.ts`
- `src/core/settings.ts`: only a new `budgetTotal` key (agorot or null),
  and its test
- `src/core/demo/seed.ts`: only budgets (a total and a few nested budgets)
- `src/shared/types.ts`, `ipc.ts`, `errors.ts`: additive only
- `src/main/handlers.ts`: only your channels
- Renderer: new `pages/budgets-page.tsx`, new `components/budgets/**`,
  `App.tsx` (the route only), `components/layout/app-sidebar.tsx` (the
  entry only), `lib/shortcuts.ts` (one entry: `u` opens Budgets),
  `lib/api.ts`, `lib/hooks.ts`, `lib/query-keys.ts` (additive),
  `components/home/budget-card.tsx`,
  `components/categories/budget-field.tsx`, `category-line.tsx` and
  `pages/categories-page.tsx` (only the budget field)
- `src/renderer/src/strings.ts`: append in a `// spec 37` block at the end

Do not touch the Home charts, `home-page.tsx`, `period.ts`, settings other
than `budgetTotal`, Settings page, profiles or any window security file
(specs 38 and 39 work there now). No new migration is needed: the total is
a setting, budgets stay in `categories.monthly_budget`. Ask in your report
for any change outside Owns.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 4 and 7,
`docs/specs/27-budgets.md`, `docs/specs/34-nested-categories.md`,
`budgets.ts`, `period.ts` (how spending is counted; reuse it, never copy
it), `average.ts` (which months count as full), `lib/roving.ts`.

## Build

### Core

1. **The total.** A `budgetTotal` setting (agorot, positive, at most
   `BUDGET_MAX`, or null for none). It lives in the profile's database
   like every setting.
2. **`budgetPlan(db, { month, today })`** returns everything the page
   shows, so the renderer only lays it out:
   - `total` (or null), `split` (the sum of the **top budgets**: budgets
     with no budgeted category above them), `left` (`total - split`, when
     there is a total).
   - `averageIncome` and `averageSpending`: the monthly average over the
     last 3 full months before the current month, with which months
     (fewer when the history is shorter; null with none). Same counting as
     Home (refunds, card bills once, ignored, transfers and trash).
   - One line per spending category, in tree order: id, depth, `budget`
     (or null), `usual` (the category's average month over those same
     months, everything under it included), `spent` (the chosen month,
     everything under it), `inside` (the sum of the nearest budgeted
     categories under it), and `room` (the most this category's budget
     may be: its nearest budgeted parent's budget minus that parent's
     other budgeted children, or the total minus the other top budgets;
     null when nothing above limits it).
3. **The rules, in `setBudget`.** Setting a budget is refused, with a
   fixed problem (follow the `CategoryProblem` pattern, not a thrown
   error), when:
   - it would make the nearest budgeted parent's children add up to more
     than that parent (`over_parent`, with the parent and its room);
   - it would make the top budgets add up to more than the total
     (`over_total`, with the room);
   - it is lower than what the budgeted categories under it already add
     up to (`under_children`, with that sum).
   Clearing a budget is always allowed. Setting the total below `split`
   is refused the same way (`under_split`). An optional
   `raiseParents: true` raises each budgeted parent (and the total, if
   set) just enough, in the same transaction.
   "Nearest budgeted": a grandchild with a budget under a child without
   one counts toward the grandparent.

### Page

4. **Sidebar entry "Budgets"** below Categories, route `/budgets`, key
   `u` in the Keyboard shortcuts list. The page has the month picker like
   Home (spent figures follow the chosen month; budgets do not change by
   month).
5. **Top card.** The total box (₪, cleared to remove). Beside it: "Average
   income, Aug to Oct: ₪14,200" with a "Use this" button that fills the
   box, and the average spending in smaller text. Under it one bar: the
   part already split, "82% set · ₪1,200 left to split". No total yet: the
   bar shows just the split sum, and a quiet line suggests setting a
   total.
6. **The list.** Every spending category in tree order, children indented
   as on Categories. Each line: emoji and name, "Usually ₪1,850" (muted),
   spent this month, and the budget box with "≈ ₪X a week" under it. A
   budgeted parent with budgeted children shows "₪600 left inside" (or
   "all split"). Saving a box happens on Enter or leaving it, as the
   Categories field does today.
7. **Too much.** When a save is refused for `over_parent` or `over_total`,
   the line shows, inline: "Groceries has ₪300 left. Raise Groceries to
   ₪2,400 too?" with "Raise both" and "Cancel" (keyboard: the offer takes
   focus; Enter raises, Esc cancels). `under_children` and `under_split`
   say what they add up to and keep the old value.
8. **Keyboard.** This is a form: each box is its own Tab stop (like any
   form). Up and Down also move to the box above and below. Enter saves.
9. **Other places.** The budget field leaves the Categories page: each
   spending line there shows its budget as plain text ("Budget ₪1,200"),
   which opens the Budgets page at that line. The Home Budgets card gets a
   link to the page in its header, and its empty state links to the
   Budgets page instead of Categories.

Money is integer agorot end to end; the renderer divides only to show a
percent.

## Tests (definition of done)

- `budgetTotal`: valid, too big, zero, negative, not an integer, cleared.
- `budgetPlan`: `split` counts only top budgets (a parent with a budget and
  a child with a budget counts once; a grandchild under an unbudgeted child
  counts toward the grandparent); `left`; `room` at every level and with no
  limit; `usual` and `averageIncome` over 3 full months, with 1 month of
  history, and with none; `spent` matches Home's category total for the
  same month on the Demo profile.
- `setBudget`: each refusal (`over_parent`, `over_total`,
  `under_children`, `under_split`) with its numbers; clearing always works;
  `raiseParents` raises a parent and a grandparent and the total in one
  transaction, and nothing changes when any step is refused.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  the Budgets page (total set, a parent with children budgeted), the raise
  offer, the Categories page with the plain budget text, Home's Budgets
  card.

## Report

Write it to `.claude/shots/REPORT.md`: what you built, the problems and
their numbers, channel and type changes, commits, anything outside Owns,
screenshot paths, doubts.
