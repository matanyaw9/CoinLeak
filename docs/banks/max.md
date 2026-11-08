# Max (`max`)

Status: **experimental**. Self-login is built from the library's own code
and tested against fake pages; nobody has confirmed it with a real account
yet. How CoinLeak syncs Max with israeli-bank-scrapers 6.12.2 and self-login.

## Classification

`self-login`. `MaxScraper` is browser-based (`lib/scrapers/max.js` L290) with
`getLoginOptions()` (L291-321) and a success URL (L26, L269-271). Its
download runs in the logged-in page (`fetchGetWithinPage`, L75-105 and
L208-223). The library's own login clicks through to the password tab
(`preAction`, L296-313); with self-login you choose how to log in.

## Login

- Login page: `https://www.max.co.il/login`.
- You type your username and password, or an SMS code, as Max offers into that page yourself. CoinLeak never fills or
  reads the form.
- Logged in means the tab reaches the library's success URL (max.js L26),
  full URL, case-insensitive:
  - `https://www.max.co.il/homepage/personal`
- If the site shows something else after login (messages, a "change your
  password" page), finish it in the window and go to your account's home
  page. The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `max.co.il` | Login page and logged-in site (`www.`), the API the download calls from inside the page (`onlinelcapi.`), and the site's own helpers (`ct.`, `gb.`, `salmonf.`). |

Checked on 2026-11-08 by loading the login page headless with no credentials and
nothing typed, once freely and once with only this allowlist: with the
allowlist on, the library's own login fields (`.personal-area > a.go-to-personal-area`, `#user-name`, `#password`, `#login-password-link`) still appeared.
Hosts the page requested: `www.`, `ct.`, `gb.` and `salmonf.max.co.il`.

Third-party hosts on the login page, **blocked on purpose**:

| Host | What it is |
|------|------------|
| `www.googletagmanager.com`, `www.google-analytics.com`, `analytics.google.com` | Google Tag Manager and Analytics |
| `ad.doubleclick.net`, `googleads.g.doubleclick.net`, `stats.g.doubleclick.net`, `cm.g.doubleclick.net`, `www.google.com`, `www.google.co.il` | Google ads and conversion pixels |
| `connect.facebook.net`, `www.facebook.com` | Facebook pixel |
| `cdn.taboola.com` and other `taboola.com` hosts | Taboola ads |
| `amplify.outbrain.com`, `tr.outbrain.com`, `wave.outbrain.com` | Outbrain ads |
| `analytics.tiktok.com` | TikTok pixel |
| `dev.visualwebsiteoptimizer.com` | A/B testing |

The logged-in site was not visited (that needs a real login). If it needs
another host, the try script lists it under "Blocked hosts" and it can be
added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. The download runs inside the logged-in page (`fetchGetWithinPage` to `www.max.co.il/api/...` and
`onlinelcapi.max.co.il/api/...`, max.js L75-105 and L208-223), so every
request goes through the browser and its allowlist.

## History

The library fetches up to four years back (max.js L247-250) plus one
month ahead, one request per month. A first sync can take a minute or two.
Pending rows are the ones without a payment date (L183-185).

## Owner test

1. `npm run sync:try -- max`
2. Log in yourself in the window that opens, including any SMS code.
3. Expect `Done in ...s.` with plausible counts per account and date range.
   If it fails, send the error code and the "Blocked hosts" lines (no bank
   data is printed).
