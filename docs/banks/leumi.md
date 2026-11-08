# Bank Leumi (`leumi`)

Status: **experimental**. Self-login is built from the library's own code
and tested against fake pages; nobody has confirmed it with a real account
yet. How CoinLeak syncs Bank Leumi with israeli-bank-scrapers 6.12.2 and self-login.

## Classification

`self-login-custom`. `LeumiScraper` is browser-based (`lib/scrapers/leumi/leumi.js`
L229) with `getLoginOptions()` (L230-239) and a success URL (L28-30). Its
`loginUrl` is the marketing site (L20); the library's own `checkReadiness`
then opens the real login form at `https://hb2.bankleumi.co.il/authenticate/logon`
(L216-225). Self-login opens that form directly (`LEUMI_LOGON_URL` in
`src/main/sync/self-login.ts`). The download drives the logged-in page:
it opens the transactions page, clicks "advanced search" and fills the
start date (L112-147), then reads savings and foreign-currency accounts
(L148-178, `leumi-forex.js`). Do not touch the window while it does.

## Login

- Login page: `https://hb2.bankleumi.co.il/authenticate/logon` (it shows the form at
  `/staticcontent/gate-keeper/he/`).
- You type your username, password and any SMS code into that page yourself. CoinLeak never fills or
  reads the form.
- Logged in means the tab's URL matches the library's success result,
  `/ebanking\/SO\/SPA.aspx/i` (leumi.js L30):
  - `https://hb2.bankleumi.co.il/eBanking/SO/SPA.aspx#/...`
- If the site shows something else after login (messages, a "change your
  password" page), finish it in the window and go to your account's home
  page. The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `bankleumi.co.il` | Online banking: login form and logged-in site (`hb2.`), static files (`cache.`, `widget.`, `highway.`, `sa.`, `appdynlib.`), and the APIs the download calls from inside the page. |
| `leumi.co.il` | Leumi's main site, the library's `loginUrl` (leumi.js L20), in case the bank links back to it. |

Checked on 2026-11-08 by loading the login page headless with no credentials and
nothing typed, once freely and once with only this allowlist: with the
allowlist on, the library's own login fields (`input[placeholder="שם משתמש"]`, `input[placeholder="סיסמה"]`, `button[type=submit]`) still appeared.
Hosts the page requested: `hb2.`, `cache.`, `widget.`, `highway.`, `sa.` and `appdynlib.bankleumi.co.il`.

Third-party hosts on the login page, **blocked on purpose**:

| Host | What it is |
|------|------------|
| `bankleumi.prod.fire.glass` | A Symantec Fire Glass diagnostics script. The form loads without it; if logins fail, it is the first candidate to look at. |

The logged-in site was not visited (that needs a real login). If it needs
another host, the try script lists it under "Blocked hosts" and it can be
added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. The download runs inside the logged-in page (page navigation, `page.waitForResponse` and
`fetchGetWithinPage`, leumi.js L112-178 and leumi-forex.js), so every
request goes through the browser and its allowlist.

## History

The library fetches at most three years back plus one day (leumi.js
L241-244). Today's rows come back as pending (L132-137).

## Owner test

1. `npm run sync:try -- leumi`
2. Log in yourself in the window that opens, including any SMS code.
3. Expect `Done in ...s.` with plausible counts per account and date range.
   If it fails, send the error code and the "Blocked hosts" lines (no bank
   data is printed).
