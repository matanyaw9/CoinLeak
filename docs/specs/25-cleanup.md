# 25 Cleanup: safer wiring, money math in core, leftovers (wave 9)

## Goal

Make the code easier to trust and to change before the first public
version, without changing what the user sees (except the small fixes in
item 6). Findings from `docs/reviews/2026-11-code-health.md` and
`docs/BACKLOG.md`.

## Owns

- `src/shared/ipc.ts` (finding 2 and removing month channels),
  `src/shared/types.ts` (additive, plus removing types only the removed
  channels use)
- `src/main/ipc.ts`, `protocol.ts`, `security.ts`: **tests only**, never
  a behavior change (finding 8)
- `src/core/ledger/queries.ts` only `listTransactions` and
  `toTransactionRow` (day subtotals), `src/core/ledger/period.ts`,
  `curves.ts`, `money-flow.ts` (finding 4, month channels)
- `src/core/settings.ts`: one new key `homeSpendingFilter`
- `src/renderer/src/lib/**` except `failure.ts`, `pages/home-page.tsx`,
  `components/home/**`, `pages/transactions-page.tsx`,
  `components/transactions/**`, `components/layout/**` except
  `profiles-section.tsx`, `components/categories/**`,
  `pages/categories-page.tsx`, `components/rules/**`,
  `pages/rules-page.tsx`, `components/accounts/remove-sync.tsx`
- `src/renderer/src/strings.ts`: may delete unused entries; append in a
  `// spec 25` block
- `docs/ARCHITECTURE.md` (new), `README.md`, `docs/STATUS.md`,
  `.gitignore`

Do not touch Settings, the Accounts page, sync, profiles, ingest, or any
migration (specs 23 and 24). They add one settings key each; expect a
one-line merge in `settings.ts`.

Read first: `AGENTS.md`, `REQUIREMENTS.md` section 7, the review, the
backlog sections "From spec 20" and "From spec 21".

## Build

1. **Channel list check (finding 2).** A compile-time check that
   `CHANNELS` lists every channel in the contract, and a test.
2. **One place for query keys (finding 3).** A module owning every query
   key and one function per "what changed" (ledger, rules, categories,
   accounts) listing what to refresh. Fixes: `summary:flow` under its own
   key; categories row counts refresh after ledger edits; "Also fits N"
   on Rules refreshes after a hand categorization.
3. **Money math to core (finding 4).** Core returns: day subtotals with
   the transaction list, `byParent` in `TrendPoint`, and `left` (income
   minus spending minus transfers) plus the same-day comparison base in
   `PeriodSummary`. The hero, Transactions summary bar and trend card
   only render. Same numbers on screen as today (screenshot before and
   after).
4. **Remove the month-only path.** `useMonth()`, `month-context.tsx` if
   nothing needs it, and the `summary:month`, `summary:trend`,
   `summary:curves`, `summary:flow` channels once nothing calls them.
5. **Security wiring tests (finding 8).** Tests with `vi.mock("electron")`
   for `main/ipc.ts` (sender check, error codes, the log line holds no
   data), `protocol.ts` (host check, path traversal, CSP header),
   `security.ts` (permissions denied, navigation and new windows
   blocked). Do not change these files' behavior.
6. **Leftovers.**
   - Home's All / Essentials / Extras choice is remembered per profile
     (`homeSpendingFilter` setting).
   - Transactions money-account filter offers "Cash" when a wallet
     exists (`cash:wallet`).
   - `useFirstRun`: a profile with only a Cash wallet is not first run.
   - Remove `findAction` (unused) and unused strings
     (`s.rules.order`, `s.categories.search`, `s.categories.noMatch`).
   - Undo of "Ignore" restores the previous exclusion exactly, in one
     core call (backlog "From spec 11", finding 12).
7. **Docs (finding 9).** `docs/ARCHITECTURE.md`: the path of a request
   (window, preload, main, core, SQLite), "add a channel" checklist,
   `LEDGER_SQL` and flows, the migration rule, the Demo profile and
   screenshots. README: reading order, Node 22.13+, the system Chrome
   requirement, restart `npm run dev` after pulling. `docs/STATUS.md`
   brought up to date. `.gitignore` the sandbox placeholder files in the
   repo root (`.bashrc`, `.gitconfig`, `.idea`, `.vscode`, `.mcp.json`
   and friends: check `git status` for the list).

## Tests (definition of done)

- The channel check fails to compile with a channel left out (show it in
  the report, then restore).
- Core: day subtotals, `byParent`, `left` and the comparison base equal
  what the window computed before, on the same fixture.
- Security wiring tests as in item 5.
- Undo of Ignore restores rule-set and user-set exclusions exactly.
- `npm run check` green. Screenshots light and dark on the Demo profile of
  Home and Transactions, compared with main's: same numbers.

## Report

What changed per finding, removed channels, commits, anything outside
Owns, screenshot paths, doubts.
