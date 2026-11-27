# 07 Rules engine, core (wave 3)

## Goal

Visible, ordered rules that categorize (or exclude) transactions so the
owner stops sorting the same merchants by hand: "description contains
שופרסל, set Groceries". Core logic, contracts and IPC only; the rules UI
is a later spec.

## Owns

- New `src/core/rules/**` (engine, queries, tests)
- New migration `src/core/db/migrations/0004_rules.sql`, registered in
  `src/core/db/migrations.ts`
- `src/core/ledger/queries.ts`: only `updateTransactions`, so a user
  exclusion is recorded as the user's (see below)
- `src/shared/types.ts` and `src/shared/ipc.ts`: **additive only** (new
  types, new channels); do not change existing ones
- `src/main/handlers.ts`: only the new `rules:*` lines and imports

Do not touch `src/renderer/**`, `src/main/sync/**`, `src/main/sync-service.ts`,
`src/core/ledger/ingest.ts`, `src/core/ledger/pending.ts` (other agents are
working there). The lead wires "run rules after each sync" when merging.

Read first: `AGENTS.md`, `REQUIREMENTS.md` (D13, sections 4 and 6),
`src/core/ledger/*` (flow, queries, card-bills), `src/core/db/migrations/0002_ledger.sql`
and `0003_pending.sql`. Prior art (read only): `~/Projects/Pocket/REQUIREMENTS.md`
section 7, `~/Projects/Spent/UI-DESIGN.md` "Rules engine".

## Model

A rule: name, position (order), enabled, conditions, actions.

- Conditions (all must hold): text match on `description` or `memo` with
  mode `contains`, `starts_with`, `equals` or `regex` (whitespace-normalized,
  case-insensitive); optional account; optional amount range in agorot on
  the absolute amount; optional direction (`out` or `in`).
- Actions (at least one): set category; set excluded.
- Schema: a `rules` table, `transactions.rule_id` (last rule that set a
  field on the row), and `transactions.excluded_source` (`user` or
  `rule`, NULL when not excluded), so rules never undo a user's choice.
  `updateTransactions` sets `excluded_source = 'user'` when the patch
  includes `excluded`.

## Engine

- `applyRules(db, scope)`: scope is `{ runId }` (rows from one sync),
  `{ ids }`, or `"all"`. For each row in scope, for each action field,
  the first enabled rule in order whose conditions match sets it.
- A field the user set is never changed (`category_source = 'user'`,
  `excluded_source = 'user'`). A field a rule set earlier is recomputed:
  if no rule matches any more, it is cleared back to empty. That makes
  editing or deleting a rule correct on existing rows.
- Gone rows and internal card bills may be categorized like any row; the
  flow logic already keeps them out of totals.
- Regex: max 200 characters, must compile, else `CodedError("BAD_REQUEST")`.
  Run regexes on one row's text only (no catastrophic input sizes).
- All writes in one `transaction()`.

## Queries and IPC

Add shared types `Rule`, `RuleInput` (no id, for create/update),
`RulePreview` (`{ matches: number; sample: TransactionRow[] }`, sample up
to 20, newest first) and these channels:

| channel | args | result |
|---|---|---|
| `rules:list` | none | `Rule[]` in order |
| (`rules:create`) | | Removed in spec 44 D: the window saves with `rules:save`; `createRule` stays in core for the Demo |
| `rules:update` | `{ id, rule: RuleInput }` | `Rule`, then reapplies to all |
| `rules:delete` | `{ id }` | `null`, then reapplies to all |
| `rules:reorder` | `{ ids }` (full new order) | `null`, then reapplies |
| `rules:preview` | `RuleInput` | `RulePreview` (does not save) |
| `rules:suggest` | `{ ids }` (selected rows) | `RuleInput` draft: the longest common normalized description prefix (or the full text when one row), common account, amount span, the category the rows share |

## Tests (definition of done)

- Order: first matching rule wins per field; a later rule can still set
  a different field.
- User category and user exclusion are never changed by rules, including
  after rule edits.
- Editing a rule recategorizes its rows; deleting it clears what it set.
- Each match mode, account, amount range and direction condition.
- Hebrew text and whitespace differences match.
- Invalid or oversized regex is rejected and nothing is saved.
- `applyRules({ runId })` touches only that sync's rows.
- `suggest` on three שופרסל rows with different branch suffixes gives a
  `starts_with` rule on the common prefix.
- Flow, summaries and needs-review stay correct after rules run
  (categorized rows leave the uncategorized review).
- `npm run check` green.
