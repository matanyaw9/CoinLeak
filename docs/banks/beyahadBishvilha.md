# Beyahad Bishvilha (`beyahadBishvilha`)

Status: **experimental**. Self-login is built from the library's own code
and tested against fake pages; nobody has confirmed it with a real account
yet. How CoinLeak syncs Beyahad Bishvilha with israeli-bank-scrapers 6.12.2 and self-login.

## Classification

`self-login`. `BeyahadBishvilhaScraper` is browser-based
(`lib/scrapers/beyahad-bishvilha.js` L123) with `getLoginOptions()`
(L130-142) and a success URL (L18, L106-113). Its download opens the
card page and reads it (L67-105).

## Login

- Login page: `https://www.hist.org.il/login`.
- You type your ID and password into that page yourself. CoinLeak never fills or
  reads the form.
- Logged in means the tab reaches the library's success URL (L18), full URL,
  case-insensitive:
  - `https://www.hist.org.il/`
- If the site shows something else after login (messages, a "change your
  password" page), finish it in the window and go to your account's home
  page. The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `hist.org.il` | The Histadrut site: login page, card page (`www.`). |

Not checked: the research sandbox's network policy did not allow
`www.hist.org.il` on 2026-11-08. The allowlist is the site's own domain only.
If the login page needs another host, the try script lists it under
"Blocked hosts".

No third-party host was requested by the login page.

The logged-in site was not visited (that needs a real login). If it needs
another host, the try script lists it under "Blocked hosts" and it can be
added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. The download runs inside the logged-in page (it reads the card page, beyahad-bishvilha.js L67-105), so every
request goes through the browser and its allowlist.

## History

The library keeps at most one year back (beyahad-bishvilha.js L70-72),
from what the card page shows.

## Owner test

1. `npm run sync:try -- beyahadBishvilha`
2. Log in yourself in the window that opens, including any SMS code.
3. Expect `Done in ...s.` with plausible counts per account and date range.
   If it fails, send the error code and the "Blocked hosts" lines (no bank
   data is printed).
4. The library's success URL is the site's home page. If the home page
   opens before you log in, the sync may start too early and fail with
   `BANK_ERROR`; just run it again after logging in.
