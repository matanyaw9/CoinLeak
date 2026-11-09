# 20 Transactions by hand: select all, notes, cash wallet (wave 8)

## Goal

Work on many rows at once, write notes, and record money that never
touches a bank. Owner features F46, F48, F8 (`docs/FEATURES.md`).

## Owns

- `src/core/db/migrations/0010_*.sql` (the only migration this wave) and
  `src/core/db/migrations.ts` if new files must be listed there
- `src/core/ledger/**` except `period.ts`, `curves.ts`, `money-flow.ts` and the `queries.ts` summary functions (spec 22 adds
  one there; you may add transaction functions to `queries.ts`, at the end
  of the transaction section, nothing else)
- `src/core/demo/**`: seed a Cash wallet with a few rows
- `src/main/handlers.ts`: only your new channels
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/renderer/src/pages/transactions-page.tsx`,
  `components/transactions/**`, `lib/day-groups.ts`, `lib/api.ts`
  (your channels), `pages/accounts-page.tsx` and `components/accounts/**`
  (only to show the Cash wallet)
- `src/renderer/src/strings.ts`: append at the end in a `// spec 20` block

Do not touch Home, Categories, Rules pages, `app-shell.tsx`, or
`core/rules/**` (specs 21 and 22).

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 3, 4, 5 and 7,
`docs/specs/11-transactions-workbench.md`, `src/core/ledger/card-bills.ts`,
`src/core/ledger/flow.ts`.

## Build

1. **Select all (F46).** A checkbox above the list selects every row the
   list shows now (current period, search, filters; hidden card bills stay
   unselected). Checked, unchecked, or mixed (some selected). Each day
   header gets the same checkbox for that day's rows. Works in the flat
   (non-date sort) list for the top box. Existing shift-click and the bulk
   bar keep working.
2. **Notes (F48).** On a row: "Add note" in the right-click menu and a
   small note control on the row; the note shows under the description,
   muted, `dir="auto"`. Edit and clear it. Saves through the existing
   `transactions:update` with `patch.note` (trim; empty means null; max
   500 characters, refused with `BAD_REQUEST` in core). Search already
   looks in notes. A sync never changes a note (prove with a test).
3. **Cash wallet (F8).** One money account of a new kind `cash` per
   profile, made on first use (migration 0010 rebuilds `accounts` so the
   kind CHECK allows `cash`; keep every row and id). It never syncs, never
   shows in the Sync panel, has no provider login.
   - **Add a transaction**: a button on Transactions opens a form: date
     (default today), amount, money out or money in, description, category
     (optional), note (optional). Saved with `source = 'manual'` on the row
     (new column, default `'sync'`). Money in with no category is income,
     like any row (for example cash from parents).
   - **Edit and delete**: manual rows can be edited (all fields) and moved
     to Trash like any row. Synced rows stay read-only as today.
   - **Ingest never touches manual rows**: no dedup against them, no gone,
     no settle, no card-bill matching on the cash side. Test it.
   - **ATM withdrawals are a move into the wallet** (owner decision,
     2026-11-09). A bank row that looks like a cash withdrawal becomes
     `internal` (counts once, like a card bill) only when the profile has
     a Cash wallet. Patterns live in one list next to `card-patterns.ts`
     (Hebrew and English, for example `משיכת מזומן`, `כספומט`, `ATM`); say
     in your report which you used and why. The user overrides with the
     existing "This is spending" / card-bill controls (`setInternal`), and
     the row shows "Moved to cash wallet". Rows the user already decided
     (`internal_by_user`) are never changed.
   - The Cash wallet shows on the Accounts page as "Cash wallet" with its
     row count, no Sync button, no card mode.
4. **Demo profile**: a Cash wallet with an ATM withdrawal and 4 to 6 cash
   rows (a cafe, a market, cash from family as income).

## Tests (definition of done)

- Migration 0010 on a database with accounts and rows of every kind keeps
  all of them; `kind = 'cash'` allowed.
- Manual add, edit, trash, restore; validation (amount not 0, date valid,
  description 1 to 200 characters, category exists).
- A sync after manual rows: no dedup collision, manual rows untouched.
- ATM row: internal with a wallet, spending without one, user override
  wins; totals count the money once.
- Note: save, clear, too long refused, sync keeps it.
- Select all and per-day selection state (pure helper with tests).
- `npm run check` green. Screenshots light and dark on the Demo profile:
  top and day checkboxes mixed, a row with a note, the add form, the
  Accounts page with the Cash wallet.

## Report

What you built, migration, channel and type changes, ATM patterns, commits,
anything outside Owns, screenshot paths.
