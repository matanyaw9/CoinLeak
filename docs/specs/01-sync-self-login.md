# 01 Sync with self-login (wave 1)

## Goal

Download transactions from Discount (bank) and Cal (cards) with
`israeli-bank-scrapers`, where **the user logs in by hand** in a visible
browser window and the app never handles the password. Output is
`ScrapedAccount[]` (`src/shared/types.ts`). Saving to the database is not
part of this spec (spec 02 ingests, wave 2 wires them together).

This is the riskiest unknown in the project. If something cannot work as
specified, stop and report what you found rather than weakening a rule.

## Owns

- `src/main/sync/**` (new)
- `scripts/sync-try.ts` (new)
- `docs/banks/discount.md`, `docs/banks/visaCal.md` (new)
- `package.json`: may add the `sync:try` script, `tsx` as a dev dependency,
  and `overrides` entries for audit fixes. Nothing else.

Read but do not edit: `src/shared/*`, `REQUIREMENTS.md` sections 3 and 5,
`AGENTS.md`. Useful prior art (read only): `~/Projects/Spent/src/server/scrapers/`
(note its security bugs: it stores passwords, forwards library error text,
and disables site isolation; do none of those), `~/Projects/Spent/src/server/lib/date-utils.ts`
(Israel-local dates), and the library itself in `node_modules/israeli-bank-scrapers/lib/`.

## Build

1. **Browser launcher** (`browser.ts`). Starts Chromium with puppeteer:
   - `pipe: true` (no remote debugging port), `headless: false`;
   - a fresh `userDataDir` from `mkdtemp`, mode 0700, **always** deleted in
     a `finally`, including on errors and when the user closes the window;
   - no `--disable-features=IsolateOrigins,site-per-process` and no other
     flag that weakens the browser's security;
   - which Chromium: decide between (a) Chrome for Testing downloaded with
     `@puppeteer/browsers` into the app's data folder, and (b) a system
     Chrome, Chromium or Edge. `COINLEAK_CHROME` env overrides. Missing
     browser is `CodedError("BROWSER_MISSING")`. Document the choice and
     why in your report. This machine (Fedora) has no system Chrome.
2. **Network allowlist** (`allowlist.ts` pure, applied in `browser.ts`).
   Per provider, the host suffixes the sync browser may reach. Apply it to
   every page and frame the browser opens (not only the first page).
   Blocked requests are aborted silently; count them by host. If the login
   page needs third-party hosts (captcha, CDN), add them deliberately and
   list them in `docs/banks/<provider>.md` with the reason.
   Also read the library code for Discount and Cal and list in the same doc
   every host it contacts **from Node** (outside the browser), since the
   allowlist cannot cover those.
3. **Self-login** (`self-login.ts`). Make the library skip its own
   credential filling: navigate to the provider's login URL, wait until the
   current URL matches the provider's success result (the library's
   `possibleResults`), then let the library's normal download code run.
   Pass the browser to the library via its `browser` / `browserContext`
   option. Timeout 5 minutes (`LOGIN_TIMEOUT`). Window closed by the user
   is `LOGIN_CANCELLED`. Prefer a small subclass or wrapper over patching
   library files; if you must rely on library internals, isolate that in
   one file with a comment naming the exact library version.
   **Cal may capture an auth token during login**; check it works and
   report.
4. **Normalize** (`normalize.ts`, pure). Library result to
   `ScrapedAccount[]`: amounts with `toAgorot` (charged amount is
   `amount`, original amount and currency when they differ), dates as
   Israel-local `YYYY-MM-DD`, pending vs completed, installments, memo,
   identifier as string. Card accounts: `accountNumber` is the last 4
   digits.
5. **Errors** (`errors.ts`). Map every library outcome to a `CodedError`
   code. Never put library message text into the error, logs, or return
   values. Add a test that feeds a library error whose message contains a
   fake password and asserts nothing of it survives.
6. **Entry point** (`index.ts`): `runSync(provider, { onProgress, signal })
   => Promise<ScrapedAccount[]>`. One sync at a time (`SYNC_IN_PROGRESS`).
   Emits `SyncStage` values. `signal` cancels and cleans up.
7. **Try script** (`scripts/sync-try.ts`, `npm run sync:try -- discount`).
   Runs `runSync` from Node (no Electron), prints only: number of
   accounts, rows per account, date range, pending count, blocked hosts
   with counts. Never prints descriptions, amounts or account numbers.
8. **Supply chain.** Pin `israeli-bank-scrapers` exactly (currently
   6.12.2; you may move to a newer version only if it is at least two
   weeks old and you read the Discount and Cal diffs). Resolve the
   `npm audit --omit=dev` high findings with `overrides` where safe, or
   explain each one you leave.

## Tests (definition of done)

- allowlist: bank hosts allowed, look-alike hosts (`discountbank.co.il.evil.com`,
  `evil-discountbank.co.il`) and any other host blocked.
- normalize: synthetic library-shaped input covering pending, foreign
  currency, installments, refunds, and a date near midnight UTC.
- errors: every library error type maps to a code; the fake-password test.
- browser: launch options include `pipe: true` and a temp `userDataDir`,
  and the folder is gone after both success and failure (mock puppeteer).
- `npm run check` green.

## Manual acceptance (the owner)

The owner runs `npm run sync:try -- discount` and `-- visaCal`, logs in,
and sees plausible counts. Write the exact steps in your report.

## Out of scope

Saving rows, IPC wiring, UI, other banks, scheduling.
