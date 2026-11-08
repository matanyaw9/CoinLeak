# Bank Yahav (`yahav`)

Status: **experimental**. Self-login is built from the library's own code
and tested against fake pages; nobody has confirmed it with a real account
yet. How CoinLeak syncs Bank Yahav with israeli-bank-scrapers 6.12.2 and self-login.

## Classification

`self-login`. `YahavScraper` is browser-based (`lib/scrapers/yahav.js` L217)
with `getLoginOptions()` (L218-236) and a success URL (L30-33). Its
download first waits for the account details on the home page (L238),
then reads the statements pages (L173-192).

## Login

- Login page: `https://login.yahav.co.il/login/`.
- You type your username, ID number and password into that page yourself. CoinLeak never fills or
  reads the form.
- Logged in means the tab reaches the library's success URL (yahav.js L19, L33),
  full URL, case-insensitive:
  - `https://digital.yahav.co.il/BaNCSDigitalUI/app/index.html#/main/home`
- If the site shows something else after login (messages, a "change your
  password" page), finish it in the window and go to your account's home
  page. The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `yahav.co.il` | Login page (`login.`) and the logged-in site (`digital.`). |

Checked on 2026-11-08 by loading the login page headless with no credentials and
nothing typed, once freely and once with only this allowlist: with the
allowlist on, the library's own login fields (`#username`, `#password`, `#pinno`, `.btn`) still appeared.
Hosts the page requested: `login.yahav.co.il` only.

No third-party host was requested by the login page.

The logged-in site was not visited (that needs a real login). If it needs
another host, the try script lists it under "Blocked hosts" and it can be
added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. The download runs inside the logged-in page (it reads the bank's own pages, yahav.js L140-247), so every
request goes through the browser and its allowlist.

## History

The library fetches only three months back plus one day (yahav.js
L239-241). Older rows already saved stay.

## Owner test

1. `npm run sync:try -- yahav`
2. Log in yourself in the window that opens, including any SMS code.
3. Expect `Done in ...s.` with plausible counts per account and date range.
   If it fails, send the error code and the "Blocked hosts" lines (no bank
   data is printed).
