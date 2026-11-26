# Backlog

Findings from reviews that belong in a future spec. The lead moves items
into specs when planning a wave. Must-fix items block the first real use.

## Must fix before real use

Nothing open.

## From wave 14 (specs 34 and 36) and its merge

- Nesting budgets is the design now (spec 37). Moving a category on
  Categories so that a budget no longer fits is allowed, with a warning
  (owner, 2026-11-25); built in spec 40 A (move warning).
- A category's own rows open Transactions for the whole category: there
  is no "only this level" filter.
- Tab out of the Transactions and Trash lists relies on Chromium carrying
  Tab on from an invisible stop (`lib/roving.ts` guards); owner to confirm
  (OWNER-TESTS 10.8). The Menu key is caught on keydown; on Windows the
  native menu fires on keyup and might also open the right-click menu.
- New screenshot hooks sit in product components (`emoji-grid.tsx`,
  `trash-page.tsx`, `transactions-page.tsx`, `rules/tick-shot.ts`; wave 15 added `useRaiseShot` in
  `budgets/budget-line.tsx` (one router subscription per line), `useFirstRun` in `lib/hooks.ts`, the
  `trend-legend` effect in `home/trend-card.tsx`, and `settings/backup-section.tsx`), as finding 6 of the
  2026-11-08 review describes; `demo-shot.ts` is a better home.
- Lead, at merge: two bugs came only from specs 34 and 35 together and
  were fixed on `fix/picker-outside-router` (the rule editor crashed: a
  router hook in the category picker, which the editor renders outside
  the router; a rule offered to move rows from a subcategory of its own
  category back up). Next waves: screenshot every dialog after merging,
  not only each branch alone.

## From spec 35 (rule tick boxes)

- Undo after deleting a rule makes a new rule without its exceptions
  (`lib/rules.ts` `restoreRule`): an unticked row the rule never sorted
  could be picked up again. Fix: `rules:delete` returns the exceptions and
  the undo sends them back as `unticked`.
- The editor lists at most 500 matching rows. Hand-set rows past the 500
  are not shown, so saving never moves them (user edits win); before spec
  35 every hand-set row was listed and moved.

## From the wave 13 review (2026-11-25)

Full review: `docs/reviews/2026-11-25-wave13-review.md`.

- **Paid back dialog: open it from the page.** It adds a second dialog
  mechanism (`EntryDialog`, a `RowDialog` context, a dead slot in
  `RowMenuButton`) and lives inside the row. Give it to `RowMenuActions`
  like the note dialog. Moved into spec 36 (wave 14).
- **Paid back dialog: Enter right after typing** picks from the old list.
  Ignore Enter until the search caught up. Moved into spec 36 (wave 14).
- **Owner question:** when a purchase's category changes, should its
  pay-backs follow? Today they keep the old category. In HANDOFF.
- Nice to have: move `isMac` and `isFindKey` from
  `components/transactions/find.ts` into `lib/shortcuts.ts`; take the
  screenshot-only hook out of every row's `category-cell.tsx` (with finding
  6 of the 2026-11-08 review); hide "Paid back for a purchase..." on an
  ignored row; mark a dialog's OK explicitly instead of "the last solid
  button" (`ui/dialog.tsx`) and test it; spec 32 said card-worded lines use
  `readCardLine`'s numbers, the code uses standalone 4-digit runs (stricter,
  safe; note it or match it).

## Done

- (Review 2026-11-25, must fix 1) A new category on a paid-back row, by
  hand or by a saved rule, ends the link, so "Not paid back" can no longer
  empty a category the user chose. Same category keeps it.
- (Review 2026-11-25, must fix 2) Quick sync counts from the oldest last
  save among the provider's syncing accounts, so a card added back after a
  gap, or a download that saved no accounts, no longer skips months. Cost:
  an account the bank stopped reporting keeps that date old, so syncs go
  further back until it is removed from syncing.
- (Review 2026-11-25, should fix 3) `REQUIREMENTS.md` section 5 describes
  quick sync.

- (Spec 14) "Empty trash" keeps tombstones; a sync never re-adds emptied rows.

- (Owner, 2026-11-08) **Cal verified live end to end** in `npm run dev`:
  6 accounts; a second sync added 0 rows (dedup works). Cal is `verified`.

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

## Spec 09 leftovers (rules in Transactions), now in spec 11

- "Make a rule" in `components/transactions/bulk-bar.tsx`: call
  `rules:suggest`, then `useRuleEditor().openEditor({ draft, optIn: true })`.
- Toast after a hand categorization in `pages/transactions-page.tsx`
  `onRowCategory`: once per merchant per session (module-level Set on the
  normalized description), skip rows a rule sorted; "Make a rule" suggests
  from that row with the chosen category. Strings exist in `s.rules`.
- Rule chip in `components/transactions/transaction-row.tsx` when
  `ruleId != null && (categorySource === "rule" || excluded)`; click opens
  the rule from `useRules()`. Note: `rule_id` names the last rule that set
  any field, so with a category rule and a later exclude rule the chip
  opens the exclude rule.

## Spec 08 notes

- Isracard and Amex login success ("any personal-area page after the login
  page") is inferred from the library's URL layout, not seen live.
- Behatsdaa purchases can also appear on a synced card and count twice.
- Behatsdaa's site now asks for ID plus a one-time code; the library's own
  form selectors no longer exist (self-login does not use them).

## Wave 2 candidates

- (Done in main: channels exist) UI for the user's card-bill decisions:
  "this is a card bill" / "this is spending", and card mode in Accounts.
- A Cal bank line that pays several cards at once would not match today;
  confirm on real data.
- (Done: `MonthSummary.byParent`) Use it for the donut in the UI.

## From spec 12

- The category curves card has no amount axis; amounts show only on hover.
  Add a light left axis or end-of-line labels.
- Demo has no test for `summary:curves` (each curve's last day should equal
  that parent's `byParent` amount).
- Top categories mode includes Uncategorized when it is big; confirm the
  owner wants that.

## From spec 10

- The list of banks the user added lives in the window's localStorage. Move
  it to the `settings` table (a `settings:get/set` channel) so it sits with
  the rest of the data and survives a data-folder move or backup.
- The Sync tooltip floats a bit far from its row.
- `app-shell.tsx` screenshot shortcut `?sync=` accepts only discount and
  visaCal; could accept any enabled provider.

## From spec 11

- Undo of "Ignore" goes through `transactions:update`, so the row's
  exclusion becomes the user's; a row never excluded before can no longer
  be excluded by a rule. Undo should restore the previous `excluded` and
  `excluded_source` exactly.
- Files touched outside Owns, approved at merge: `core/db/migrations.ts`,
  `core/ledger/validate.ts`, `core/ledger/index.ts`, new `lib/review-rows.ts`.

## From spec 14

- Sankey: small categories bunch together at the bottom and the hover box
  can cover their labels; group tiny ones as "Other" or give the card more
  height.
- Transfer rows look like normal rows in Transactions; a "Savings" chip
  would help (`transaction-row.tsx`).
- A pending row that is emptied from Trash and later settles at a different
  amount gets a new dedup key and can come back (rare).
- Migration 0006 seeds "Savings & Investments"; it would fail if a
  category with that name already existed (impossible before the
  categories editor, so fine today).
- After spec 15 merges: add `transfer` to the categories editor's kind
  picker. (Done on the spec 15 branch at merge time.)
- Home queries money flow under the `summary:month` key, so it refreshes;
  a `useMoneyFlow` hook would be tidier.

## From spec 13

- "Also change N transactions you categorized by hand": a ticked row goes
  to the first rule that matches it, so if an earlier rule also matches,
  it lands there, not in the category the editor showed. Rare; consider
  applying the saved rule to those rows directly.
- Starter lists match by "contains", so short names ("Paz", "דלק") could
  catch unrelated shops. The preview shows counts first; consider "starts
  with" or whole-word matching for short names.
- The starter dialog's total is core's combined count only when every list
  is ticked; otherwise it sums the ticked lists (may count a row twice).
- Rules page screenshot's starter banner count predates the last demo change.

## From spec 15

- Sync now skips accounts removed from syncing (lead fix at merge, test in
  `accounts.test.ts`). Their pending rows stay pending until added back.
- Dock icon after `npm run desktop:install` not verified in the sandbox;
  owner to confirm on GNOME.
- The window icon path assumes `build/` sits next to `out/`; the installer
  spec must ship `build/icon.png` or switch to a packaged path.

## From spec 20

- The Cash wallet is left out of `accounts:list` (window code looks up a
  provider for every account), so the Transactions money-account filter
  cannot pick "Cash". Add it as its own filter option.
- `useFirstRun` keys off `accounts:list`: a profile with only a Cash wallet
  still shows the welcome screen.
- "Add note" from the right-click menu relies on the popover staying open
  after the menu closes; no test or screenshot. Owner to try.
- ATM withdrawals move into the wallet only from the first day of the
  wallet's first month (the month it was made or of its oldest row, the
  earlier), so making a wallet never removes years of past ATM spending.
  Lead accepted at merge, 2026-11-09; one line in `loadWallet`
  (`card-bills.ts`) if the owner wants otherwise.

## From spec 21

- "Also fits N transactions that rule X decides" refreshes when rules
  change, not after a hand categorization on Transactions (`rules:list`
  is not refreshed by ledger edits; `lib/hooks.ts`).
- `findAction` in `components/transactions/find.ts` and the strings
  `s.rules.order`, `s.categories.search`, `s.categories.noMatch` are no
  longer used; remove in the cleanup spec.
- A row counts as "decided by a higher rule" even when that rule sets the
  same category (the lower rule is redundant there). Kept: it tells the
  user the lower rule changes nothing for those rows.

## From spec 24

- The check dates bank rows by `date` (booking day), not `processed_date`
  (value date), from reading the library, not a live sync. Owner to
  confirm after two real Discount syncs; a false gap points here first.
- Not counted, can show a false gap: a pending row dated on the older
  balance's day that settles later; a late booking dated before it.
- "Show those transactions" opens from the older balance's day, so a few
  rows the older balance already counted show too.
- `useBalanceChecks` lives in `components/accounts/balance-check.tsx`;
  move it next to the other query hooks after spec 25.

## From spec 25

- The trend card and the donut still sum `byParent` across months to pick
  their top groups and fold the rest into "Other".
- `monthSummary`, `trend` and `MonthSummary` stay in core as test helpers;
  no channel reaches them.
- REQUIREMENTS section 4 glossary lists fewer flows than exist;
  `docs/ARCHITECTURE.md` has all 8.
