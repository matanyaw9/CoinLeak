# Behatsdaa (`behatsdaa`)

Status: **experimental**. Self-login is built from the library's own code
and tested against fake pages; nobody has confirmed it with a real account
yet. How CoinLeak syncs Behatsdaa with israeli-bank-scrapers 6.12.2 and self-login.

## Classification

`self-login-custom`. `BehatsdaaScraper` is browser-based
(`lib/scrapers/behatsdaa.js` L41) with `getLoginOptions()` (L42-71). Its
success URL is the site's public home page (L55-58), and the download
needs the token the login leaves in `localStorage.userToken` (L73), so
self-login also waits for that token to exist. Only its presence is
checked; CoinLeak never reads the value (the library does, in the page).
The library's own form selectors (`#loginId`, `#loginPassword`, L46-49)
no longer exist on the site, which now asks for an ID and a one-time
code: the library's own login would fail, self-login does not care.

## Login

- Login page: `https://www.behatsdaa.org.il/login`.
- You type your ID and the one-time code the site sends you into that page yourself. CoinLeak never fills or
  reads the form.
- Logged in means the tab reaches the library's success URL and the login token
  exists:
  - `https://www.behatsdaa.org.il/` (L56), and
  - `localStorage.userToken` set (L73).
- If the site shows something else after login (messages, a "change your
  password" page), finish it in the window and go to your account's home
  page. The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `behatsdaa.org.il` | The site (`www.`) and the purchases API the download calls from inside the page (`back.`, L18, L87). |

Third-party services allowed on purpose, exact host and path only:

| URL prefix | Why |
|-----|-----|
| ``https://www.google.com/recaptcha/`` | Google reCAPTCHA, which the login page loads. Only these paths. |
| ``https://www.gstatic.com/recaptcha/`` | reCAPTCHA's own scripts and styles. |

Checked on 2026-11-08 with nothing typed: with only this allowlist the ID
field (`input[type=tel]`, "9 digit ID") and the "send me a one-time code"
button appeared. Hosts the page requested: `www.` and
`back.behatsdaa.org.il`, plus reCAPTCHA.

Third-party hosts on the login page, **blocked on purpose**:

| Host | What it is |
|------|------------|
| `code.jquery.com`, `cdnjs.cloudflare.com`, `use.fontawesome.com`, `fonts.googleapis.com`, `fonts.gstatic.com` | Public script, icon and font CDNs. The login form appears without them; if it does not work, these are the first candidates. |
| `pics.k4a.co.il`, `dts.co.il` | Images and a script from other companies' sites |
| `cdn.glassix.com`, `cdn.glassix.net`, `functions.glassix.com` | Chat widget |
| `js.nagich.co.il` | Accessibility widget |
| `static.hotjar.com`, `script.hotjar.com` | Hotjar session recording |
| `www.googletagmanager.com`, `analytics.google.com`, `pagead2.googlesyndication.com`, doubleclick hosts, `ep1.adtrafficquality.google`, other `www.google.com` paths | Google tags, analytics and ads |
| `connect.facebook.net`, `www.facebook.com`, `app.adoric-om.com`, `static.adoric.com`, `www.pulseem.co.il` | Other marketing pixels |

The logged-in site was not visited (that needs a real login). If it needs
another host, the try script lists it under "Blocked hosts" and it can be
added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. The download runs inside the logged-in page (`fetchPostWithinPage` to
`back.behatsdaa.org.il/api/purchases/purchaseHistory`, behatsdaa.js L72-115), so every
request goes through the browser and its allowlist.

## History

The library has no limit: it sends the start date as given (behatsdaa.js
L82). CoinLeak asks for one year back plus one day. Every row is a
completed purchase.

Note: purchases here are often paid with a credit card. If you also sync
that card, the same purchase shows on both; exclude one of them.

## Owner test

1. `npm run sync:try -- behatsdaa`
2. Log in yourself in the window that opens, including any SMS code.
3. Expect `Done in ...s.` with plausible counts per account and date range.
   If it fails, send the error code and the "Blocked hosts" lines (no bank
   data is printed).
