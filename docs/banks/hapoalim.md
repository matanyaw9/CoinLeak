# Bank Hapoalim (`hapoalim`)

Status: **experimental**. Self-login is built from the library's own code
and tested against fake pages; nobody has confirmed it with a real account
yet. How CoinLeak syncs Bank Hapoalim with israeli-bank-scrapers 6.12.2 and self-login.

## Classification

`self-login`. `HapoalimScraper` is browser-based (`lib/scrapers/hapoalim.js`
L180). Its `getLoginOptions()` (L184-192) gives the login page and the
success URLs (L164-170), and its download runs in the logged-in page
(`fetchAccountData`, L129-163). Nothing provider-specific is needed.

## Login

- Login page: `https://login.bankhapoalim.co.il/cgi-bin/poalwwwc?reqName=getLogonPage` (it redirects to
  `/ng-portals/auth/he/`).
- You type your user code, password and any SMS code into that page yourself. CoinLeak never fills or
  reads the form.
- Logged in means the tab reaches one of the library's success URLs
  (`possibleResults`), compared as full URLs, case-insensitive:
  - `https://login.bankhapoalim.co.il/portalserver/HomePage`
  - `https://login.bankhapoalim.co.il/ng-portals-bt/rb/he/homepage`
  - `https://login.bankhapoalim.co.il/ng-portals/rb/he/homepage`
- If the site shows something else after login (messages, a "change your
  password" page), finish it in the window and go to your account's home
  page. The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `bankhapoalim.co.il` | Login page (`login.`), its static files (`static2.`), the logged-in site and the `ServerServices` API the download calls from inside the page. |

Checked on 2026-11-08 by loading the login page headless with no credentials and
nothing typed, once freely and once with only this allowlist: with the
allowlist on, the library's own login fields (`#userCode`, `#password`, `.login-btn`) still appeared.
Hosts the page requested: `login.bankhapoalim.co.il`, `static2.bankhapoalim.co.il`.

No third-party host was requested by the login page.

The logged-in site was not visited (that needs a real login). If it needs
another host, the try script lists it under "Blocked hosts" and it can be
added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. The download runs inside the logged-in page (`fetchGetWithinPage` and `fetchPostWithinPage` to
`https://login.bankhapoalim.co.il/ServerServices/...`, hapoalim.js L77-150), so every
request goes through the browser and its allowlist.

## History

The library fetches at most one year back plus one day (hapoalim.js
L137-139). Pending rows are the ones with serial number 0 (L59).

## Owner test

1. `npm run sync:try -- hapoalim`
2. Log in yourself in the window that opens, including any SMS code.
3. Expect `Done in ...s.` with plausible counts per account and date range.
   If it fails, send the error code and the "Blocked hosts" lines (no bank
   data is printed).
