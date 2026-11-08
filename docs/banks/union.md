# Union Bank (`union`)

Status: **unsupported**. CoinLeak does not sync Union Bank, and the app
says why under "Why isn't my bank here?".

## Classification

Login mechanism: `self-login` would fit. `UnionBankScraper` is browser-based
(`lib/scrapers/union-bank.js` L222) with `getLoginOptions()` (L223-231)
and a success URL (`/eBanking\/Accounts/`, L28-30), all on
`https://hb.unionbank.co.il` (L15).

Status: `unsupported`, because the site is gone.

## Why not

Union Bank is now part of Mizrahi Tefahot. On 2026-11-08 the name
`unionbank.co.il` did not resolve at all (DNS: "No Reachable Authority at
delegation unionbank.co.il" for `hb.`, `www.` and the bare domain), so
there is no login page to open. If your account moved to Mizrahi Tefahot,
choose Mizrahi Tefahot (`mizrahi.md`).

## What would change it

If the site comes back, enabling Union is small: status `experimental`
in `src/shared/providers.ts`, `union: ["unionbank.co.il"]` in the
allowlist, a plain entry in `PROVIDER_LOGIN` and one year plus one day
in `HISTORY` (union-bank.js L233-235).
