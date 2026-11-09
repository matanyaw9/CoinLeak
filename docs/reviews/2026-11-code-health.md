# Code health review, 2026-11-08

Read-only review of `main` (after wave 5) by a review agent. The lead
turns findings into specs; the owner agreed with finding 1 on 2026-11-09.

## Summary

1. The code is in good shape. Layers really are separate, `src/main` is
   thin wiring, every file has a header comment, money is integer agorot
   everywhere, and `npm run check` is green (703 tests).
2. The biggest cost is the demo: `lib/demo.ts` and `lib/demo-rules.ts`
   reimplement core in the renderer (about 1,470 lines plus 450 lines of
   tests, about 11% of non-test code). It has drifted from core and
   nothing checks that it matches.
3. Two wiring gaps fail silently: `CHANNELS` is never checked against
   `IpcContract`, and query cache keys and refreshes are spread over many
   files while `hooks.ts` claims they live in one place.
4. Money math is creeping into the renderer (day subtotals, trend
   roll-ups, the Home "left" figure and the comparison with last month).
5. A newcomer would trip over: no one-page architecture overview, docs
   behind the code, code organized by spec history ("rulesV2"), and
   renderer helper files that are hard to tell apart.

## Findings, ranked by value to fix

### 1. The demo is a second copy of core (L, highest value)

`demo.ts` (899 lines) and `demo-rules.ts` (568) answer every channel in
`VITE_DEMO=1` builds and copy core: the rule matchers and checks from
`core/rules/match.ts` and `validate.ts`, a third copy of the money model
(`derive()` next to `FLOW_SQL` and `flowOf` in `core/ledger/flow.ts`), and
summary, trend, curves, money flow and the category editor checks. 12 of
18 specs touch it. Drift found: demo `update()` rejects categories made in
the editor (`byId` is built once); a new transfer category is not treated
as a transfer; trend caps at 60 months (core 240). Screenshots show the
demo, not the app.

Fix: run the real core on a seeded database for demo and screenshot runs.
Screenshot runs already get a temp data folder; add a seeder that turns
`generate()` output into `ScrapedAccount[]` and calls `ingest()`,
`createRule()`, `createCategory()`; `createSyncService` already takes a
`runSync` dependency for a fake sync. Remove the demo transport from
`api.ts`, delete both demo files, keep one seed test. Owner decision: this
becomes the Demo profile of F41 (no separate "demo app").

### 2. Nothing checks that `CHANNELS` lists every channel (S)

`ipc.ts` lists channels as `IpcContract` keys and again in `CHANNELS`
(`satisfies` stops wrong names, not missing ones). Main and preload only
register `CHANNELS`, so a forgotten entry fails only at runtime. Fix: assert
`Exclude<Channel, (typeof CHANNELS)[number]>` is `never`, or build the
array from a `Record<Channel, true>`.

### 3. Query keys and refreshes are spread out (M)

Queries and mutations live in `home-page.tsx`, `category-curves-card.tsx`,
`known-places.ts`, `category-actions.ts`, `remove-sync.tsx`,
`rule-actions.ts`, not only `hooks.ts`. `summary:flow` hides under a
`summary:month` key to get refreshed; `refreshLedger` does not refresh
`categories:list` (row counts go stale). Fix: one module owning every key
plus a map from "what changed" to keys to refresh.

### 4. Money math in the renderer (M)

`lib/day-groups.ts` (day subtotals), `trend-card.tsx` via `groupByRoot`
(roll-up to groups), `hero-card.tsx` (`left`, same-day comparison). Fix:
core returns `byParent` in `TrendPoint`, `left` and the comparison base in
`MonthSummary`, day subtotals with the list.

### 5. `core/ledger/queries.ts` does five jobs (S to M, pure move)

Accounts, categories, transactions, trash, summaries in 457 lines. Fix:
`listAccounts` to `accounts.ts`, `listCategories` to `categories.ts`,
trash to `trash.ts`, totals/summary/trend to `summary.ts`, list and update
to `transactions.ts`. `ledger/index.ts` hides the move.

### 6. Screenshot scripts inside product components (M)

`useShot()` in 10 components and `useDemoShot` blocks in five pages with
hard-coded fixtures (category id 61, "Groceries", `[data-hand-set]`).
Fix: `src/renderer/src/shots/<page>.ts` registered by route.

### 7. Validation limits written two or three times (S)

`rule-form.ts` repeats `MAX_TEXT`, `MAX_NAME`, `MAX_CONDITIONS`,
`MAX_VALUES` from `core/rules/validate.ts`; category limits repeat in
`demo.ts`. Fix: `src/shared/limits.ts`.

### 8. Window security wiring has no tests (S to M)

Only `policy.ts` is tested. `main/ipc.ts` (sender check, error codes, log
line), `protocol.ts` (host check, path traversal, CSP) and `security.ts`
(permissions, navigation and window-open blocks) have none. Fix: tests
with `vi.mock("electron")` capturing the registered callbacks.

### 9. Onboarding docs (S)

No `docs/ARCHITECTURE.md` (request path, "add a channel" checklist,
`LEDGER_SQL`, migration rule, demo and screenshot setup). README lacks a
reading order, Node 22.13+ and the system Chrome requirement.
`docs/STATUS.md` is stale (607 tests, wave 5 running). The REQUIREMENTS
section 4 glossary lists 5 flows; there are 8. Sandbox placeholder files
in the repo root are not in `.gitignore`.

### 10. Organized by history instead of domain (S)

`strings.ts` has `rules` and `rulesV2`; `types.ts`, `ipc.ts`, `CHANNELS`
and `handlers.ts` split rules channels around a `spec 13` marker; 81 "spec
N" references in non-test code. Fix: group by domain, keep spec
references only where they explain a decision.

### 11. Renderer helpers hard to tell apart (S to M)

`lib/review.ts`, `review-rows.ts`, `review-actions.ts`; `rules.ts` next to
`rule-actions.ts`; hooks in `components/`; `display.test.ts` tests three
other files; duplicate `useDebounced` in `transactions-page.tsx`; dead
exports `formatDateNumeric`, `monthOf`, `Separator`. Fix: one folder per
domain with `calls.ts` and `use-*.ts`, tests named after their file.

### 12. Smaller cleanups (S)

- Silence the SQLite `ExperimentalWarning` in vitest (24 lines per run).
- A typed `all<T>(db, sql, ...)` helper for the 17 `as unknown as Row[]`
  casts in core.
- Undo of Ignore makes several calls in a loop; one core call restoring a
  list of states would be atomic.
- `ledger/queries.ts` imports `rules/engine`, which imports
  `ledger/card-bills`; a `core/ledger/recompute.ts` would keep them apart.

## Files over about 300 lines

`demo.ts` 899 and `demo-rules.ts` 568 (finding 1); `strings.ts` 679 (text
data, fine); `queries.ts` 457 (finding 5); `transactions-page.tsx` 434 and
`rules-page.tsx` 374 (borderline, mostly screenshot scripts);
`types.ts` 423 (the contract, fine); `sync/self-login.ts` 319 (deliberate,
fine). Long tests are long because the cases are many.

## What is already good

- No SQL or `node:sqlite` outside core, no Electron in core, shared or
  renderer, no core in the renderer; `handlers.ts` is one-line wiring.
- One money model: `LEDGER_SQL` and `FLOW_SQL` with a tested TypeScript twin.
- Core checks every input from the window.
- Logs and errors carry codes and counts only.
- The sync module confines library internals to `self-login.ts`, with a
  per-provider allowlist and citations.
- Every file has a header comment; core tests are deep and use a fixed
  `NOW`; the typed IPC contract keeps renderer, handlers and demo in step;
  CI on Linux and Windows; numbered migrations never edited.
