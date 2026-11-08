# 17 Transactions tools: sort, filter, find, explain (wave 6)

## Goal

Find any transaction fast and see why it is where it is. Owner features
F22, F23, F32, F33, F34, F35 (`docs/FEATURES.md`).

## Owns

- `src/core/ledger/queries.ts`: only `listTransactions` (and its helpers)
  with tests
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only (for example
  `TransactionFilter.sort`)
- `src/renderer/src/pages/transactions-page.tsx`,
  `components/transactions/**`, `lib/day-groups.ts`, `lib/review*.ts`
- `src/renderer/src/components/layout/app-shell.tsx`: only a Ctrl+F
  handler
- `src/renderer/src/lib/demo.ts`: `transactions:list` only
- `src/renderer/src/strings.ts`: append at the end in a `// spec 17` block

Do not touch `home-page.tsx`, `components/home/**`, `month-picker.tsx`,
`month-context.tsx` (spec 16), categories, rules or sync files (spec 18).
Keep using `useMonth()` for the shown month; spec 16 adds a period and the
lead switches this page to it at merge. No migration.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 3, 4 and 7,
`docs/specs/11-transactions-workbench.md`.

## Build

1. **Sort (F23).** Date (default, newest first, grouped by day), amount
   (largest first, or smallest first), name A to Z (Hebrew and English,
   natural order). Core sorts; the window renders. Any sort but date shows
   a flat list with the date on each row.
2. **Filters (F23).** Category (several, including Uncategorized), money
   account, flow (spending, income, savings, ignored, card bills), pending,
   needs review. Active filters show as chips with an X each and "Clear
   all". The existing search and card-bill toggle keep working with them.
3. **Click a category (F34).** Clicking the category chip on a row filters
   to that category. The edit control next to it still opens the picker.
4. **Which rule (F32).** Hovering a category set by a rule shows "Set by
   rule: <name>" with an "Edit rule" link; set by hand shows "Set by you".
   Use the rules list the page already has, or add the rule name to rows
   in core; do not compute rule matches in the window.
5. **Ctrl+F (F33).** Ctrl+F (Cmd+F on Mac) focuses and selects the search
   box on Transactions. On any other page it opens Transactions with the
   search box focused.
6. **Close the offer (F35).** The "Always put X in Y?" toast gets an X
   button; it still goes away by itself.
7. **Summary bar (F22).** Income, Spent and Left for the shown month at
   the top, from core (`summary:month`), matching Home.
8. **Demo** sorts and filters like core.

## Tests (definition of done)

- Core: each sort order, stable ties (then by id), Hebrew and English
  names; every filter alone and combined with search.
- Click category sets exactly that filter; clearing restores the list.
- Rule hover text for rule, user and uncategorized rows.
- Ctrl+F focuses search on Transactions and navigates from Home.
- `npm run check` green. Screenshots light and dark: sorted by amount,
  filters with chips, the rule hover, the toast with its X.

## Report

What you built, channel or type changes, commits, anything outside Owns,
screenshot paths.
