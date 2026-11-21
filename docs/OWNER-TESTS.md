# Owner tests

Things only the owner can check, because they need a real bank login or a
human eye. Each takes a few minutes. Report results to the lead in the
chat; the printed summaries hold no private data and are safe to paste.

**Before testing new work, restart `npm run dev`** (Ctrl+C, then start it
again). A running dev window reloads its screens when code changes, but the
app behind them keeps the old code, so new buttons can fail until a restart.

## 1. First real login (sync:try)

Checks that self-login works on the live Discount and Cal sites. Nothing
is saved; it only prints counts.

1. Install a browser for syncing (once):
   `sudo dnf install chromium`
2. In `~/Projects/CoinLeak`: `git pull && npm ci && npm run setup`
3. Make sure debug logging is off: `unset DEBUG NODE_DEBUG`
4. `npm run sync:try -- discount`
   - A Chromium window opens with "controlled by automated test
     software" at the top. The address bar shows
     `https://start.telebank.co.il/...`.
   - Log in yourself, including the SMS code, and stay on the account
     home page.
   - The terminal prints "Logged in. Downloading...", the window closes,
     and a summary prints: accounts, rows per account, a date range of
     about a year, pending count, blocked hosts.
   - If Chromium offers to save your password, click No and tell the lead.
   - If it still says "Log in..." 10 seconds after you reach the home
     page, note the shape of the address bar (no numbers) and report it.
5. `npm run sync:try -- visaCal`
   - Click the login button on cal-online and log in in the panel.
   - Expect one line per card, about 18 months back to a month ahead.
   - `BANK_ERROR` right after "Logged in" means the Cal token path
     failed. Report it.
6. Negative checks:
   - Start a run and close the window before logging in: expect
     `Sync failed: LOGIN_CANCELLED`.
   - Start a run and press Ctrl+C: same.
   - After each run, `ls /tmp | grep coinleak-sync` prints nothing.
7. Paste the summary lines, any `Sync failed: <CODE>`, and the blocked
   hosts list for each bank.

## 2. Look and feel

Run `npm run dev`. To look around on made-up data, add the Demo profile in
Settings, Profiles. Say what feels wrong, rough, or missing.
Screenshots with amounts blurred are welcome.

## 3. Wave 6 (periods, transactions tools, categories, sync feel)

Run `npm run dev` (your dev data). About 15 minutes.

1. **Periods.** Top bar picker: try Last 7 days, Last 12 months, This
   year. Home and Transactions both follow. Pick Custom, set any first
   and last day, press "Show these days". Then set the first day after
   the last: a red message, the button stays off.
2. **Bar chart filter.** Home, "Month by month": open the categories
   list, tick Food and one other group. Only those show. Click a colored
   segment to add it. "All spending" goes back.
3. **Home charts.** Hover the pie: one label, nothing covering the slice.
   In the money flow chart, click a group (Food): its own chart opens,
   with Back. "This month vs last month": this month's line stops today.
4. **Transactions.** Sort by amount and by name. Filter by a category, a
   card, and "Spending"; remove a chip with its x. Click a row's category
   to show only that category. Hover a rule-set category: it says which
   rule. Press Ctrl+F: the search box takes the cursor.
5. **Rules change hand-set rows (F45).** Set one transaction's category
   by hand. Make a rule that matches it with a different category. The
   editor lists it under "This rule will also change..."; save; the row
   moves. Then sync: a category you set by hand afterwards stays.
6. **Categories.** New Fuel, Parking, Bars, Vacation, Impulsive buying
   are there. Extras carry a small "EXTRA" badge; the editor has an
   Essential / Extra switch.
7. **Sync.** Sync a bank. While it runs, the button shows the bank, the
   stage and a ticking clock; the panel says to keep the bank window
   open. Stops on done or cancel.
8. **Rules drag.** On a long rules list, drag a rule to the bottom edge:
   the page scrolls.

## 4. Profiles (spec 19)

Run `npm run dev`.

1. The sidebar's bottom card shows "Me". Your data is all there.
2. Settings, Profiles: Add a profile ("Test"). Switch to it from the
   sidebar card: the window reloads, everything is empty. Switch back to
   Me: all your data is back.
3. Add the Demo profile and switch to it: made-up months of data, Sync
   greyed out everywhere. "Reset demo data" brings it back fresh.
4. Rename "Test", then delete it (type its name to confirm). Delete is
   not offered for the profile that is open.

## 5. Wave 8 (specs 20, 21, 22)

Run `npm run dev`. Try the Demo profile first, then your own.

1. **Left this month.** Top of Home: "₪X left for N days: about ₪Y a
   day", with income, spent and moved to savings underneath. The hero's
   "Left so far" and the Transactions bar show the same left (savings
   subtracted). Does that match how you think about "left"?
2. **Essentials vs extras.** Switch All / Essentials / Extras above the
   headline: the headline, curves, donut and bars change; income and the
   money flow do not. Under All, the month bars split into essential,
   extra and neither; "By category" switches back.
3. **Hover.** Hover a bar segment or a legend name: that category lights
   up in every month, the rest fade. Click it: the filter applies.
4. **Select all.** On Transactions, tick the box above the list, then a
   day's box. Select two rows: both boxes show "partly".
5. **Notes.** Add a note from the row's note icon, and another from the
   right-click menu. Search for a word from the note. Clear it.
6. **Cash.** Add cash (top right of the list): money out ₪20 at a cafe,
   then money in ₪100 from family. Edit one, trash it, restore it.
   Money accounts shows the Cash wallet.
7. **ATM.** With real data: after you add any cash row, your ATM
   withdrawals from that month on read "Moved to cash wallet" and leave
   Spent. If one does not, tell the lead its wording (no amounts).
   "Count it as spending" puts it back.
8. **Find.** Ctrl+F on Categories (try a shop name), on Rules (try a
   category name). While searching Rules, dragging is off.
9. **Rule order.** Rules are numbered, "Checked from the top" above
   them; a rule overlapping a higher one says "Also fits N transactions
   that rule X decides". Drag one: a toast says where it went.

## 6. Wave 9 (specs 23, 24)

Restart `npm run dev` first.

1. **Sync range.** Settings, "How far back to sync": switch to "From a
   date", pick a day; the Sync panel shows "Downloads from <day>" under
   each bank. Switch back to "As far as each bank allows".
2. **Balance.** Sync Discount twice (a few hours or a day apart). Money
   accounts shows the balance and, after the second sync, "Adds up" or
   "Doesn't add up". A gap you cannot explain: tell the lead.
3. **Delete, on a test profile only.** Add a profile "Test", switch to
   it, add a cash row. Settings, Danger zone, "Delete this profile's
   data": type DELETE. The row is gone, the profile stays. Do not try
   "Delete everything" on real data unless you mean it; try it in a
   throwaway data folder: `COINLEAK_DATA_DIR=$HOME/coinleak-test npm run dev`.

## 7. Windows 11 VM test (PUBLISH-CHECKLIST section 3)

Run on 2026-11-16 by the owner in a clean Windows 11 VM (quickemu, user-mode
network, no Chrome installed). Installer built on Linux from `dev` at
6d09775 with `npm run dist:win`, version 0.0.1 (SHA-256 `e480a2a7...6d47`),
plus a 0.0.2 build of the same code for the upgrade test (version bump not
committed). Downloaded in Edge from a local web server at
`http://10.0.2.2:8765/`. Fuses and `app.asar` contents checked as in
`docs/RELEASE.md` before the run: all as required.

| Test | Result |
| --- | --- |
| SmartScreen "Windows protected your PC" | **Not shown, inconclusive.** Edge warned on the download (Keep worked), but Windows did not show its blue box. Most likely because `10.0.2.2` is a private address, so Windows treats the file as local network, not internet. Retest from a draft GitHub Release. |
| Installs with no admin prompt; shortcuts with icon | Pass. Desktop and Start menu shortcuts, CoinLeak icon. |
| App opens; window and taskbar icon | Pass. |
| Hebrew text and right-to-left, local fonts | Pass (Demo profile: Hebrew shop names, amounts left to right, app fonts, charts). |
| Data folder at `%APPDATA%\CoinLeak\data` | Pass. The folder is named `coinleak` in lowercase (Electron takes it from `name` in `package.json`); Windows ignores case, so the documented path works. |
| Sync finds Edge on its own, bank login opens | Pass. Discount login page opened in Edge; closing it showed "cancelled". No real login. |
| Close and reopen: data kept | Pass (a new category survived; reopened on the same profile). |
| Install 0.0.2 over 0.0.1: data kept | Pass. No admin prompt, data and Demo profile kept, Installed apps shows one CoinLeak at 0.0.2. |
| Uninstall from Settings, Apps: app gone, data stays | Pass. Reinstalling brought the data back. |
| Delete everything (F52) empties the folder | Pass. Demo file and the test category gone; only a fresh empty `coinleak.db` and `profiles.json` remain. |
| Second Windows user sees no data | Skipped by the owner (optional). |

Found along the way:

- **Cannot add cash on a fresh profile.** With no transactions yet,
  Transactions shows "Nothing here yet" in place of the list, so the
  "Add cash" button is hidden. Not Windows-specific. Needs a fix.
- `npm run dist:win` failed once with "wine process failed" and passed
  when run again.
- Building in a worktree whose `node_modules` is a symlink (as AGENTS.md
  suggests for workers) gives an `app.asar` missing about 5,000 files of
  nested dependencies. Build releases from the main checkout, or from a
  worktree with a real copy of `node_modules`.
- The VM keyboard stopped reaching Windows once (VM window issue, not
  CoinLeak).

## 8. Before 0.1.0: waves 10 to 12 and the code review fixes

Restart `npm run dev` first. Do each item on the Demo profile first (it
has budgets already), then on your own profile.

1. **Saved or overspent (F62).** Home has a card "Saved or overspent":
   one bar per month, green above zero, red below. Hover a bar: income,
   spending, and any money "moved to savings (not counted)". The current
   month says "so far". Click a bar: Transactions opens on that month.
   On your own profile, pick a month you remember: is the number about
   right?
2. **Average month (F63).** On the month-by-month bars, a line marked
   "Avg ₪X"; hover it for "Average of N full months". On the line charts,
   "Compare with" switches between "Last month" and "Average month".
   Switch to Routine, or untick a category: the average changes too.
3. **Budgets (F59).** Categories page: give a spending category a
   monthly budget of "1500". It shows "≈ ₪375 a week". Home's Budgets
   card shows a bar for it; switch "This month" and "This week". A
   category over budget says "₪X over". Click a bar: its transactions
   open.
4. **Amounts with agorot.** Add cash of "12.5": it shows ₪12.50. Set a
   budget of "99.9". Make a rule with amount "58.90", save it, reopen it:
   still 58.90.
5. **Transactions page.** Click a row, then shift-click another: every
   row between is selected. Open a row's "…" menu and try each entry.
   Change a row's category by hand: "Always put X in Y?" appears with
   "Yes, always" and "Make a rule".
6. **New day, optional.** Leave the app open overnight. Next morning,
   without restarting, Home is on the new day and "Last 7 days" on
   Transactions includes today.

Nothing to test for the other two fixes. The startup fix (a broken data
file shows an error, not an invisible app) was tested by the lead; the
chart helper change was checked with screenshots and looks identical.
