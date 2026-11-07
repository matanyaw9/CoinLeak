# Backlog

Findings from reviews that belong in a future spec. The lead moves items
into specs when planning a wave. Must-fix items block the first real use.

## Must fix before real use

- **Pending rows that change when they settle** (from the spec 02 review).
  A pending card charge can come back completed with a different amount or
  date (foreign currency), and some pending lines vanish entirely (Discount
  `חיוב זמני למפתח מזומן`). Today the old pending row stays and is counted
  twice. Proposed rule: after a download, a pending row in the download's
  date range that is not in the download becomes `gone` (counts nowhere,
  shown in review with "delete" or "keep"); when a completed row appears on
  the same account with the same description within a few days and a
  close amount, it takes over the pending row's user fields. Needs a
  `gone` status in `TxnStatus`.

## Wave 2 candidates

- IPC for the user's card-bill decisions: `setInternalByUser` ("this is a
  card bill" / "this is spending") and `setCardMode` (core functions exist).
- A Cal bank line that pays several cards at once would not match today;
  confirm on real data.
- Summary grouped by parent category for the donut (`byParent` on
  `MonthSummary` or a query option), so the window never adds totals.
