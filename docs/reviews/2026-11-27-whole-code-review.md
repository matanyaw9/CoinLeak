# Whole-code review, 2026-11-27

**Reviewed:** the whole app at `3c58c0d` (wave 17 merged): `src/core`, `src/main`, `src/preload`, `src/shared`, `src/renderer`. Read the way a careful senior developer would before a first release to a friend on Windows. No code was changed.
**Checks:** `npm run check` is green: typecheck, lint, 1336 tests in 111 files, build.
**Confirmed:** findings marked (confirmed) were proven with a throwaway test, run and then deleted.

## Verdict

Ready for a friend on Windows after one small fix (Must fix 1). The core is careful: money is integer agorot from the scraper edge to the screen, every user field is guarded, every write is one transaction, and the window security, IPC checks, logs and backup all hold. What is left is one Undo that can hide spending, two places where the Home charts drop refunds, one cleanup gap when the app quits during a sync, and code health from the 2026-11-08 review that is still open.

## Must fix

1. **Undo of a card-bill answer can hide another line's spending (confirmed).** `src/renderer/src/lib/review.ts:44` (`undoInternal`) and `src/core/ledger/card-bills.ts:349` (`setInternalByUser`).
   - What happens: Undo cannot tell a bill the matcher paired from one the user marked, so it always sends `internal: true`. That marks the line as the user's and leaves its card link empty. The card rows that bill paid are then free, and the matcher gives them to any other bank line with the same sum within 3 days.
   - Failure case: card 4321 has a cycle of ₪200 billed on 03-10. The bank has "חיוב לכרטיס ויזה 4321" ₪200 on 03-10 (paired, internal) and "כ.א.ל חיוב" ₪200 on 03-11 (counted as spending, flagged). The user clicks "Count it as spending" on the first line, then Undo. Both lines are now internal: ₪200 of spending is gone from every total, with no flag. Before the click, the second line counted.
   - Fix: make Undo exact, the way "Ignore" already is (`restoreExclusions`). Smallest version: `setInternalByUser` returns each row's `before` (`internal`, `internal_by_user`), and Undo sends `null` (back to the matcher) when `internal_by_user` was 0. Add a core test with the two lines above.

## Should fix

1. **A category with more refunds than spending disappears from the Home donut and the trend bars (confirmed).** `src/renderer/src/lib/categories.ts:110` drops every group whose amount is 0 or less, and `src/renderer/src/components/home/trend-card.tsx:443` clamps each part at 0.
   - Failure case: in March, Food has ₪1,000 of spending and Lifestyle has only a ₪300 refund for a February purchase. Core says spending is ₪700 and Lifestyle is -₪300. The donut's middle says ₪700, but its list shows only Food ₪1,000 at 143%. The refund is nowhere on the card. The trend bar for March has the same gap. `AGENTS.md`: never hide spending, and the window never computes totals.
   - Fix: keep negative groups in the list (not in the ring, which cannot draw them), shown as money back, so the list adds up to the total. The cleanest way is for core to send the donut its list ready to draw (with "Other" folded), which also closes the backlog line about the donut and trend summing `byParent` in the window.
2. **Quitting during a sync may leave the bank session's browser profile on disk (unsure, not tried on Windows).** `src/main/index.ts:163` quits at once when the window closes, and `src/main/sync/browser.ts:160` (`removeOnExit`) deletes the profile in the `exit` handler.
   - What happens: if the user closes CoinLeak while the bank page is open, the `finally` in `withSyncBrowser` never runs. The exit handler was registered before puppeteer's, so it runs while Chrome is still alive. On Windows, Chrome's open files cannot be deleted, so the delete fails quietly. The profile, with the bank's cookies, then stays in `%TEMP%` until the next sync, and that sweep (`browser.ts:231`) only removes profiles older than an hour. REQUIREMENTS section 3 says the profile is deleted right after the download.
   - Fix, two small parts: (a) in `index.ts`, on `before-quit`, when `sync.isRunning()`, call `event.preventDefault()`, `sync.cancel()`, wait for the sync to end (at most about 20 seconds), then quit; (b) at app start, before any sync can run (the single-instance lock is held), remove every `coinleak-sync-*` folder whatever its age. Owner test: start a sync on Windows, close CoinLeak on the bank's login page, then look in `%TEMP%`.
3. **`rules:create` has no caller in the window.** `src/shared/ipc.ts:122` and `:272`, `src/main/handlers.ts:137`. The editor saves with `rules:save` and the toggle uses `rules:update`. A dead channel is one more door into main with nothing testing it from the window.
   - Fix: remove the channel from `IpcContract`, `CHANNELS` and `handlers.ts`. Keep `createRule` in core: the Demo seed uses it (`src/core/demo/seed.ts:99`). Change its comment in `src/core/rules/queries.ts` to "for the Demo's rules".
4. **Limits are still written twice (2026-11-08 review, finding 7).** `src/renderer/src/lib/rule-form.ts:31-34` repeats `MAX_TEXT`, `MAX_NAME`, `MAX_CONDITIONS` and `MAX_VALUES` from `src/core/rules/validate.ts`. `src/renderer/src/components/transactions/manual-form.ts:20-21` repeats `DESCRIPTION_MAX` (`core/ledger/cash.ts:14`) and `NOTE_MAX` (`core/ledger/validate.ts`).
   - Failure case: someone raises the note limit to 1,000 in core only. The window still stops typing at 500, or, the other way round, the window lets 600 through and core answers "Something went wrong" with the note lost.
   - Fix: one `src/shared/limits.ts` that core and window both import.
5. **`src/core/ledger/queries.ts` has grown to 532 lines and still does five jobs (2026-11-08 review, finding 5).** Accounts, categories, the transaction list, user edits, Trash and summaries sit in one file. `period.ts` (455) is next. The next wave that touches Trash or edits will be editing one big file.
   - Fix (a pure move, `ledger/index.ts` hides it): `listAccounts` to `accounts.ts`, `listCategories` to `categories.ts`, Trash to `trash.ts`, `updateTransactions` and its helpers to `edits.ts`; leave the list and day totals in `queries.ts`.

## Nice to have

1. **One bad pattern rule can freeze the app (unsure, not tried).** `src/core/rules/match.ts:53` compiles the user's pattern with `new RegExp` and runs it on every row, on the main process, at every save, preview, sync and Rules page load. A pattern such as `(\d+)+$` against a long run of digits backtracks for minutes. The app then stops answering, and the Rules page that could delete the rule runs the pattern too. Patterns are behind "advanced", so this is rare. Fix: refuse nested repeats in `compileRegex` (a `+`, `*` or `{` right after a group that already repeats), with a test.
2. **Small leftovers from the 2026-11-08 review (finding 11).**
   - `src/renderer/src/pages/transactions-page.tsx:69` has its own `useDebounced`; the shared one is `lib/use-debounced.ts`. Delete the copy and import the shared one.
   - `formatDateNumeric` in `src/renderer/src/lib/format.ts:45` has no caller. Delete it.
3. **Deleting a category drops its budget without saying so.** `src/core/ledger/categories.ts` (`deleteCategory`) counts rows and rules to decide "in use", but not `monthly_budget`. Failure case: Coffee has a ₪300 budget, no rows and no rules; Delete removes it at once, and the Budgets total no longer adds up the way the user planned. Fix: when the category has a budget, the delete dialog says so ("Its ₪300 budget goes too"); core can return the budget in the refusal or the result.

## Checked and fine

- **Money.** `toAgorot` runs only in `main/sync/normalize.ts`. `ingest` refuses any amount that is not a safe integer, all money tables are `STRICT`, and every total comes from core over `LEDGER_SQL`. `FLOW_SQL` and `flowOf` agree (tested). Day subtotals now come from core (`dayTotals`).
- **Saving a download.** One transaction: exact matches, then drift, then new rows. Accounts removed from syncing are skipped whole. Emptied rows leave tombstones. Pending rows the user trashed settle in place and stay trashed. A malformed row stops the save instead of being skipped.
- **User edits win.** `ingest` never writes notes, categories or exclusions. The rules engine skips any field the user set (`userSet`). Only the rows the editor listed are handed over (`handOver`), and unticked rows keep what they have.
- **Window security.** `webPreferences` in `main/index.ts:130` are unchanged: sandbox, context isolation, no Node, no devtools when packaged. The CSP has no remote source. `protocol.ts` refuses other hosts and paths outside the folder. Permissions, navigation, new windows and webviews are all refused. `security.ts`, `protocol.ts` and `ipc.ts` now have tests (the 2026-11-08 review's finding 8 is done).
- **IPC.** Every channel checks the sender's page. `EVERY_CHANNEL_LISTED` makes a channel missing from `CHANNELS` a type error. Core checks every argument and answers `BAD_REQUEST`. The window only ever gets a fixed code and message (`toAppError`).
- **The one link out.** `main/links.ts` takes a name, checks it with `Object.hasOwn`, and opens a fixed GitHub address. It is the only `shell.openExternal` in the app.
- **Backup and restore.** A backup is written to a private temp file and renamed into place. Restore refuses a file over 1 GB, without the SQLite header, failing `integrity_check`, from a newer app, or whose schema differs at all from what our migrations make. It turns `trusted_schema` off and works on a private copy, never the open profile.
- **Logs.** All nine log lines in `src` carry fixed words, provider ids, codes and counts. None holds row text, amounts, account numbers, paths or a library's message.
- **`AGENTS.md` rules.** No em dashes anywhere in `src` or the docs. The only mouse-only handlers are the curve chart's dots (the legend buttons do the same, from the keyboard) and the money-flow chart, which the backlog already lists.

## Not repeated here

Already in `docs/BACKLOG.md`: screenshot hooks in product components; the donut and trend summing `byParent` to pick top groups; the "only this level" filter; Tab out of the Transactions and Trash lists; "Keep" for gone rows held only in the window; the `isMac` re-export in `find.ts`; the 500-row cap on hand-set rows in the editor; `judgePending` being per download, not per card.
