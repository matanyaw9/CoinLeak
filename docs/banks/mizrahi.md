# Mizrahi Tefahot (`mizrahi`)

Status: **experimental**. Self-login is built from the library's own code
and tested against fake pages; nobody has confirmed it with a real account
yet. How CoinLeak syncs Mizrahi Tefahot with israeli-bank-scrapers 6.12.2 and self-login.

## Classification

`self-login-custom`. `MizrahiScraper` is browser-based (`lib/scrapers/mizrahi.js`
L184) with `getLoginOptions()` (L185-194) and success results (L60-62).
The success URL can appear before the logged-in page is drawn, and the
download starts by clicking the account menu `#dropdownBasic` (L196).
The library's own login waits for that menu (`postLogin`, L181-183), so
self-login also waits for it before counting the login as done.

## Login

- Login page: `https://www.mizrahi-tefahot.co.il/login/index.html#/auth-page-he`.
- You type your user number, password and any SMS code into that page yourself. CoinLeak never fills or
  reads the form.
- Logged in means the tab's URL matches the library's success result and the
  account menu exists:
  - `/https:\/\/mto\.mizrahi-tefahot\.co\.il\/OnlineApp\/.*/` (L22), or the
    "checking account" tab on the page (L52-59), and
  - `#dropdownBasic` on the page (L36).
- If the site shows something else after login (messages, a "change your
  password" page), finish it in the window and go to your account's home
  page. The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `mizrahi-tefahot.co.il` | Login page (`www.`), the logged-in site (`mto.`), and the `SkyOSH` APIs the download calls from inside the page. |

Checked on 2026-11-08 by loading the login page headless with no credentials and
nothing typed, once freely and once with only this allowlist: with the
allowlist on, the library's own login fields (`#userNumberDesktopHeb`, `#passwordDesktopHeb`, `button.btn.btn-primary`) still appeared.
Hosts the page requested: `www.mizrahi-tefahot.co.il`.

Third-party hosts on the login page, **blocked on purpose**:

| Host | What it is |
|------|------------|
| `report.mizrahi.gbqofs.io` | Glassbox session recording. |

The logged-in site was not visited (that needs a real login). If it needs
another host, the try script lists it under "Blocked hosts" and it can be
added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. The download runs inside the logged-in page (clicks, `page.waitForRequest` and `fetchPostWithinPage`,
mizrahi.js L195-268), so every
request goes through the browser and its allowlist.

## History

The library fetches at most one year back (mizrahi.js L67-71) and drops
older rows the bank sends anyway (L258-260). Pending rows come from the
pending page (L219-228).

## Owner test

1. `npm run sync:try -- mizrahi`
2. Log in yourself in the window that opens, including any SMS code.
3. Expect `Done in ...s.` with plausible counts per account and date range.
   If it fails, send the error code and the "Blocked hosts" lines (no bank
   data is printed).
