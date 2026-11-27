# 44 Whole-code review fixes (wave 18)

## Goal

Fix what `docs/reviews/2026-11-27-whole-code-review.md` found, before the
first release to the owner's friend. Read your item there first: it has
the failure case and the fix. Four parts, one Sonnet agent each, in
parallel. They share only `strings.ts` (append only, own block) and
`src/shared/ipc.ts` / `types.ts` (additive, own lines).

Read first: `AGENTS.md`, this spec, your items in the review, then only
the files under your part's Owns and what they import.

## Part A: card-bill Undo is exact (agent `wave18-cardbill`, review Must fix 1)

**Owns:** `src/core/ledger/card-bills.ts` and its tests,
`src/renderer/src/lib/review.ts` and its callers' undo code,
`src/main/handlers.ts` (that channel only), `src/shared/*` additive.

1. The change that "Count it as spending" / "It is a card bill" makes
   returns, per row, what it was before: `internal` and
   `internal_by_user` (and the card link if it changes).
2. Undo puts exactly that back: a row the matcher had paired goes back to
   the matcher (`null`), a row the user had marked stays the user's.
   Follow the pattern of `restoreExclusions` for Ignore.
3. Test in core with the review's case: card 4321, ₪200 billed 03-10;
   "חיוב לכרטיס ויזה 4321" ₪200 on 03-10 (paired) and "כ.א.ל חיוב" ₪200
   on 03-11 (counted, flagged). Count the first as spending, then Undo:
   both lines are as before, and the spending total is as before.

## Part B: refunds never vanish from Home charts (agent `wave18-refunds`, review Should fix 1)

**Owns:** `src/core/ledger/period.ts` (only what the donut and trend
need) and tests, `src/renderer/src/lib/categories.ts`,
`components/home/category-donut-card.tsx`, `components/home/trend-card.tsx`,
`src/shared/*` additive, `strings.ts` (`// spec 44 B`).

1. Core sends the donut its list ready to draw: each top group with its
   amount (negative when refunds beat spending), and the "Other" folding
   for the ring done in core. The window stops summing `byParent` and
   stops dropping groups at 0 or below.
2. The donut's ring shows only positive groups (it cannot draw negative
   ones). Its list shows every group, a negative one as money back
   ("₪300 back"), so the list adds up to the total in the middle.
3. The trend bars: a month where a group is negative shows it as money
   back in that month's tooltip and legend, never silently clamped to 0.
   Keep the bars' drawing simple: negative parts are not drawn as bars.
4. Tests in core with the review's case (Food ₪1,000 spent, Lifestyle
   only a ₪300 refund): the list holds both, and adds up to ₪700. Mark
   the backlog line about the donut and trend summing `byParent` as done
   in your report (do not edit the backlog).

## Part C: quitting during a sync leaves no bank session behind (agent `wave18-syncquit`, review Should fix 2)

**Owns:** `src/main/index.ts` (only the quit handling; never the
`webPreferences` or anything security related), `src/main/sync/browser.ts`
and its tests, `src/main/sync-service.ts` if it needs a "wait until
stopped" helper, and its tests.

1. On `before-quit`, when a sync runs: prevent the quit, cancel the sync,
   wait for it to end (at most about 20 seconds), then quit. A second
   quit while waiting quits at once.
2. At app start, before any sync can run (the single-instance lock is
   held), remove every `coinleak-sync-*` profile folder in the temp folder,
   whatever its age.
3. Tests: the start sweep removes old and new profile folders and nothing
   else; the quit path cancels and waits (with a fake sync service).
   No real browser and no real bank in tests.

## Part D: tidy-ups (agent `wave18-tidy`, review Should 3, 4 and Nice 1, 2, 3)

**Owns:** `src/shared/ipc.ts`, `src/main/handlers.ts` (removing
`rules:create` only), `src/core/rules/queries.ts` (its comment),
new `src/shared/limits.ts`, `src/core/rules/validate.ts`,
`src/core/ledger/cash.ts`, `src/core/ledger/validate.ts`,
`src/renderer/src/lib/rule-form.ts`,
`src/renderer/src/components/transactions/manual-form.ts`,
`src/core/rules/match.ts` and tests,
`src/renderer/src/pages/transactions-page.tsx` (only `useDebounced`),
`src/renderer/src/lib/format.ts`, `src/core/ledger/categories.ts` and
tests, `src/renderer/src/components/categories/delete-dialog.tsx`,
`src/renderer/src/components/transactions/find.ts` and the files that
import `isMac` / `isFindKey` from it, `strings.ts` (`// spec 44 D`).

1. **Should 3:** remove the unused `rules:create` channel; keep
   `createRule` in core for the Demo, comment says so.
2. **Should 4:** one `src/shared/limits.ts` for the rule limits
   (`MAX_TEXT`, `MAX_NAME`, `MAX_CONDITIONS`, `MAX_VALUES`) and
   `DESCRIPTION_MAX`, `NOTE_MAX`; core and window import it.
3. **Nice 1:** `compileRegex` refuses nested repeats (a `+`, `*` or `{`
   right after a group that already repeats, such as `(\d+)+`), with a
   fixed refusal the editor already knows how to show; tests with
   `(\d+)+$`, `(a*)*`, `(x+){2,}` refused and normal patterns accepted.
4. **Nice 2:** use the shared `lib/use-debounced.ts` in
   `transactions-page.tsx`; delete the unused `formatDateNumeric`.
5. **Nice 3:** deleting a category that has a budget says so in the
   delete dialog ("Its ₪300 budget goes too"); core reports the budget.
6. Drop the `isMac` / `isFindKey` re-export in `find.ts`; import them from
   `lib/shortcuts.ts` everywhere (move the `isFindKey` tests to
   `shortcuts.test.ts`).

## All parts

- Own worktree, own branch. Do not merge, push or touch `dev`.
  Conventional commits, one logical change each. Keep it simple.
- `npm run check` green. Screenshots only for Part B (light: the donut
  with a group shown as money back) and Part D item 5 (the delete dialog).
- **Report** to `.claude/shots/REPORT.md`, at most 30 lines.
