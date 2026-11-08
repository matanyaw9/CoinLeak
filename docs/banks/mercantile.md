# Mercantile Bank (`mercantile`)

Status: **experimental**. Self-login is built from the library's own code
and tested against fake pages; nobody has confirmed it with a real account
yet. How CoinLeak syncs Mercantile Bank with israeli-bank-scrapers 6.12.2 and self-login.

## Classification

`self-login`. `MercantileScraper` is Discount's scraper with its own
login page (`lib/scrapers/mercantile.js` L9-16). Login, success URLs and
download are Discount's (`discount.js` L89-121); see `discount.md`.

## Login

- Login page: `https://start.telebank.co.il/login/?bank=m`.
- You type your ID, password and code into that page yourself. CoinLeak never fills or
  reads the form.
- Logged in means the tab reaches one of Discount's success URLs (discount.js
  L91), compared as full URLs, case-insensitive:
  - `https://start.telebank.co.il/apollo/retail/#/MY_ACCOUNT_HOMEPAGE`
  - `https://start.telebank.co.il/apollo/retail2/#/MY_ACCOUNT_HOMEPAGE`
  - `https://start.telebank.co.il/apollo/retail2/`
  - `https://start.telebank.co.il/apollo/retail3/#/MY_ACCOUNT_HOMEPAGE`
  - `https://start.telebank.co.il/apollo/retail3/`
- If the site shows something else after login (messages, a "change your
  password" page), finish it in the window and go to your account's home
  page. The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `telebank.co.il` | The Discount group's online banking, shared by Mercantile: login page, its scripts, and the `Titan/gatewayAPI` the download uses. |
| `mercantile.co.il` | Mercantile's main domain, in case the logged-in site loads from it. |

Checked on 2026-11-08 by loading the login page headless with no credentials and
nothing typed, once freely and once with only this allowlist: with the
allowlist on, the library's own login fields (`#tzId`, `#tzPassword`, `#aidnum`) still appeared.
Hosts the page requested: `start.`, `start.qp.`, `event.`, `news.`, `feed.`, `stats.` and `clsrep.telebank.co.il`.

Third-party hosts on the login page, **blocked on purpose**:

| Host | What it is |
|------|------------|
| `www.googletagmanager.com` | Google Tag Manager |
| `www.google-analytics.com` | Google Analytics |
| `awa-eucn1-1.advanced-web-analytics.com` | Analytics iframe (see `discount.md`) |

The logged-in site was not visited (that needs a real login). If it needs
another host, the try script lists it under "Blocked hosts" and it can be
added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. The download runs inside the logged-in page (`fetchGetWithinPage` to `start.telebank.co.il/Titan/gatewayAPI`,
discount.js L40-81), so every
request goes through the browser and its allowlist.

## History

As Discount: at most one year back plus two days (discount.js L51-53).
Pending rows come from `FutureTransactionsBlock`.

## Owner test

1. `npm run sync:try -- mercantile`
2. Log in yourself in the window that opens, including any SMS code.
3. Expect `Done in ...s.` with plausible counts per account and date range.
   If it fails, send the error code and the "Blocked hosts" lines (no bank
   data is printed).
