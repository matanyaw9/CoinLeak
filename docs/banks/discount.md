# Discount Bank (`discount`)

How CoinLeak syncs Discount with israeli-bank-scrapers 6.12.2 and self-login.

## Login

- Login page: `https://start.telebank.co.il/login/#/LOGIN_PAGE` (from the
  library's `getLoginOptions()`).
- You type your ID, password and code into that page yourself. CoinLeak
  never fills or reads the form.
- Logged in means the tab reaches one of the library's success URLs
  (`possibleResults`), compared as full URLs, case-insensitive:
  - `https://start.telebank.co.il/apollo/retail/#/MY_ACCOUNT_HOMEPAGE`
  - `https://start.telebank.co.il/apollo/retail2/#/MY_ACCOUNT_HOMEPAGE`
  - `https://start.telebank.co.il/apollo/retail2/`
  - `https://start.telebank.co.il/apollo/retail3/#/MY_ACCOUNT_HOMEPAGE`
  - `https://start.telebank.co.il/apollo/retail3/`
- If the bank lands somewhere else after login (for example a "change your
  password" page), finish it in the window and go to the account home page.
  The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `telebank.co.il` | Discount's online banking: login page, its scripts, the `Titan/gatewayAPI` the download uses. |
| `discountbank.co.il` | Discount's main domain, in case the logged-in site loads from it. |

Hosts seen on the login page on 2026-11-07 (loaded without credentials,
nothing typed), all allowed by `telebank.co.il`:
`start.telebank.co.il`, `start.qp.telebank.co.il`, `event.telebank.co.il`,
`news.telebank.co.il`, `feed.telebank.co.il`, `stats.telebank.co.il`,
`clsrep.telebank.co.il`.

Third-party hosts on the login page, **blocked on purpose** (analytics and
tracking). The login form still loads with them blocked:

| Host | What it is |
|------|------------|
| `www.googletagmanager.com` | Google Tag Manager |
| `www.google-analytics.com` | Google Analytics |
| `awa-eucn1-1.advanced-web-analytics.com` | Analytics iframe |

No captcha or CDN host is needed for the login page. The try script
cancelled at the login page reported exactly the last two as blocked.
`advanced-web-analytics.com` might be a fraud-scoring script rather than
plain analytics; if the bank rejects logins from the sync browser, it is
the first candidate to allow. The logged-in site was
not visited (that needs a real login); if it needs another host, the try
script lists it under "Blocked hosts" and it can be added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. Discount's download (`fetchAccountData` in `lib/scrapers/discount.js`)
calls `fetchGetWithinPage`, which runs `fetch` inside the logged-in page:

- `https://start.telebank.co.il/Titan/gatewayAPI/userAccountsData`
- `https://start.telebank.co.il/Titan/gatewayAPI/lastTransactions/<account>/Date?...`

Both go through the browser and its allowlist.

## History

The library fetches at most one year back (it clamps any earlier start
date). Pending rows come from `FutureTransactionsBlock`.
