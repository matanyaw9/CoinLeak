# Isracard (`isracard`)

Status: **experimental**. Self-login is built from the library's own code
and tested against fake pages; nobody has confirmed it with a real account
yet. How CoinLeak syncs Isracard with israeli-bank-scrapers 6.12.2 and self-login.

## Classification

`self-login-custom`. `IsracardScraper` (`lib/scrapers/isracard.js` L9-15) is the
browser-based Isracard/Amex scraper (`base-isracard-amex.js` L323). Its
`login()` has no login page plan: it posts your ID, card digits and
password to the site's API from inside the page (L331-409, the password
at L366-375). Self-login replaces it: you log in on the page that
`login()` opens (`/personalarea/Login`, L343), and any personal-area page
after it counts as logged in. The download needs no token: it calls the
site's API with the page's session cookies (`fetchGetWithinPage`, L99-121,
L182-222) and reads the card list page (L223-238).

## Login

- Login page: `https://digital.isracard.co.il/personalarea/Login`.
- You type your ID, the card's last 6 digits and password, or an SMS code into that page yourself. CoinLeak never fills or
  reads the form.
- Logged in means the tab reaches a personal-area page that is not the login
  page (our own condition, `isracardAmexPlan` in `src/main/sync/self-login.ts`):
  - `/^https:\/\/digital\.isracard\.co\.il\/personalarea\/(?!login)/i`
- If the site shows something else after login (messages, a "change your
  password" page), finish it in the window and go to your account's home
  page. The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `isracard.co.il` | Login page, personal area and the `ProxyRequestHandler.ashx` API the download calls from inside the page (`digital.`). |

Third-party services allowed on purpose, exact host and path only:

| URL prefix | Why |
|-----|-----|
| ``https://www.google.com/recaptcha/`` | Google reCAPTCHA, which the login page loads (`bundles/recaptchaV3`). Only these paths: Google's ads and analytics paths on the same host stay blocked. |
| ``https://www.gstatic.com/recaptcha/`` | reCAPTCHA's own scripts and styles. |

Checked on 2026-11-08 by loading the login page headless with no credentials and
nothing typed, once freely and once with only this allowlist: with the
allowlist on, the library's own login fields (the password field) still appeared.
Hosts the page requested: `digital.isracard.co.il`, plus reCAPTCHA under `www.google.com/recaptcha/` and `www.gstatic.com/recaptcha/`.

Third-party hosts on the login page, **blocked on purpose**:

| Host | What it is |
|------|------------|
| `detector-dom.min.js` on `digital.isracard.co.il` | An automation detector. The library's own login aborts it too (base-isracard-amex.js L335-337), so CoinLeak blocks this path even on Isracard's host. |
| `isracard-qp-test-log-handling.azurewebsites.net`, `isracard-qp-test-logs-...z01.azurefd.net` | Logging endpoints |
| `www.googletagmanager.com`, `analytics.google.com`, `www.googleoptimize.com`, `adservice.google.com`, `ad.doubleclick.net`, `stats.g.doubleclick.net`, other `www.google.com` paths | Google tags, analytics and ads |
| `connect.facebook.net`, `www.facebook.com`, `api.instagram.com` | Facebook and Instagram pixels |
| `analytics.tiktok.com`, `ct.pinterest.com`, `s.pinimg.com`, `secure.adnxs.com` | Other ad pixels |
| `amplify.outbrain.com`, `tr.outbrain.com`, `wave.outbrain.com` | Outbrain ads |
| `cdn.userway.org`, `api.userway.org` | Accessibility widget |
| `static.cloudflareinsights.com` | Cloudflare analytics |
| `fonts.gstatic.com` | Web font; the page falls back to a system font |

The logged-in site was not visited (that needs a real login). If it needs
another host, the try script lists it under "Blocked hosts" and it can be
added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. The download runs inside the logged-in page (`fetchGetWithinPage` to
`digital.isracard.co.il/services/ProxyRequestHandler.ashx` and `page.goto`
for the card list, base-isracard-amex.js L99-238), so every
request goes through the browser and its allowlist.

## History

The library fetches at most one year back (base-isracard-amex.js
L411-413) plus one month ahead, two requests per month with a 2.5 to 3
second pause between them (L22-26, L103, L187). A sync takes about a
minute. Each card is one account; its number is the last 4 digits.

## Owner test

1. `npm run sync:try -- isracard`
2. Log in yourself in the window that opens, including any SMS code.
3. Expect `Done in ...s.` with plausible counts per account and date range.
   If it fails, send the error code and the "Blocked hosts" lines (no bank
   data is printed).
4. This is the provider with our own success condition: if the sync
   stays on "waiting for login" after you are in, note the address bar's
   path (without query) and report it.
