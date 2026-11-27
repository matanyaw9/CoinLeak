# 45 Money flow from the keyboard; split ledger queries (wave 19)

## Goal

Two backlog items that need no owner decision (`docs/BACKLOG.md`), one
Sonnet agent each, in parallel. They share nothing.

Read first: `AGENTS.md`, this spec, then only the files under your part's
Owns and what they import.

## Part A: open the money flow from the keyboard (agent `wave19-flowkeys`)

`AGENTS.md`: every feature also works from the keyboard. Today "Where the
money went" (`flow-sankey.tsx`) opens a category or its transactions only
by mouse (found in spec 43 A).

**Owns:** `src/renderer/src/components/home/flow-sankey.tsx`,
`money-flow-card.tsx`, `src/renderer/src/lib/shortcuts.ts` and its test
(one "charts" line), `strings.ts` (`// spec 45 A`).

1. The chart's names (or nodes) are one Tab stop on `lib/roving.ts`
   (F83: never a new helper). Up and Down move between them, Enter does
   what a click does (open one level down, or open Transactions), and the
   focused one shows the same tooltip as on hover.
2. Back and Show all stay ordinary buttons.
3. Add the keys to the `?` list's "charts" group.
4. Tests: a small pure test for which item Up and Down reach and what
   Enter does (in the style of the other roving tests). `npm run check`
   green. Screenshot, light: a focused name with its tooltip.

## Part B: split `src/core/ledger/queries.ts` (agent `wave19-split`)

Whole-code review 2026-11-27, should 5 (and 2026-11-08, finding 5): the
file is 532 lines with five jobs.

**Owns:** `src/core/ledger/queries.ts`, new `src/core/ledger/accounts.ts`,
`trash.ts`, `edits.ts`, the existing `categories.ts` (only to receive
`listCategories`), `src/core/ledger/index.ts`, and the core tests that
import from `./queries` (only their import lines).

1. A pure move, no behavior change: `listAccounts` to `accounts.ts`,
   `listCategories` to `categories.ts`, `trashTransactions`,
   `restoreTransactions`, `emptyTrash`, `deleteForGood` to `trash.ts`,
   `updateTransactions` and its helpers to `edits.ts`. The transaction list,
   `dayTotals` and the test-only summaries stay in `queries.ts`.
2. `ledger/index.ts` exports the same names as before, so nothing outside
   `src/core/ledger` changes. Imports inside core point at the new files.
3. Each new file starts with its 1 to 3 line header comment.
4. `npm run check` green with the same number of tests as before you
   started (say both numbers in the report). No test changes beyond
   import lines.

## Both parts

- Own worktree, own branch. Do not merge, push or touch `dev`.
  Conventional commits. Keep it simple.
- **Report** to `.claude/shots/REPORT.md`, at most 25 lines.
