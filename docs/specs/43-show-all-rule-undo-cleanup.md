# 43 Show all, rule undo, screenshot hooks (wave 17)

## Goal

Three independent parts, one Sonnet agent each, in parallel, then one Opus
review of the whole code. No owner decision needed. They share only
`strings.ts` (append only, each in its own block).

Read first: `AGENTS.md`, this spec, then only the files under your part's
Owns and what they import.

## Part A: "Show all" on every chart you can narrow (agent `wave17-showall`, F61)

Owner, 2026-11-09: charts you can narrow to categories always have a
visible way back to all. The curves card has it (spec 38 chooser footer).

### Owns

- `src/renderer/src/components/home/trend-card.tsx`, `trend-filter.ts`
  and test, `money-flow-card.tsx`, `category-donut-card.tsx`,
  `spending-curve-card.tsx`
- `src/renderer/src/strings.ts`: append in a `// spec 43 A` block

### Build

1. Check each Home chart that can show less than everything (a
   category chosen, a level opened): month by month bars, the donut, the
   money flow drill-down, the spending curve. For each, one click (and one
   key) must bring back everything, and the control must be visible
   whenever the chart is narrowed, not hidden in a menu.
2. Where that is missing, add a small "Show all" button in the card's
   header, next to what is narrowed. In the money flow, when two levels are
   open, "Back" still goes up one, and "Show all" goes to the top.
3. A chart that cannot be narrowed needs nothing. Write in the report, per
   chart: had it already, added, or cannot be narrowed.

### Tests

- A pure test where logic changes (for example in `trend-filter.ts`).
- `npm run check` green. Screenshots, light: each chart you changed,
  narrowed, showing "Show all".

## Part B: Undo a rule delete exactly (agent `wave17-ruleundo`)

`docs/BACKLOG.md`, from spec 35: Undo after deleting a rule makes a new
rule without its exceptions (`lib/rules.ts` `restoreRule`), so a row the
user had unticked can be sorted again. Undo is also three calls from the
window (create, list, reorder): business logic in the renderer.

### Owns

- `src/core/rules/**` and tests; `src/main/handlers.ts` (rules channels
  only); `src/shared/ipc.ts`, `types.ts` (additive, plus changing the
  `rules:delete` result)
- `src/renderer/src/lib/rules.ts`, `lib/rule-actions.ts`, and the rules
  components that call delete or undo
- `src/renderer/src/strings.ts`: append in a `// spec 43 B` block

### Build

1. `rules:delete` answers with what Undo needs: the rule as it was (with
   its position) and its exception rows.
2. New `rules:restore` takes that back and, in one transaction in core,
   puts the rule back at its old position (others shift down), with its
   exceptions, and runs the rules so every row is as before.
3. The window's Undo makes one call. `restoreRule`'s create, list and
   reorder steps go.

### Tests

- core: delete then restore leaves every transaction exactly as before
  (category, category source, ignored, ignored source, rule id) on the
  Demo database with a rule that has exceptions and sits in the middle of
  the order; the rule is back at its position; the other rules keep their
  order; a restore with a malformed or stale payload is `BAD_REQUEST`.
- `npm run check` green.

## Part C: screenshot hooks that cost or write (agent `wave17-cleanup`)

Reviews since 2026-11-08 flag screenshot-only code in product
components. The `?shot=` pattern stays as a dev aid. Only fix the two
kinds that matter, and write the rule down:

### Owns

- `src/renderer/src/components/budgets/budget-line.tsx`,
  `src/renderer/src/pages/categories-page.tsx` (only the shot)
- `src/renderer/src/components/rules/order-shot.ts`,
  `src/renderer/src/pages/rules-page.tsx` (only the shot)
- `src/core/demo/seed.ts` (only to add what the rules screenshot needs)
- `src/renderer/src/components/transactions/find.ts`,
  `src/renderer/src/lib/shortcuts.ts` (only moving `isMac`, `isFindKey`)
- `docs/BACKLOG.md` (only the screenshot hooks line)

### Build

1. **Per line:** `useRaiseShot` runs in every budget line (one router
   subscription per line). Read the shot once in the page and pass a plain
   prop to the one line that needs it.
2. **Writes data:** `order-shot.ts` saves two rules and ignores two rows
   when a screenshot asks. Make the Demo seed hold what that screenshot
   needs instead (a rule that overlaps an older one, and a row ignored by
   hand under an Ignore rule), so the shot only opens the page or the
   editor and writes nothing. Check the Demo tests still pass and that
   Home's numbers in the Demo do not change by more than the new rows.
3. **Wave 13 leftover:** move `isMac` and `isFindKey` from
   `components/transactions/find.ts` into `lib/shortcuts.ts`.
4. Replace the screenshot hooks line in `docs/BACKLOG.md` with the rule:
   "A `?shot` hook reads the shot once per page (never per row or line)
   and never writes data. Others are accepted as a dev aid."

### Tests

- `npm run check` green; the Demo seed tests pass.
- Screenshots, light: the Rules page and the editor showing the hints,
  taken with the new seed, and a raise offer on Categories.

## All parts

- Own worktree, own branch. Do not merge, push or touch `dev`.
  Conventional commits. Keep it simple.
- **Report** to `.claude/shots/REPORT.md`, at most 30 lines.
