# Cal cards (`visaCal`)

How CoinLeak syncs Cal (Visa Cal) with israeli-bank-scrapers 6.12.2 and
self-login.

## Login

- Login page: `https://www.cal-online.co.il/` (from the library's
  `getLoginOptions()`). Click the login button; the form opens in a frame
  served by `connect.cal-online.co.il`. You fill it yourself, including any
  SMS code. CoinLeak never fills or reads the form.
- Logged in means the tab's URL matches the library's success result,
  `/dashboard/i` (the logged-in site is `digital-web.cal-online.co.il`).
- If Cal shows a tutorial or "change password" screen after login, close or
  finish it and go to the dashboard. The sync waits up to 5 minutes.
- Self-login sets the same user agent the library's own login sets (a fixed
  desktop Chrome string), so the session matches the library's API calls.

## Auth token (the open question from REQUIREMENTS.md)

The library's download needs Cal's auth token. Its own login gets it in two
ways, and self-login keeps both:

1. **SSO request header.** While you log in, the login frame sends
   `POST https://connect.cal-online.co.il/col-rest/calconnect/authentication/SSO`.
   The library's `postAction` reads that request's `Authorization` header.
   Self-login listens for the same request on the tab and hands the header
   to the library the same way (`authorization` field, see
   `src/main/sync/self-login.ts`). Only the header is read, never the body.
2. **sessionStorage fallback.** If no header was captured, the library's
   `getAuthorizationHeader()` waits up to 10 seconds for `auth-module` in
   the dashboard's sessionStorage and uses `auth.calConnectToken`.

Both paths are covered by tests that run the real library classes against a
fake page (`self-login.test.ts`). Whether the live site still behaves this
way can only be confirmed by a real login (owner test).

## Allowlist

| Suffix | Why |
|--------|-----|
| `cal-online.co.il` | Cal's site, login frame (`connect.`), logged-in site (`digital-web.`), static files (`css.`), accessibility widget (`accessability.`), and API (`api.`). |

Hosts seen while opening the login form on 2026-11-07 (no credentials,
nothing typed), all allowed: `www.cal-online.co.il`,
`connect.cal-online.co.il`, `css.cal-online.co.il`,
`accessability.cal-online.co.il`.

Third-party hosts, **blocked on purpose** (ads, analytics, tracking). The
login form, its password tab and its fields still load with them blocked:

| Host | What it is |
|------|------------|
| `www.googletagmanager.com` | Google Tag Manager |
| `www.google-analytics.com`, `analytics.google.com` | Google Analytics |
| `ad.doubleclick.net`, `googleads.g.doubleclick.net`, `stats.g.doubleclick.net` | Google ads |
| `www.google.com`, `www.google.co.il` | Google ad conversion pixels (`/pagead`, `/rmkt`, `/ccm`) |
| `connect.facebook.net`, `www.facebook.com` | Facebook pixel |
| `chrome-extension://invalid` | A script probing for extensions |

No captcha host is used by the login form. With the allowlist on, most of
these are never even requested, because Tag Manager loads them; the try
script cancelled at the login page reported only
`www.googletagmanager.com`, `www.google-analytics.com` and `invalid`.

## Requests from Node (outside the browser)

The library downloads Cal data with Node's `fetch`, not inside the page, so
the browser allowlist cannot cover these. They carry the auth token and a
fixed user agent header:

- `https://api.cal-online.co.il/Frames/api/Frames/GetFrameStatus`
- `https://api.cal-online.co.il/Transactions/api/approvals/getClearanceRequests`
- `https://api.cal-online.co.il/Transactions/api/transactionsDetails/getCardTransactionsDetails`
  (one call per month)

No other Node-side host. Card list and token come from the page's
sessionStorage.

## History

The library fetches at most 18 months back plus one month ahead (it clamps
any earlier start date). Each card is one account; its number is the last
4 digits.
