# 36 Arrow keys in lists, Delete and Ignore keys, and Trash selection (wave 14)

## Goal

Owner features F83 to F86 (`docs/FEATURES.md`), and two fixes from the
wave 13 review (`docs/reviews/2026-11-25-wave13-review.md`, should fix 1
and 2).

1. **F83.** "In the emoji picker, maybe in other places too, I should be
   able to move with the arrows and not with many presses of tab. When
   there is a list of things, tab should hop between lists and arrows
   should help navigate within the list."
2. **F84.** The Delete key moves the selected transactions to Trash. Trash
   is reversible, so no confirm: a toast with Undo.
3. **F85.** "I should toggle on and off ignore": one key, `I`.
4. **F86.** Trash: select rows like on Transactions and delete them for
   good, with a confirm.

## Owns

- New `src/renderer/src/lib/roving.ts` and `roving.test.ts` (the shared
  helper), `lib/shortcuts.ts`, `shortcuts.test.ts`, `use-shortcuts.ts`,
  `components/common/keyboard-help.tsx`
- `components/transactions/`: `transaction-row.tsx`, `row-menu.tsx`,
  `row-menu-entries.ts` (+ test), `paid-back-dialog.tsx`,
  `category-cell.tsx`, `selection.ts` (+ test), `use-selection.ts`,
  `bulk-bar.tsx`; `pages/transactions-page.tsx`
- `pages/trash-page.tsx`, `components/trash/**`
- `lib/review-actions.ts`, `lib/hooks.ts`, `lib/api.ts`: additive only
- New `components/categories/emoji-grid.tsx` and `color-grid.tsx`; in
  `category-editor.tsx` only the two `Field` blocks for `s.catEdit.emoji`
  and `s.catEdit.color`, which you replace with those components (spec 34
  owns the rest of that file and edits it at the same time)
- `src/core/ledger/queries.ts`: only `emptyTrash` and a new function next
  to it, and their tests. `src/shared/types.ts`, `ipc.ts`: additive only.
  `src/main/handlers.ts`: only the new channel
- `src/renderer/src/strings.ts`: append at the end in a `// spec 36` block

Do not touch categories core, the category picker, `list-tools.tsx`,
`list-view.ts`, Home (spec 34), the rule editor (spec 35), or any window
security file.

Read first: `AGENTS.md`, `docs/specs/31-*.md` (the shortcut table, dialog
keys, selection), `lib/shortcuts.ts`, `use-shortcuts.ts`,
`transaction-row.tsx`, `row-menu.tsx`, `paid-back-dialog.tsx`,
`trash-page.tsx`, `review-actions.ts`, the review above.

## Build

### 1. One roving helper (F83)

`roving.ts`: a small hook for "one list, one Tab stop". The list has a
single element in the Tab order (the last focused item, else the first).
Up and Down move (Left and Right too in a grid with a column count),
Home and End jump, Tab leaves the list. The key logic is a plain function
tested without React. Use it for:

- **Emoji and color grids** in the category editor (grid, arrows in all
  four directions; Enter or Space picks).
- **Transactions rows:** Up and Down move focus between rows (a visible
  focus ring), Space toggles the focused row's selection, Shift+Up and
  Shift+Down extend the selection, the context menu key or Shift+F10 opens
  the row menu.
- **Trash rows**, the same way.
- **Paid back list:** keep its arrow keys, through the helper if it fits.

Menus (base-ui) already move with arrows: check, do not rebuild.

### 2. Delete and `I` on Transactions (F84, F85)

- `Delete` (and `Backspace` on a Mac) moves the selected rows to Trash,
  or the focused row when none is selected. Toast with Undo, through
  `useRowActions().trash`.
- `I` toggles Ignore on the selection (or the focused row): when all are
  ignored, it counts them again; otherwise it ignores them all. Through
  `useRowActions().setIgnored`, with Undo.
- Both follow spec 31's rules: never while typing, with a dialog or menu
  open, or on a key repeat. Both are in the shortcut table, so the `?`
  list and the bulk bar's tooltips show them (for example "Move to Trash
  (Delete)").

### 3. Trash selection (F86)

- Trash gets what Transactions has: a box per row, the box above the list
  (select all shown), Shift+click and Ctrl+click on a row, Ctrl+A, Esc
  clears. Reuse `selection.ts` and `use-selection.ts`; no second copy of
  the selection rules (today `trash-page.tsx` has its own: replace it).
- "Delete for good" for the selection, next to "Restore selected". It asks
  first in a destructive dialog (plain Enter does nothing, Ctrl+Enter or
  the button confirms, spec 31). "Empty trash" stays.
- **Core:** a function next to `emptyTrash` that deletes only the given
  trashed ids, with the same tombstones and card-bill cleanup (share the
  code with `emptyTrash`; do not copy it). Ids that are not in Trash are
  ignored. A new channel, for example `transactions:deleteForGood`.

### 4. The Paid back dialog (review fixes)

- Open it from the page like the note dialog: an `openPaidBack(row)` in
  `RowMenuActions`, one `PaidBackDialog` / `NotPaidBackDialog` rendered by
  `transactions-page.tsx`. Remove `EntryDialog`, the `RowDialog` context,
  `useRowDialog` and the unused slot in `RowMenuButton`; `MenuEntry` goes
  back to a required `onSelect`. Keep the `?shot=paid-back` screenshots
  working, moved out of `category-cell.tsx` if you can.
- Enter picks only when the list matches what is typed: ignore Enter
  while the search is still catching up (debounce or loading).

### 5. The list of keys

Add Delete, `I`, Space, Shift+arrows, arrows in lists and the Trash keys
to the shortcut table, so `?` lists them, grouped as today.

## Tests (definition of done)

- `roving.test.ts`: next index for each key in a list and in a grid,
  edges (first, last, wrap or stop: pick one and test it), Home and End,
  an empty list.
- `shortcuts.test.ts`: Delete, Backspace on a Mac only, `I`; ignored while
  typing, with an overlay, on repeat; no letter used twice.
- `selection.test.ts`: Shift+arrow extends from the anchor; Trash uses the
  same functions.
- Core: delete for good removes only the given trashed rows, leaves
  tombstones (a later sync does not bring them back), ignores rows not in
  Trash, rematches card bills.
- Row menu entries: Paid back opens through the page action.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  Transactions with a focused row and a selection, the `?` list with the
  new keys, Trash with rows selected and the Delete for good dialog, the
  emoji grid with a focused emoji.

## Report

Write it to `.claude/shots/REPORT.md` (the lead reads that file): what
you built, the final key list, commits, anything outside Owns, screenshot
paths, doubts. Under 40 lines.
