# Backlog

Findings from reviews that belong in a future spec. The lead moves items
into specs when planning a wave. Must-fix items block the first real use.

## Must fix before real use

Nothing open. Next gate: the owner's first real login (`docs/OWNER-TESTS.md`).

## Done

- (Owner, 2026-11-08) **Discount verified live end to end** after the fix:
  1 account, 274 rows, 2025-11-10 to 2026-11-05, 1 pending, 26 s. Cal
  login verified; Cal download still to confirm.

- (Lead, owner's first real login, 2026-11-08) Self-login works live on both
  Discount and Cal: login was detected on each. The sync then failed with
  LOGIN_CANCELLED because the library closes its own tab in `terminate()`
  after downloading, which the sync browser read as the user closing it.
  Fixed with a `finishing` signal from the scraper subclasses; regression
  tests added. Blocked hosts seen live: Discount analytics and Google Tag
  Manager; Cal Google analytics, maps, YouTube. None were needed for login.

- (Spec 06) Cal pending foreign purchases counted in the wrong currency:
  now amount 0 until they settle, then pair by original amount.
- (Spec 06) The sync passes the real download window (`since`) to ingest.
- (Spec 06) A failed Cal pending fetch no longer turns pending rows gone.
- (Lead, after spec 06) Same-day pending foreign purchases at one shop get
  distinct hashes; a pending shekel refund on Cal counts as money in.

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
- A pending row whose amount changes while still pending becomes gone plus
  a new pending row; user fields stay on the gone row.
- "Keep" for gone rows has no channel yet (the UI only hides the action).

- `judgePending` is per download, not per card: if one Cal card's pending
  fetch fails while another card has pending rows, the first card's rows
  still turn gone for one sync.
- Owner check on real Cal data: what `trnCurrencySymbol` holds for shekels
  (anything other than ₪, NIS, ILS or ש"ח would zero a pending shekel row).

## Wave 2 candidates

- (Done in main: channels exist) UI for the user's card-bill decisions:
  "this is a card bill" / "this is spending", and card mode in Accounts.
- A Cal bank line that pays several cards at once would not match today;
  confirm on real data.
- (Done: `MonthSummary.byParent`) Use it for the donut in the UI.
