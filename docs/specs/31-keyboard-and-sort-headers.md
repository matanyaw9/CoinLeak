# 31 Keyboard everywhere, and sorting from the column headers (wave 13)

## Goal

Owner features F66 and F80 (`docs/FEATURES.md`). The common moves work
from the keyboard, the shortcuts are visible, and the Transactions list
sorts by clicking the header above each column instead of a sort menu.

## Owns

- New `src/renderer/src/lib/shortcuts.ts` and `shortcuts.test.ts` (the key
  logic as plain functions), new `src/renderer/src/lib/use-shortcuts.ts`
  (one hook that listens on `window`)
- New `src/renderer/src/components/common/keyboard-help.tsx` (the `?`
  list), `src/renderer/src/components/common/key-hint.tsx` (the small key
  badge)
- `src/renderer/src/components/layout/app-shell.tsx`, `app-sidebar.tsx`
- `src/renderer/src/components/ui/dialog.tsx`, `tooltip.tsx` (only to show
  a shortcut in a tooltip)
- `src/renderer/src/components/transactions/selection.ts`,
  `selection.test.ts`, `use-selection.ts`, `transaction-row.tsx` (click
  modifiers only), `list-tools.tsx` (remove `SortMenu`), `list-view.ts`,
  `list-view.test.ts`, new `list-header.tsx`
- `src/renderer/src/pages/transactions-page.tsx`
- `src/core/ledger/queries.ts`: only the sort clause, and its tests
- `src/shared/types.ts`: additive only (`TransactionSort` values)
- `src/main/handlers.ts`: only if it lists the allowed sort values
- `src/renderer/src/strings.ts`: append at the end in a `// spec 31` block

Do not touch the row menu (`row-menu.tsx`, `row-menu-entries.ts`),
`category-cell.tsx`, categories, accounts, sync, card bills or Home
(specs 32 and 33 own those). Do not change any window security file.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 6 and 7,
`docs/ARCHITECTURE.md`, `selection.ts`, `use-selection.ts`,
`transaction-row.tsx`, `find.ts` (how Ctrl+F is detected today),
`components/ui/dialog.tsx`, `app-sidebar.tsx`, `list-view.ts`.

## Build

### 1. One shortcut hook

`use-shortcuts.ts` listens on `window` `keydown` once and calls the action
for a key. The decision "does this key event mean shortcut X here?" is a
plain function in `shortcuts.ts`, tested without React.

A single-letter key (no Ctrl, Alt or Meta) never fires when:

- focus is in an `input`, `textarea`, `select` or `contenteditable`,
- a dialog, menu or popover is open,
- the key repeats (`e.repeat`).

### 2. The keys

| Key | Where | Does |
|-----|-------|------|
| `H` | anywhere | Home |
| `T` | anywhere | Transactions |
| one letter per other sidebar page | anywhere | that page (pick letters that are not taken; Settings may use `,`) |
| `?` | anywhere | opens the Keyboard shortcuts list |
| `Ctrl+A` | Transactions | selects every row in the current view (the same rows as the top check box) |
| `Esc` | Transactions, rows selected, no dialog open | clears the selection |
| `Ctrl+F` | as today | unchanged |
| `Enter` | confirm dialog | the OK (primary) button, when it is enabled |
| `Ctrl+Enter` | dialog with a text box | submits; plain `Enter` in a multi-line box is a new line |
| `Esc` | any dialog | Cancel (check what base-ui already does; do not double-handle) |

On macOS `Ctrl` means `Cmd`, as `find.ts` does today. A dialog whose OK
is disabled (for example a typed "delete" confirmation not yet typed)
ignores `Enter`.

### 3. Mouse with modifiers on Transactions

- `Shift+click` on a row (its box or the row itself, not on a button,
  link, category chip or note) selects every row from the last clicked
  one, as the box does today.
- `Ctrl+click` (`Cmd` on macOS) on a row adds it to the selection, or
  removes it when it is already selected. The anchor moves to it.
- A plain click on the row keeps doing what it does today.

### 4. Visible hints

- Each sidebar item shows its key as a small badge (`key-hint.tsx`),
  quiet (muted color, small), beside the label.
- Buttons and items that have a shortcut show it in their tooltip, for
  example "Select all (Ctrl+A)".
- `?` opens "Keyboard shortcuts": a dialog listing every key above,
  grouped by page. The list comes from the same table the hook uses, so
  it never drifts.
- Settings, or the sidebar foot, has a small "Keyboard shortcuts (?)"
  link that opens the same list.

No underlined letters (they clash with Hebrew text later).

### 5. Sort from the column headers (F80)

- A header row sits above the Transactions list, aligned with the row
  columns: **Date**, **Description**, **Category**, **Amount**. It stays
  visible while the list scrolls (sticky), like the top check box.
- Clicking Date, Description or Amount sorts by it. The active column
  shows an arrow. Clicking the active column again flips the direction.
  Category is a label, not sortable.
- Directions: Date newest first, then oldest first. Amount largest
  first, then smallest first (`amount_desc`, `amount_asc` as today).
  Description A to Z, then Z to A.
- Add `date_asc` and `name_desc` to `TransactionSort` (additive) and to
  the core sort clause; core does the sorting, as today. The sort stays in
  the URL (`list-view.ts`), so Back and Home links keep working.
- Remove the sort menu from the toolbar. The headers are buttons, reachable
  with Tab and pressed with Enter or Space (keyboard rule).
- Day grouping: whatever the list does today for each sort stays the same.

## Tests (definition of done)

- `shortcuts.test.ts`: each key in the table resolves to its action;
  letters are ignored inside inputs, with modifiers, on repeat, and while
  a dialog is open; `Ctrl` vs `Cmd` by platform; no letter is used twice.
- `selection.test.ts`: Ctrl-toggle adds and removes one row and moves the
  anchor; shift range after a Ctrl-toggle; select all equals the top box.
- `list-view.test.ts`: header clicks give the right sort and flip; the sort
  survives the URL round trip.
- Core: `date_asc` and `name_desc` order rows correctly (ties stable).
- `npm run check` green. Screenshots light and dark on the Demo profile:
  the sidebar with key badges, the shortcuts list, Transactions with the
  header row sorted by Amount, and rows selected with Ctrl+A.

## Report

What you built, the final key list, commits, anything outside Owns,
screenshot paths, doubts. Keep it under 40 lines.
