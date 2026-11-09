# Owner tests

Things only the owner can check, because they need a real bank login or a
human eye. Each takes a few minutes. Report results to the lead in the
chat; the printed summaries hold no private data and are safe to paste.

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

Run `npm run dev` (empty database) or build with demo data:
`VITE_DEMO=1 npm run preview`. Say what feels wrong, rough, or missing.
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
