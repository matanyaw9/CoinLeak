# 24 Balance check: do the numbers add up? (wave 9)

## Goal

After each sync, show the bank's own balance next to what CoinLeak's rows
say, so the user can trust the numbers or see a gap. Owner feature F54
(`docs/FEATURES.md`).

## Owns

- `src/core/db/migrations/0011_*.sql` (the only migration this wave),
  `src/core/db/migrations.ts` if new files must be listed
- `src/core/ledger/ingest.ts` (record the snapshot), a new
  `src/core/ledger/balance.ts` with tests, `src/core/ledger/index.ts`
  (export line), `src/core/ledger/queries.ts` only `listAccounts`
- `src/core/demo/**`: snapshots for the Demo bank account, one matching
  and one with a small gap
- `src/main/handlers.ts`: only your channel
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/renderer/src/pages/accounts-page.tsx`, `components/accounts/**`
  except `remove-sync.tsx`
- `src/renderer/src/strings.ts`: append at the end in a `// spec 24` block

Do not touch Settings, Home, Transactions, profiles, sync files (specs 23
and 25). Never fail or block a sync because of a balance.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 4 and 5,
`src/core/ledger/ingest.ts`, `docs/banks/discount.md` and `visaCal.md`
(what each provider sends as balance).

## Build

1. **Keep every balance.** Migration 0011 adds `balance_snapshots`
   (account, balance in agorot, taken at, sync run). Ingest writes one per
   account per sync when the bank sent a balance; `accounts.balance` keeps
   the latest as today.
2. **The check, in core.** For a bank account with two snapshots A (older)
   and B (newer): the bank says the balance moved by B minus A. CoinLeak's
   rows for that account that the bank booked between the two (decide and
   document which date: the booking date the bank uses, processed date
   where it differs; pending rows are usually not in a bank balance, test
   both ways and pick what the library's data supports) should add up to
   the same. Result per account: `matches`, `gap` (amount and the window),
   or `unknown` (fewer than two snapshots, no balance from this bank, or a
   card). Count every row of the account, including excluded, internal and
   trashed rows: the bank's money moved either way. Tolerance: exact, in
   agorot.
3. **Show it on Money accounts.** Each bank account shows its balance and
   "as of <date>". Then one quiet line:
   - matches: "Adds up: the 14 transactions since 3 Nov match the bank's
     balance."
   - gap: "₪120 the bank shows is not in CoinLeak's transactions since
     3 Nov." with "Show those transactions" (opens Transactions filtered
     to that account and window) and a short "Why can this happen?"
     (a pending row, a row in Trash that is also missing, a late
     booking). Never hides or changes any row.
   - unknown: "Sync again to check the balance" or nothing for cards.
4. **Never silent.** A gap is shown, not fixed. No row is created to make
   the numbers match.

## Tests (definition of done)

- Migration 0011 on a database with accounts and rows keeps everything.
- Snapshots: one per account per sync with a balance; none without.
- Check: matches, a gap of one missing row, pending rows, trashed and
  excluded rows still counted, a card account is unknown, one snapshot is
  unknown.
- A sync without a balance still succeeds.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  Money accounts with a matching account and one with a gap.

## Report

What you built, the date rule you chose and why, migration, channel and
type changes, commits, anything outside Owns, screenshot paths, doubts.
