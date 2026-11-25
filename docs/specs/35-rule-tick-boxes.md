# 35 Rule editor: tick each affected row on or off (wave 14)

## Goal

Owner feature F71 (`docs/FEATURES.md`). The rule editor's list of
affected rows is good; "it should also allow me to tick off/on
transactions that I want to be/not be affected (and then the rule is
valid from now on)."

Lead's decision (F71): an unticked row **keeps the category it has
now**, and this rule never touches it again, also after later edits of
the rule. The rule remembers its unticked rows (its exceptions).

## Owns

- New `src/core/db/migrations/0016_rule_exceptions.sql`, its line in
  `migrations.ts`, new `src/core/db/rule-exceptions-migration.test.ts`
- `src/core/rules/engine.ts`, `queries.ts`, `store.ts`, `index.ts`, their
  tests (`starters.ts` and `starter-places.ts` stay as they are)
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/main/handlers.ts`: only the `rules:*` channels' arguments
- `src/renderer/src/components/rules/**` except `starter-lists.tsx`,
  `src/renderer/src/lib/rule-actions.ts`
- `src/renderer/src/strings.ts`: append at the end in a `// spec 35` block

Do not touch categories, Home, the Transactions rows or Trash (specs 34
and 36), `src/core/ledger/**`, or any window security file. Migration
0015 belongs to spec 34; yours is 0016 even if 0015 is not merged yet.

Read first: `AGENTS.md`, `REQUIREMENTS.md` section 4 (rules, D13),
`docs/specs/13-*.md` and `21-*.md` (rules v2 and order),
`src/core/rules/engine.ts`, `queries.ts` (`previewRule`, `saveRule`,
`handOver`), `rule-editor.tsx`, `rule-preview.tsx`, `hand-set.tsx`.

## Build

### 1. Core

- **Migration 0016:** `rule_exceptions (rule_id, transaction_id)`, both
  foreign keys `ON DELETE CASCADE`, primary key on the pair, `STRICT`.
- **Engine:** a rule never matches a row in its exceptions. Load all
  exceptions once per run (a map from rule to row ids), not per row.
  Higher and lower rules still apply to that row as usual.
- **Preview** (`previewRule`): returns the matching rows, newest first,
  up to 500 (say how many more exist), and, for an existing rule, which
  of them are its exceptions. Hand-set rows (F45) stay marked as today.
- **Save** (`saveRule`): takes the ids the user unticked among the rows
  shown. For those rows: add an exception; a row this rule had
  categorized keeps that category, now counted as set by the user
  (`category_source = 'user'`, so the next run leaves it); a row it had
  ignored stays ignored the same way. Rows shown and ticked lose any
  exception. Exceptions on rows not shown (no longer matching) stay, so
  a later edit never brings an unticked row back.
- **F45 together with ticks:** a hand-set row listed and ticked is
  changed by the rule as today (`alsoChange`); unticked, it is an
  exception and keeps its category.
- Validation: ids must be positive integers; unknown or trashed ids are
  ignored, never an error a user can hit by racing a sync.

### 2. Editor

- The affected rows list shows every row from the preview, each with a
  check box, ticked by default (an existing exception shows unticked). A
  box above the list ticks or unticks all shown. The count reads, for
  example, "Changes 12 of 14 transactions".
- Hand-set rows sit in the same list with a "set by you" mark (replace
  the separate hand-set list, keeping its meaning: ticked means "the rule
  changes it").
- Keyboard: Tab reaches the list, Space toggles the focused box, the box
  above the list is reachable too. (Spec 36 builds a shared arrow-key
  helper in parallel; the lead adds arrow keys to this list after both
  merge, so use plain focusable check boxes, no arrow code of your own.)
- A short line under the list says what unticking does: "Unticked rows
  keep their category, and this rule leaves them alone from now on."

## Tests (definition of done)

- Migration: table exists; deleting a rule or a row deletes its
  exceptions; existing data unchanged.
- Engine: an excepted row is skipped by that rule only; a lower rule can
  still set it; exceptions survive editing the rule's conditions and
  reordering.
- Save: unticking a row the rule set keeps its category as the user's;
  ticking it back removes the exception and the rule applies again;
  hand-set ticked vs unticked; unknown and trashed ids ignored; a run over
  all rows with thousands of exceptions stays one query for exceptions.
- Preview: the 500 cap and the "more" count; exceptions marked.
- Renderer: the list's tick state turns into the right save arguments
  (plain function, tested without React).
- `npm run check` green. Screenshots light and dark on the Demo profile:
  the editor with some rows unticked, and with a hand-set row in the list.

## Report

Write it to `.claude/shots/REPORT.md` (the lead reads that file): what
you built, commits, anything outside Owns, screenshot paths, doubts.
Under 40 lines.
