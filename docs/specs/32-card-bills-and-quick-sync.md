# 32 Card bills by card number, and a quick sync (wave 13)

## Goal

Owner features F75 and F82 (`docs/FEATURES.md`).

1. A bank line that names the last 4 digits of a card the user syncs is
   that card's bill. The user never has to mark it by hand. (Owner: "If I
   already follow it then I already follow it." All the owner's cards are
   synced, and the bank lines for them are "identifiable by the last 4
   digits".)
2. Syncing Cal is "REALLY LONG". After a provider's first full download,
   a sync downloads only the recent part.

## Owns

- `src/core/ledger/card-bills.ts`, `card-patterns.ts`, their tests
- New `src/core/ledger/sync-window.ts` and `sync-window.test.ts` (or a
  small addition to an existing core file if that reads better), the
  export line in `src/core/ledger/index.ts`
- `src/main/sync/index.ts`, `history.ts`, `src/main/sync-range.ts`, their
  tests; `src/main/handlers.ts`: only the sync channel's arguments
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/renderer/src/components/sync/**`, `src/renderer/src/lib/sync.tsx`
- `src/renderer/src/lib/api.ts`: additive only
- `src/renderer/src/strings.ts`: append at the end in a `// spec 32` block

Do not touch Transactions components, categories, rules, Home, or any
window security file. Do not upgrade or patch `israeli-bank-scrapers`.
No real bank sync: the owner does that.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 3, 4 (money model,
card bills) and 5 (sync, pending rows, the window), `docs/banks/visaCal.md`,
`docs/banks/discount.md`, `card-bills.ts`, `card-patterns.ts`,
`src/main/sync/index.ts`, `history.ts`, `sync-range.ts`,
`docs/specs/04-*.md` (the pending window), `docs/specs/23-*.md` (sync range).

## Build

### 1. Card bills by card number (F75)

Today a numbered card-bill line may only pay the card with that number,
but it still has to equal that card's charges exactly (credit: one
billing day's sum; debit: one row) within `MATCH_WINDOW_DAYS`. When the
sums differ, the line is flagged "Card bill?" and the user marks it.

New rule, inside `planCardBills`, after the existing two passes:

- A bank line, money out, not protected (excluded or set by the user),
  not taken by the passes, whose numbers include the last 4 digits of a
  synced card (`accounts.kind = 'card'`), is **internal** and pays that
  card. Style is the card's mode. For credit style, `card_bill_date` is
  that card's billing day nearest to the line's date within 10 days, else
  null. It consumes no card rows (the exact passes already took what
  matched exactly).
- Numbers come from `readCardLine` as today, for lines that look like a
  card bill. Also accept a line that does not match a card pattern when it
  holds a **standalone** run of exactly 4 digits (not part of a longer
  number, not part of a date like `12/2025` or an amount) equal to a synced
  card's last 4. Be strict: a reference number like `98761234` must not
  match card `1234`.
- Two synced cards with the same last 4: the line is not decided by this
  rule (stays as today).
- Exact matches still win: the existing passes run first, unchanged.
- Lines naming no synced card behave exactly as today (D14: an untracked
  card's bill stays spending and flagged).
- The user's word still wins: "Not a card bill" (`setInternalByUser`)
  keeps working and is never undone by a later sync.

Every such line shows in the "Card bills" filter as today; nothing new is
hidden from it.

### 2. Quick sync (F82)

Why it is slow: for Cal the library asks for each month one by one, from
18 months back to one month ahead, about 20 calls per card, every sync
(`visa-cal.js` L336-363). The fix is to ask for less.

- **Core** (`sync-window.ts`): `quickSyncStart(db, provider, today)`
  returns the day a quick sync starts from: the provider's last
  successful sync day in this profile (`MAX(synced_at)` in `sync_runs`)
  minus 60 days. `null` when the provider was never synced (then the sync
  is full).
- **Main**: a sync takes a mode, `quick` (default) or `full`. The start
  date handed to the library is:
  - `full`, or `quick` with no earlier sync: today's behavior (the
    `syncFrom` setting, else "all the bank allows").
  - `quick`: the later of `quickSyncStart` and the `syncFrom` setting.
  The existing `effectiveStartDate` keeps deciding the window for pending
  rows, so rows before the window are never marked gone.
- **Window**: 60 days covers pending rows settling late (7 days), card
  bills (one cycle) and installments (the library dates each payment in
  its own month). Write a test that proves a pending row older than the
  window is left alone by a quick sync.
- **Renderer**: Sync stays one click and is quick. Each provider's sync
  control gets a secondary choice "Download everything again" (full).
  The sync progress text says which one is running, for example "Getting
  the last 2 months" or "Getting everything the bank allows (slower)".
- **Timing log**: one log line per sync with fixed codes and numbers only:
  provider id, mode, milliseconds for login wait, download and save, and
  how many accounts and rows. No text, amounts, account numbers or URLs
  (AGENTS.md). Follow the existing logger in `src/main`.

## Tests (definition of done)

- Card bills: a numbered line that does not equal the card's charges is
  internal for that card; exact matches still win and still consume rows;
  same last 4 on two cards decides nothing; a line naming an unsynced
  card's number stays spending and flagged; `98761234` and `12/2025`
  never match card `1234`; a standalone `1234` in a non-card line does;
  user decisions survive `applyCardBills`; money-in lines are never taken.
- Sync window: first sync is full; a quick sync starts at last sync minus
  60 days; never earlier than `syncFrom`; `full` ignores the last sync; a
  pending row before the window is not marked gone.
- The timing log line holds no forbidden data (a test on its text).
- `npm run check` green. Screenshot (light and dark) of the sync control
  with the "Download everything again" choice.

## Report

What you built, how many library calls a quick Cal sync makes vs a full
one (from the code), commits, anything outside Owns, screenshot paths,
doubts. Under 40 lines. The owner will time a real Cal sync before and
after.
