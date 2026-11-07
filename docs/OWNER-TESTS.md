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
