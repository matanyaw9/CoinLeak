# 14 Money flow: savings are not spending, the Sankey chart, Empty trash fix (wave 5)

## Goal

Money moved to savings or investments stops looking like spending, and
Home gets a flow chart of the month: where the money came from and where
it went. Also fix the must-fix "Empty trash" bug. Owner features F3 and
F25 (`docs/FEATURES.md`); `docs/BACKLOG.md` "Must fix before real use".

## Owns

- `src/core/db/migrations/0006_transfers.sql` (new) and its line in
  `src/core/db/migrations.ts`
- `src/core/ledger/flow.ts`, `src/core/ledger/queries.ts` (except
  `updateTransactions`, which spec 13 owns), `src/core/ledger/validate.ts`,
  new `src/core/ledger/money-flow.ts`, and tests
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive, plus adding
  `"transfer"` to `CategoryKind` and `Flow`
- `src/main/handlers.ts`: the new channel only
- `src/renderer/src/pages/home-page.tsx`, `components/home/**`,
  `components/charts/**`
- `src/renderer/src/lib/demo.ts`: summaries and the new channel
- `src/renderer/src/lib/categories.ts` and the category picker, only so
  transfer categories show and pick correctly
- `src/renderer/src/strings.ts`: append at the end in a `// spec 14` block

Do not touch `src/core/rules/**`, `categories-page.tsx`,
`accounts-page.tsx`, `components/sync/**`, `components/rules/**`.

Read first: `AGENTS.md`, `REQUIREMENTS.md` section 4 (money model),
`src/core/ledger/flow.ts`, `docs/research/money-charts.md` (Sankey), the
Recharts Sankey in `node_modules/recharts`.

## Build

1. **Transfer kind (F3).** Categories get a third kind, `transfer`
   (SQLite cannot change a CHECK in place: rebuild the `categories` table
   in the migration, keeping ids, triggers and indexes; test it on a
   database with data). Seed a top-level "Savings & Investments" (kind
   transfer) with "Savings" and "Investments" under it. New flow
   `transfer`: a row in a transfer category, either direction. It counts
   as neither spending nor income. Order in `flowOf` and `FLOW_SQL`:
   trashed, gone, excluded, internal, transfer, then the rest. The TS/SQL
   agreement test covers it. `MonthSummary` gains `transfers` (net moved
   out, positive) and Home's hero shows "Moved to savings ₪X" when it is
   not zero. "Left" stays income minus spending.
2. **Money flow (F25).** `monthFlow(db, month)` in core returns nodes and
   links in agorot: income categories on the left into one "Income" node;
   from it to each top-level spending category, to "Savings &
   Investments" (net transfers out), and to "Left" (when income exceeds
   spending plus transfers). When spending plus transfers exceed income,
   add a "From savings / earlier months" source on the left so the chart
   balances; never fake numbers. Pending rows count like elsewhere.
   Channel `summary:flow`.
3. **Home card "Where the money went"**: Recharts Sankey in category
   colors, in Spent's look, hover shows amounts and share of income,
   clicking a category node opens Transactions for that category and
   month. Empty state when there is no income or no spending.
4. **Empty trash fix.** Emptied rows must never come back with a sync.
   Keep a tombstone per emptied row (its dedup key and copy number) in a
   table, and make ingest treat a tombstoned key as already present.
   Include it in this migration.

## Tests (definition of done)

- Flow: transfer in both directions, its order against the other flows.
- Migration: an existing database keeps every category id, child link and
  transaction category after the rebuild.
- Summaries: transfers excluded from spending and income, `transfers` total.
- `monthFlow`: balances (sum in equals sum out) for a normal month, an
  overspent month, a month with no income, uncategorized rows, refunds.
- Empty trash: ingesting the same download after emptying adds nothing.
- `npm run check` green. Screenshots light and dark: the Sankey card with
  demo data (with savings), the hero with "Moved to savings".

## Report

What you built, the new channel, the migration notes, commits, anything
outside Owns, screenshot paths.
