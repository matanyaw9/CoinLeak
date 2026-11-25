# 34 Nested categories, new defaults, and no more Routine / Treats (wave 14)

## Goal

Owner features F69, F70 and F72 (`docs/FEATURES.md`).

1. **Nested categories (F69).** "Categories should be nested, not groups
   and categories." Up to **3 levels** (owner, 2026-11-25), for example
   Groceries & Shop › Groceries › Weekly shop. Every level is a real
   category: it can hold rows, a rule can set it, it can have a budget.
   The same kind (spending, income, transfer) all the way down. A
   category's totals include everything under it.
2. **Better defaults (F70).** Owner: Transport out of the box with Bus,
   Train, Gas, Repairs, Insurance; Groceries split into the big
   supermarket shop, small top-ups ("going downstairs to get some milk or
   yogurt") and small shops ("buying fancy coffee"). The names below are
   the lead's; the owner can rename them in the app.
3. **Remove Routine / Treats (F72).** Owner: "remove it." It goes from
   every screen. The `essential` column stays in the database with its
   data; nothing is deleted.

## Owns

- New `src/core/db/migrations/0015_nested_categories.sql`, its line in
  `migrations.ts`, new `src/core/db/nested-migration.test.ts`; old
  migration tests only where 0015 changes what they compare
- `src/core/ledger/categories.ts`, `flow.ts` (`LEDGER_SQL` only),
  `period.ts`, `money-flow.ts`, `budgets.ts`, `queries.ts` (only
  `listCategories` and the category filter in `listTransactions`; never
  `updateTransactions` or the trash functions), their tests
- `src/core/settings.ts` (only the Routine / Treats setting),
  `src/core/rules/starters.ts` (only if its seeded-category lookup needs
  it), `src/core/demo/seed.ts`
- `src/shared/types.ts`, `ipc.ts`: remove `essential` everywhere; other
  changes additive. `src/main/handlers.ts`: only what those changes need
- Renderer: `lib/categories.ts`, `lib/hooks.ts` (categories and Home
  queries only), `pages/categories-page.tsx`, `pages/home-page.tsx`,
  `components/categories/**` **except** the emoji and color grids in
  `category-editor.tsx` (the `Field` blocks for `s.catEdit.emoji` and
  `s.catEdit.color`: spec 36 replaces those two blocks; do not edit
  inside them), `components/home/**`,
  `components/transactions/category-picker.tsx`, `list-tools.tsx`,
  `list-view.ts` and their tests
- `src/renderer/src/strings.ts`: edit the Routine / Treats strings
  (delete them) and append new ones in a `// spec 34` block at the end

Do not touch the Transactions rows, row menu, Trash, selection,
`transactions-page.tsx`, shortcuts (spec 36), rules core or the rule
editor (spec 35), or any window security file. Ask in your report for
any change outside Owns.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 4 and 7,
`docs/ARCHITECTURE.md`, migrations `0002` (the two-level triggers) and
`0013` (how defaults change only what still looks default),
`categories.ts`, `flow.ts`, `period.ts`, `lib/categories.ts`,
`category-picker.tsx`, `categories-page.tsx`, `money-flow-card.tsx`.

## Build, in this order

Commit each phase with `npm run check` green. Each phase leaves the app
whole, so the lead can merge after phase 3 if time runs out.

### Phase 1: three levels in core

- **Migration 0015** replaces the two-level triggers. The database
  refuses: a parent of another kind; a parent at level 3; a move that
  would put any descendant below level 3; a category under itself or its
  own descendant. Core checks first and answers with a fixed
  `CategoryProblem` (add codes such as `too_deep`; keep the existing ones).
- **`LEDGER_SQL`** gives each row its ancestors (for example
  `category_grandparent_id` next to `category_parent_id`, and
  `category_root_id`). Every place that rolls up or filters by parent
  uses them: the category filter (a category matches its children and
  grandchildren), `period.ts` roll-ups to the top level, `money-flow.ts`,
  budgets (a budget counts everything under its category).
- **One level at a time:** a core function (or an argument on an
  existing one) returns the totals of a category's direct children, each
  including its own descendants, plus the category's own rows as one more
  line. Charts drill with it; the renderer never adds up children itself.
- `listCategories`: parents before children, depth first, as today.
- Rows on a category that has children stay valid (every level is real).

### Phase 2: three levels on screen

- **Categories page and editor:** the tree shows 3 levels, indented. "Add
  a category" works under a level 1 or level 2 category. The editor's
  parent chooser offers every same-kind category at level 1 or 2 except
  itself and its descendants, and only where the moved branch still fits
  in 3 levels. Move and delete dialogs work at every level (delete is
  still refused while a category has children).
- **Category picker:** every level is pickable, shown as a 3-level tree;
  search shows full paths ("Groceries & Shop › Groceries › Weekly shop").
  Arrow keys move in the list, Enter picks, Esc closes (`AGENTS.md`
  keyboard rule).
- **Transactions filter** (`list-tools.tsx`, `list-view.ts`): 3 levels;
  picking a category means it and everything under it.
- **Home:** charts show top-level categories with correct totals. Where a
  chart drills down today (money flow), it drills one level at a time to
  level 3; a category's own rows show as a slice named "Other in
  <name>". Home's category pickers list all 3 levels. Clicking through
  to Transactions filters to the category and everything under it.

### Phase 3: new defaults (F70)

In migration 0015, after the trigger change, for new and existing
profiles, touching only categories that still have their default name
and parent (the 0013 rules; skip a name that already exists there):

- Groceries & Shop › Groceries gets **Weekly shop**, **Top-up**,
  **Specialty food** (level 3).
- Transportation › Transport gets **Bus**, **Train** (level 3).
- Transportation gets **Taxi & rides**, **Tolls**, **Car repairs**,
  **Car insurance**, **Car license & test** (level 2). Fuel and Parking
  already exist.

Pick distinct emoji and colors near the parent's. No row changes category.
The Demo profile shows a few rows on level 3 categories.

### Phase 4: remove Routine / Treats (F72)

Remove every Routine / Treats control, label, filter, split view and
setting: Home's filter and its "split" trend view, the editor field, the
Categories page tag, core and IPC arguments that only served them, the
`essential` field in shared types. Home then shows all spending, as it
does under "All" today. The column and its values stay; new categories
get NULL. Delete strings and code left unused.

## Tests (definition of done)

- Migration: existing two-level data unchanged; 3 levels accepted; level
  4, other kind, a cycle and a too-deep move refused by the database;
  defaults added only where the parent still looks default, and not twice.
- Core: a level 3 row counts in its parent's and root's totals, filters
  and budgets; the children-totals function includes grandchildren and
  the category's own rows; every refusal has its code.
- Renderer: `lib/categories.ts` descendants, full paths, depth; the
  picker's tree order; the parent chooser's allowed list.
- No `essential`, "Routine" or "Treats" left in renderer code or strings.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  the Categories page with 3 levels, the editor's parent chooser, the
  category picker searching, Home's money flow drilled to level 3, Home
  with no Routine / Treats control.

## Report

Write it to `.claude/shots/REPORT.md` (the lead reads that file): what
you built, which phases are done, commits, anything outside Owns,
screenshot paths, doubts. Under 40 lines.
