# 02 Ledger core (wave 1)

## Goal

Everything between "the scraper returned rows" and "the window asks for
numbers": the database schema, saving rows without duplicates, matching
card bills so nothing is counted twice, deriving each row's flow, and the
queries the screens need. Pure TypeScript in `src/core`, no Electron,
fully unit tested.

## Owns

- `src/core/**` except `src/core/db/index.ts` (read only)
- New migration `src/core/db/migrations/0002_ledger.sql`, registered in
  `src/core/db/migrations.ts`
- `src/core/testing/**` for test builders (synthetic data only)

Read but do not edit: `src/shared/*` (your inputs and outputs are
`ScrapedAccount`, `Account`, `Category`, `TransactionRow`,
`TransactionFilter`, `TransactionPatch`, `MonthSummary`, `TrendPoint`,
`SyncResult`), `REQUIREMENTS.md` sections 4 and 5, `AGENTS.md`.

Prior art (read only, port with a credit comment in the file header):
- `~/Projects/Spent/src/server/lib/transfers.ts` and its test: Hebrew
  card-bill patterns, last-4 matching, untracked cards stay counted.
- `~/Projects/Spent/src/server/lib/dedup.ts`
- `~/Projects/Spent/src/server/db/migrations/` for the seeded category
  list, emoji and colors (flatten to two levels).
- `~/Projects/Pocket/REQUIREMENTS.md` sections 5 and 6 (dedup, pending
  lifecycle, debit vs credit card pairing).

## Build

1. **Schema (0002).** `accounts`, `categories` (two levels, seeded, kind
   expense or income, emoji, color, archived), `sync_runs`,
   `transactions` (fields of `TransactionRow` plus `dedup_hash`,
   `dedup_seq`, `sync_run_id`, card-bill match columns, timestamps). Money
   columns `INTEGER`. Sensible indexes for date, account and category
   queries. Unique `(account_id, dedup_hash, dedup_seq)`.
2. **Ingest** (`ledger/ingest.ts`): `ingest(db, accounts, { now })` returns
   `SyncResult`. Upserts accounts (Discount is `bank`, Cal is `card`).
   Dedup by content hash plus sequence number per REQUIREMENTS section 5.
   Pending rows that reappear completed are updated in place (status,
   processed date, identifier only). Never touches category, note,
   excluded. All inside one `transaction()`. Recomputes card bills after.
3. **Card bills** (`ledger/card-bills.ts`): mark a bank line `internal`
   when it pays a tracked card: debit style (one bank line per purchase:
   same amount, card last 4 when present, within 3 days of the card row's
   processed date) and credit style (one bank line equals the sum of the
   card's rows with that processed date, within 3 days). A line that looks
   like a card bill but matches nothing stays spending and gets the
   `possible_card_bill` flag. Idempotent: rerunning gives the same result.
   Never changes a row the user excluded or re-flowed by hand.
4. **Flow** (`ledger/flow.ts`): one TypeScript function and one SQL `CASE`
   fragment implementing the table in REQUIREMENTS section 4. A test
   asserts both agree on every case.
5. **Queries** (`ledger/queries.ts`): `listAccounts`, `listCategories`,
   `listTransactions(filter)` returning `TransactionRow[]` newest first,
   `updateTransactions(ids, patch)` (sets `category_source = 'user'` when
   the category changes), `monthSummary(month)`, `trend(months)`.
   Month boundaries use the row `date`. Spending is reported as a positive
   number after refunds.

## Tests (definition of done)

Build synthetic ledgers with known answers (`src/core/testing/`):
- dedup: two overlapping downloads give no duplicates; two identical
  coffees on the same day are two rows; a third identical one in a later
  download is added.
- pending to completed updates in place and keeps the user's category.
- user fields survive a re-sync.
- card bills: credit cycle matched; debit 1:1 matched; untracked card bill
  stays spending and flagged; amounts off by one agora do not match;
  rerun is idempotent.
- flow: TS and SQL agree; refund reduces its category; excluded counts
  nowhere.
- `monthSummary` and `trend` on a hand-built ledger equal hand-computed
  totals.
- `npm run check` green.

## Out of scope

Rules engine (wave 2), IPC handlers, UI, scraping.
