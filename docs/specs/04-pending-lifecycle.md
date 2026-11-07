# 04 Pending lifecycle (wave 2, must-fix)

## Goal

A pending row must never be counted twice and never be silently dropped.
Today (spec 02) a pending row settles only when the completed version has
the exact same content hash. Real banks change things on settlement:

- a foreign-currency card purchase often settles with a different ILS
  amount, sometimes a different date;
- some pending lines vanish for good, notably Discount's temporary card
  aggregate `חיוב זמני למפתח מזומן`.

Both leave a stale pending row that keeps counting. Fix it.

## Owns

- `src/core/ledger/**` and its tests, `src/core/testing/**`
- New migration `src/core/db/migrations/0003_pending.sql`, registered in
  `src/core/db/migrations.ts`. Prefer `ALTER TABLE ... ADD COLUMN` over
  rebuilding tables.
- `src/main/handlers.ts`: only the `"transactions:deleteGone"` line, to
  call your new core function.

Read but do not edit: `src/shared/*` (the lead already added `gone` to
`TxnStatus`, `Flow` and `ReviewFlag`, `ScrapedStatus` for download rows,
and `MonthSummary.byParent`), `REQUIREMENTS.md` sections 4 and 5,
`AGENTS.md`, `docs/BACKLOG.md`. Research (read only):
`node_modules/israeli-bank-scrapers/lib/scrapers/discount.js` and
`visa-cal.js`: how pending rows and the temporary aggregate are reported,
and which date range a download covers.

## Rules to implement

1. **Download window.** `ingest` gets an optional `since: IsoDate` (the
   start date the sync asked the bank for). Without it, use the earliest
   date in that account's download. Only rows on or after the window start
   can be judged missing.
2. **Settle with drift.** For each stored pending row of an account in the
   download that has no exact match: if the download has a completed row on
   the same account, with the same description (whitespace-normalized),
   date within 7 days, amount differing by at most max(10%, 5 ILS), and
   that completed row is not already an exact match for another stored
   row, the pending row **becomes** that row: update amount, date,
   processed date, original amount and currency, status, identifier, and
   its dedup hash and sequence, keeping all user fields. Do not insert the
   completed row a second time. Choose the closest candidate
   deterministically (smallest amount difference, then date difference,
   then id).
3. **Gone.** A stored pending row inside the window that is neither
   exactly matched nor settled with drift becomes `gone`: it counts
   nowhere (`flow = 'gone'`), carries the `gone` review flag, and keeps
   its user fields. A later download that contains it again (exact hash)
   brings it back to the status in that download.
4. **Delete gone.** `deleteGoneRows(db, ids)` deletes only rows whose
   status is `gone` and returns the count; anything else in `ids` is left
   untouched. Wire it to `"transactions:deleteGone"`.
5. **Everything else unchanged.** Completed rows are never changed by a
   later download. Card bills are recomputed after all of this, inside the
   same transaction. `flowOf`, `flagsOf`, `FLOW_SQL` and the SQL flags all
   learn `gone`, and the test that they agree keeps covering every case.
6. In your report, say what the Discount and Cal scrapers actually do with
   pending rows and the temporary aggregate, with file and line, and
   whether rule 3 handles the aggregate.

## Tests (definition of done)

- A foreign-currency pending row that settles 1.5% higher is updated in
  place, keeps its category and note, and the month total counts it once.
- A pending row whose date moves by 2 days settles with drift.
- Two pending coffees that settle as two completed coffees pair one to
  one, never both to the same row.
- A vanished pending row inside the window becomes `gone`, counts nowhere,
  is in the needs-review list; a pending row older than the window is left
  alone.
- A gone row that reappears in a later download comes back.
- `deleteGoneRows` deletes only gone rows.
- A completed row whose amount looks close to a new row is never touched.
- `monthSummary`, `trend` and `byParent` exclude gone rows.
- `npm run check` green.

## Out of scope

UI for gone rows (the UI wave shows the flag), rules engine, sync wiring.
