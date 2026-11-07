# 06 Sync hardening (wave 2, must-fix)

## Goal

Three fixes found in the spec 04 review, all at the edge between the bank
download and the ledger. Read `docs/BACKLOG.md` ("Must fix" and
"Follow-ups from spec 04") first.

## Owns

- `src/main/sync/normalize.ts`, `src/main/sync/index.ts` and their tests
- `src/main/sync-service.ts` and its test
- `src/core/ledger/pending.ts`, `src/core/ledger/ingest.ts` and their tests
- `src/shared/types.ts`: comments only (document rule 1 on `amount`)

Do not touch `src/renderer/**` (another agent is working there).

## 1. Foreign pending purchases (must-fix)

Cal reports a pending foreign purchase with its amount in the purchase
currency (`node_modules/israeli-bank-scrapers/lib/scrapers/visa-cal.js`
around L183), so a pending $50 would count as 50 ILS.

- In `normalize.ts`: a **pending** row whose original currency is not ILS
  gets `amount = 0` (the shekel amount is not known yet) and keeps
  `originalAmount` and `originalCurrency`. Completed rows are unchanged.
  Check what the library puts in `chargedAmount` vs `originalAmount` for
  such rows and handle both shapes; do this for any provider, not only Cal.
- In `pending.ts`: drift settle must pair such a row with its completed
  version: when the stored pending row has `amount = 0` and an original
  currency, compare original amount and currency instead of `amount`
  (same tolerance, same description, installment, direction and 7 days).
  Otherwise these rows would always turn gone and lose the user's category.
- Document in `src/shared/types.ts` (comment on `ScrapedTransaction.amount`
  and `TransactionRow.amount`): "0 on a pending foreign row means the
  shekel amount is not known yet; `originalAmount` holds the real one."
  The window will show it as e.g. "$50.00, shekel amount when it settles"
  (a later UI task).

## 2. Pass the real download window

`ingest` accepts `since`. Today the sync service passes nothing, which
falls back to the earliest downloaded day (safe but blunt).

- In `src/main/sync/index.ts`, export a pure
  `effectiveStartDate(provider, requested, now): IsoDate` that mirrors the
  library's clamp (read the library: Discount about 1 year back plus 2 days,
  Cal about 18 months back plus 1 day), in Israel days, **plus one day**
  for safety.
- `runSync` returns it alongside the accounts (change its return type to
  `{ accounts, since }`; update `scripts/sync-try.ts` to match), and the
  sync service passes `since` to `ingest`.

## 3. Cal pending fetch can fail silently

If Cal's pending endpoint fails, the library returns no pending rows and
every stored Cal pending row would turn gone for one sync.

- `ingest` gets an option `judgePending?: boolean` (default true). When
  false, drift settle still runs, but nothing new is marked gone.
- The sync service passes `judgePending: false` for `visaCal` when the
  download has zero pending rows across all its accounts.

## Tests (definition of done)

- normalize: a pending USD row becomes amount 0 with original amount and
  currency; a completed USD row keeps its charged ILS amount; a pending ILS
  row is unchanged.
- pending: a pending $50 (amount 0) settles with drift onto the completed
  row (ILS amount, original $50.40), keeps its category, counts once; a
  pending EUR row never pairs with a USD row.
- effectiveStartDate: both providers, near the year boundary and near
  midnight Israel time; never earlier than the library's own start.
- sync service: passes `since`; passes `judgePending: false` for a Cal
  download with no pending rows and true otherwise; Discount always true.
- ingest: `judgePending: false` marks nothing gone but still settles.
- `npm run check` green.
