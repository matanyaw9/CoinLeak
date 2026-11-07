# 08 Every bank and card company (wave 3)

## Goal

The owner wants CoinLeak to work with all Israeli banks and card companies,
not only Discount and Cal. `israeli-bank-scrapers` (6.12.2) supports 18
providers: hapoalim, beinleumi, union, amex, isracard, visaCal, max,
otsarHahayal, discount, mercantile, mizrahi, leumi, massad, yahav,
behatsdaa, beyahadBishvilha, oneZero, pagi.

Make self-login generic, add a provider registry, enable every provider
where self-login can work, and say clearly which ones cannot and why. The
security rules do not change: the user types credentials only on the
bank's own page, nothing is stored, the browser runs over a pipe with a
per-provider allowlist and a throwaway profile.

Real-world status today: **Discount verified live** by the owner (login,
274 rows, one year). Cal login verified live; its download is unconfirmed.

## Owns

- `src/shared/providers.ts` (new): the registry
- `src/shared/types.ts`: widen `ProviderId` to the registry's ids
- `src/main/sync/**` and tests: generic self-login, per-provider allowlist,
  error mapping
- `src/core/ledger/ingest.ts` (`PROVIDER_KIND` comes from the registry),
  `src/core/ledger/card-patterns.ts` (company of each card provider) and
  their tests
- `src/main/sync-service.ts` (provider validation from the registry)
- `scripts/sync-try.ts` (accept any enabled provider)
- `docs/banks/<id>.md` for every provider
- Renderer, only: `pages/accounts-page.tsx`, `components/sync/**`,
  `components/common/welcome.tsx`, and new strings appended at the end of
  `strings.ts`. Another agent is working on the rules screen in the rest of
  the renderer; do not touch other renderer files except for the minimal
  type fixes a wider `ProviderId` forces (list them in your report).

## Build

1. **Research each provider** in `node_modules/israeli-bank-scrapers/lib/scrapers/`
   and classify it, with file and line evidence:
   - `self-login`: browser-based, the library's `login()` fills a form and
     `getLoginOptions()` gives a login URL and success conditions; after
     login the download uses the page session. Self-login works like
     Discount.
   - `self-login-custom`: browser-based but login does extra work we must
     replicate (like Cal's token capture). Implement it if you can do so
     without credentials; otherwise classify as unsupported.
   - `unsupported`: login is an API call that needs the password in our
     process (for example a Node fetch with the password in the body), or
     needs an OTP flow the library drives itself (oneZero). Never work
     around this by collecting the password. Write why in the doc.
2. **Registry** (`src/shared/providers.ts`): for each provider: `id`,
   English display `name`, `kind` (`bank` or `card`), `status`
   (`verified`, `experimental`, `unsupported`), and for unsupported a short
   user-facing `reason`. Discount is `verified`; Cal stays `experimental`
   until its download is confirmed; others that can self-login are
   `experimental`.
3. **Generic self-login**: replace the two hand-written subclasses with one
   mechanism that works for every `self-login` provider: create the
   library's scraper for the company, replace `login()` with the
   self-login wait (open login URL, wait for the success condition), and
   wrap `terminate()` so `onFinishing` fires before cleanup (see the fix in
   commit 78a486a: the library closes its tab in `terminate()`). Keep Cal's
   token capture as a provider-specific hook. All library internals stay in
   `self-login.ts` with a comment naming version 6.12.2.
4. **Allowlist per provider**: host suffixes from each scraper's login URL,
   page origins and API endpoints, with the hosts it calls from Node listed
   in its doc. Look-alike hosts must stay blocked.
5. **Accounts and Sync panel**: list providers from the registry: verified
   first, then experimental with a small "Experimental" tag, unsupported
   hidden behind "Why isn't my bank here?" with the reasons. Keep the look.
   Only providers with accounts or chosen by the user show in the Sync
   panel; add an "Add a bank or card" picker.
6. **Ledger**: `PROVIDER_KIND` from the registry; card-bill company
   patterns know which card provider each company line belongs to (cal,
   max, isracard, amex).

## Tests (definition of done)

- Registry: every library `CompanyTypes` value is in it exactly once; every
  enabled provider has an allowlist and a doc.
- Generic self-login: for at least Discount, Cal, Hapoalim, Leumi and Max,
  a fake page proves the login URL is opened, success is detected with the
  library's own conditions, `onFinishing` fires before the tab closes, and
  no credential field is ever filled.
- Allowlist look-alike tests for every enabled provider.
- The existing Discount and Cal tests keep passing.
- `npm run check` green, and screenshots of Accounts and the Add picker in
  light and dark (see AGENTS.md "Working in the sandbox").

## Report

Include the full classification table (provider, status, reason, evidence)
and exact `npm run sync:try -- <id>` steps for the owner to verify any
provider they or their family use.
