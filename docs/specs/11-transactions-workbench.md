# 11 Transactions workbench: trash, right click, rules from rows (wave 4)

## Goal

Make sorting transactions fast and forgiving. Owner features F2, F6, F7,
F20 (`docs/FEATURES.md`) and the spec 09 leftovers (`docs/BACKLOG.md`,
"Spec 09 leftovers").

## Owns

- `src/core/db/migrations/0005_trash.sql` (new)
- `src/core/ledger/flow.ts`, `src/core/ledger/queries.ts` and their tests
- `src/core/ledger/card-bills.ts`, `pending.ts`, `src/core/rules/engine.ts`:
  only to skip or keep trashed rows as below, with tests
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/main/handlers.ts`: the new channels only
- `src/renderer/src/pages/transactions-page.tsx`,
  `src/renderer/src/components/transactions/**`, new files under
  `src/renderer/src/components/trash/` or a new `pages/trash-page.tsx`
- `src/renderer/src/components/layout/app-sidebar.tsx` and `App.tsx`: the
  Trash entry and route only
- `src/renderer/src/lib/demo.ts`, `lib/review*.ts`, `lib/rule-actions.ts`:
  what the above needs
- `src/renderer/src/strings.ts`: append at the end in a block headed
  `// spec 11`

Do not touch `accounts-page.tsx`, `components/sync/**`, `welcome.tsx`,
`home-page.tsx`, `components/home/**`, `month-picker.tsx`.

Read first: `AGENTS.md`, `REQUIREMENTS.md` section 4 (money model),
`src/core/ledger/flow.ts`, `docs/specs/09-rules-screen.md`.

## Build

1. **Trash in core.** Migration adds `trashed_at TEXT` (ISO UTC) to
   `transactions`. A new flow `trashed` comes first in `flowOf` and
   `FLOW_SQL` (before `gone`): it counts nowhere and has no review flags.
   Trashed is a **user field**: sync, settle-with-drift, rules and card-bill
   matching never set or clear it, and a settled pending row keeps it.
   The row stays in the database, so a later sync sees it as known and
   never adds it again. Card-bill matching ignores trashed rows on both
   sides. Channels: `transactions:trash { ids }`, `transactions:restore
   { ids }`, `transactions:emptyTrash` (real delete of trashed rows only,
   asks the user first in the UI). `transactions:list` hides trashed rows
   unless the filter asks for flow `trashed`.
2. **Trash page** (sidebar, at the bottom above Settings): trashed rows
   newest first, with Restore (one or many) and "Empty trash". Empty
   state in one friendly line.
3. **Right click a row** (and the same menu from a small "..." button for
   people who do not right click): "Make a rule for <business>" (calls
   `rules:suggest` for that row and opens the rule editor), "Ignore" /
   "Count again" (the existing exclude), "Move to trash". Works on the
   whole selection when the clicked row is selected. Every action gets a
   toast with Undo.
4. **Ignored rows look off**: excluded rows render greyed (lower contrast,
   amount struck through or muted), still readable and still clickable.
5. **Card bills hidden by default (F20)**: rows with flow `internal` are
   not shown in the list unless a "Show card bills" toggle is on. The
   toggle shows the count it hides ("Show 4 card bills"). Nothing is
   trashed automatically.
6. **Bigger checkboxes (F2)**: a larger hit area and box (at least 20px
   box, whole left gutter clickable), shift-click selects a range, the
   bulk bar says how many are selected.
7. **Spec 09 leftovers**: "Make a rule" in the bulk bar, the "Always put X
   in Y?" toast after a hand categorization (once per merchant per
   session, not for rows a rule sorted), and the rule chip on rows. The
   how-to notes are in `docs/BACKLOG.md`.

## Tests (definition of done)

- Flow: trashed beats every other flow, in TS and SQL (the existing
  agreement test covers it).
- A trashed row is not re-added by a sync of the same download, stays
  trashed after settle-with-drift, is untouched by rules, and is ignored by
  card-bill matching.
- Summaries exclude trashed rows; restore brings them back exactly.
- `emptyTrash` deletes only trashed rows.
- `transactions:list` hides trashed and (when asked) internal rows.
- `npm run check` green. Screenshots, light and dark: the right-click
  menu, a greyed ignored row, the Trash page, the "Show card bills"
  toggle, the bulk bar with bigger checkboxes, the "Always put" toast.

## Report

What you built, the new channels, anything outside "Owns" you needed, and
the screenshot paths.
