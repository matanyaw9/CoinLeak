# American Express (`amex`)

Status: **experimental**. Self-login is built from the library's own code
and tested against fake pages; nobody has confirmed it with a real account
yet. How CoinLeak syncs American Express with israeli-bank-scrapers 6.12.2 and self-login.

## Classification

`self-login-custom`. `AmexScraper` (`lib/scrapers/amex.js` L9-15) is the same
Isracard/Amex scraper with Amex's site (`base-isracard-amex.js` L323);
see `isracard.md`. Its `login()` posts the password from inside the page
(L366-375), so self-login replaces it the same way.

## Login

- Login page: `https://he.americanexpress.co.il/personalarea/Login`.
- You type your ID, the card's last 6 digits and password, or an SMS code into that page yourself. CoinLeak never fills or
  reads the form.
- Logged in means the tab reaches a personal-area page that is not the login
  page (our own condition, `isracardAmexPlan` in `src/main/sync/self-login.ts`):
  - `/^https:\/\/he\.americanexpress\.co\.il\/personalarea\/(?!login)/i`
- If the site shows something else after login (messages, a "change your
  password" page), finish it in the window and go to your account's home
  page. The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `americanexpress.co.il` | Login page, personal area and the `ProxyRequestHandler.ashx` API the download calls from inside the page (`he.`). |

Third-party services allowed on purpose, exact host and path only:

| URL prefix | Why |
|-----|-----|
| ``https://www.google.com/recaptcha/`` | Google reCAPTCHA, which the login page loads. Only these paths. |
| ``https://www.gstatic.com/recaptcha/`` | reCAPTCHA's own scripts and styles. |

Checked on 2026-11-08 by loading the login page headless with no credentials and
nothing typed, once freely and once with only this allowlist: with the
allowlist on, the library's own login fields (the password field) still appeared.
Hosts the page requested: `he.americanexpress.co.il`, reCAPTCHA, and two requests to `digital.isracard.co.il` (below).

Third-party hosts on the login page, **blocked on purpose**:

| Host | What it is |
|------|------------|
| `digital.isracard.co.il` | Only an automation detector (`detector-dom.min.js`, which the library aborts too, base-isracard-amex.js L335-337) and Glassbox session-recording reports. Not allowed for Amex. |
| `isracard-qp-test-log-handling.azurewebsites.net`, `...z01.azurefd.net`, `mpc2-prod-...run.app` | Logging endpoints |
| `www.googletagmanager.com`, `analytics.google.com`, `adservice.google.com`, doubleclick hosts, other `www.google.com` paths | Google tags, analytics and ads |
| `connect.facebook.net`, `www.facebook.com`, `api.instagram.com` | Facebook and Instagram pixels |
| `bat.bing.com`, `c.bing.com`, `c.clarity.ms`, `q.clarity.ms`, `scripts.clarity.ms` | Microsoft ads and Clarity session recording |
| `s1749017430.t.eloqua.com`, `img.en25.com` | Oracle Eloqua marketing |
| `analytics.tiktok.com`, `secure.adnxs.com`, outbrain hosts | Other ad pixels |
| `cdn.userway.org`, `api.userway.org` | Accessibility widget |
| `fonts.gstatic.com` | Web font |

The logged-in site was not visited (that needs a real login). If it needs
another host, the try script lists it under "Blocked hosts" and it can be
added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. The download runs inside the logged-in page (`fetchGetWithinPage` to
`he.americanexpress.co.il/services/ProxyRequestHandler.ashx`, base-isracard-amex.js L99-238), so every
request goes through the browser and its allowlist.

## History

As Isracard: at most one year back (base-isracard-amex.js L411-413),
with pauses between requests. Each card is one account; its number is the
last 4 digits.

## Owner test

1. `npm run sync:try -- amex`
2. Log in yourself in the window that opens, including any SMS code.
3. Expect `Done in ...s.` with plausible counts per account and date range.
   If it fails, send the error code and the "Blocked hosts" lines (no bank
   data is printed).
4. As with Isracard, if the sync stays on "waiting for login" after you
   are in, report the address bar's path (without query).
