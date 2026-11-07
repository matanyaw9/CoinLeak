# Backlog

Findings from reviews that belong in a future spec. The lead moves items
into specs when planning a wave. Must-fix items block the first real use.

## Must fix before real use

- **Cal pending foreign purchases count in the wrong currency** (spec 04
  review). Cal reports a pending foreign purchase's amount in the purchase
  currency (`visa-cal.js` L183), so a pending $50 counts as 50 ILS until
  it settles. Fix at the scraper edge in `normalize.ts`: for a pending row
  whose currency is not ILS, do not invent a shekel amount; show the
  original amount and keep it out of totals until it settles (needs a
  decision on how to display it).

## Done

- (Spec 04, merged) **Pending rows that change when they settle** (from the spec 02 review).
  A pending card charge can come back completed with a different amount or
  date (foreign currency), and some pending lines vanish entirely (Discount
  `חיוב זמני למפתח מזומן`). Today the old pending row stays and is counted
  twice. Proposed rule: after a download, a pending row in the download's
  date range that is not in the download becomes `gone` (counts nowhere,
  shown in review with "delete" or "keep"); when a completed row appears on
  the same account with the same description within a few days and a
  close amount, it takes over the pending row's user fields. Needs a
  `gone` status in `TxnStatus`.

## Follow-ups from spec 04

- Confirm on real data which Discount block holds `חיוב זמני למפתח מזומן`.
  If it arrives as completed, gone does not apply and only card-bill
  matching can stop it from counting twice.
- A failed Cal pending fetch (`visa-cal.js` L366-372) returns no pending
  rows, so every Cal pending row turns gone for that one sync and comes
  back next time. Consider skipping the gone step when a Cal download has
  zero pending rows but the database has recent ones.
- A pending row whose amount changes while still pending becomes gone plus
  a new pending row; user fields stay on the gone row.
- "Keep" for gone rows has no channel yet (the UI only hides the action).
- The sync service should pass `since` (the start date the library really
  used, in Israel days) to `ingest`. Today it passes nothing, which falls
  back to the account's earliest downloaded day (safe).

## Wave 2 candidates

- (Done in main: channels exist) UI for the user's card-bill decisions:
  "this is a card bill" / "this is spending", and card mode in Accounts.
- A Cal bank line that pays several cards at once would not match today;
  confirm on real data.
- (Done: `MonthSummary.byParent`) Use it for the donut in the UI.
