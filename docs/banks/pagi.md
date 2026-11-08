# Bank Pagi (`pagi`)

Status: **experimental**. Self-login is built from the library's own code
and tested against fake pages; nobody has confirmed it with a real account
yet. How CoinLeak syncs Bank Pagi with israeli-bank-scrapers 6.12.2 and self-login.

## Classification

`self-login`. `PagiScraper` (`lib/scrapers/pagi.js` L9-13) is the Beinleumi
group scraper with Pagi's addresses; see `beinleumi.md`
(`base-beinleumi-group.js` L399-430).

## Login

- Login page: `https://online.pagi.co.il//MatafLoginService/MatafLoginServlet?bankId=PAGIPORTAL&site=Private&KODSAFA=HE` (the double slash is the
  library's, pagi.js L10-11, and the bank accepts it).
- You type your username, password and any SMS code into that page yourself. CoinLeak never fills or
  reads the form.
- Logged in means the tab's URL matches one of the Beinleumi group's success
  results (base-beinleumi-group.js L42-46):
  - `/fibi.*accountSummary/`
  - `/Resources\/PortalNG\/shell/`
  - `/FibiMenu\/Online/`
- If the site shows something else after login (messages, a "change your
  password" page), finish it in the window and go to your account's home
  page. The sync waits up to 5 minutes.

## Allowlist

The sync browser may reach only these host suffixes (each covers the name
itself and every subdomain):

| Suffix | Why |
|--------|-----|
| `pagi.co.il` | Login page and the logged-in site (`online.`). |

Checked on 2026-11-08 by loading the login page headless with no credentials and
nothing typed, once freely and once with only this allowlist: with the
allowlist on, the library's own login fields (`#username`, `#password`, `#continueBtn`) still appeared.
Hosts the page requested: `online.pagi.co.il` only.

No third-party host was requested by the login page.

The logged-in site was not visited (that needs a real login). If it needs
another host, the try script lists it under "Blocked hosts" and it can be
added here with a reason.

If the bank tab itself navigates to a host outside the list, the sync stops
with `BLOCKED_REQUEST` instead of leaving you on a browser error page.

## Requests from Node (outside the browser)

None. The download runs inside the logged-in page (it reads the bank's own pages,
base-beinleumi-group.js L169-398), so every
request goes through the browser and its allowlist.

## History

No limit in the library (base-beinleumi-group.js L418-423). CoinLeak asks
for one year back plus one day, the library's own default.

## Owner test

1. `npm run sync:try -- pagi`
2. Log in yourself in the window that opens, including any SMS code.
3. Expect `Done in ...s.` with plausible counts per account and date range.
   If it fails, send the error code and the "Blocked hosts" lines (no bank
   data is printed).
