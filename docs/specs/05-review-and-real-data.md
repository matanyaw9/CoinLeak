# 05 Review actions and first run on real data (wave 2)

## Goal

The window from spec 03 runs on demo data. Make it right for a real,
possibly empty database, and give the user the review actions the ledger
now supports: card bills, gone rows, and card mode.

## Owns

- `src/renderer/**`

Read but do not edit: `src/shared/*` (note the new channels
`transactions:setInternal`, `transactions:deleteGone`,
`accounts:setCardMode`, the `gone` status, flow and review flag, and
`MonthSummary.byParent`), `src/main/handlers.ts`, `src/main/sync-service.ts`,
`AGENTS.md`, `REQUIREMENTS.md` sections 4 and 6, `docs/BACKLOG.md`.

## Build

1. **First run.** With no accounts, Home and Transactions show a warm
   welcome: what CoinLeak does, the "you log in on your bank's own page"
   promise, and a button that opens the Sync panel. No empty charts.
2. **Sync on real data.** The Sync panel already listens to
   `sync:progress`. After `done`, refresh everything and toast "N new
   transactions" from the `SyncResult`. On failure, toast the fixed error
   message. Add Cancel while syncing (`sync:cancel`). While waiting for
   login, show "Log in to your bank in the window that just opened".
3. **Card bill review.** A row flagged `possible_card_bill` gets two
   clear actions in its row and in Needs review: "This pays a card I
   track" (`setInternal true`) and "This is spending" (`setInternal
   false`). An internal row offers "Count it as spending" and "Let
   CoinLeak decide" (`null`). Every action shows an Undo toast.
4. **Gone rows.** Rows with status `gone` appear muted with a "No longer
   reported by the bank" chip, and in Needs review with "Delete" (calls
   `transactions:deleteGone`) and "Keep" (closes the review for now; just
   hide the action, no channel needed).
5. **Card mode.** In Accounts, each card gets a small switch: "Billed
   monthly" or "Charged per purchase" (`accounts:setCardMode`), with one
   line of help text.
6. **Donut** uses `MonthSummary.byParent` instead of rolling up in the
   window. The trend chart keeps its own rollup for now.
7. **Demo mode** keeps working: extend `lib/demo.ts` for the new channels
   and include one gone row and one possible card bill.

## Visual check (required)

Screenshot in light and dark: first-run Home, Needs review with a card
bill and a gone row, the Accounts card-mode switch, and the Sync panel
while waiting for login. Use `COINLEAK_DATA_DIR` pointing to an empty temp
folder for the first-run shots without demo data. Look at each one and fix
what looks rough. Put screenshots under
`/home/matanya/Projects/CoinLeak/.claude/screenshots/05/`.

## Tests (definition of done)

- Demo data stays consistent with the new flows (gone rows count nowhere).
- The review actions call the right channel with the right arguments.
- `npm run check` green.

## Out of scope

Rules, packaging, Hebrew.
