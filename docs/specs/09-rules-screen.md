# 09 Rules screen (wave 3)

## Goal

The rules engine (spec 07) works in core. Give the owner a friendly way to
use it, so sorting the same merchants by hand stops after the first time.

## Owns

- `src/renderer/**` except `pages/accounts-page.tsx`,
  `components/sync/**` and `components/common/welcome.tsx` (another agent
  owns those tonight). Append new strings at the end of `strings.ts`.
- `src/shared/types.ts`: additive only, add `ruleId: number | null` to
  `TransactionRow`
- `src/core/ledger/queries.ts`: only the mapping that fills `ruleId` in
  `listTransactions`, plus its test

Read first: `AGENTS.md` (especially "Working in the sandbox"),
`docs/specs/07-rules-core.md`, `src/shared/ipc.ts` (`rules:*` channels),
`src/core/rules/` (semantics, suggest), and the existing renderer.

## Build

1. **Rules page** (sidebar entry "Rules", between Categories and Accounts):
   ordered list with drag or up/down to reorder, enable switch, a plain
   sentence per rule ("When the description starts with שופרסל, set
   Groceries"), edit, delete with Undo. Empty state explains rules in one
   friendly sentence.
2. **Rule editor** (dialog): name, field, mode (regex under "Advanced"),
   text, optional account, optional amount range, direction, actions
   (category picker, exclude). Live preview with `rules:preview`: "Matches
   37 transactions" and the first rows. Save calls create or update.
3. **Create from selection**: in Transactions, when rows are selected, the
   bulk bar gets "Make a rule"; it calls `rules:suggest` and opens the
   editor prefilled. Account and amount span from the suggestion are shown
   but off by default (opt-in checkboxes).
4. **After categorizing one row by hand**, a gentle toast: "Always put
   שופרסל in Groceries?" with "Make a rule" (prefilled from that row).
   At most once per merchant per session.
5. **Rule chip**: rows whose category came from a rule show a small chip;
   clicking opens that rule.
6. **Demo mode**: `lib/demo.ts` answers the `rules:*` channels with an
   in-memory rule list that really categorizes demo rows, so screenshots
   show realistic behavior.

## Tests (definition of done)

- The plain-sentence renderer for every mode and condition.
- Demo rules: creating a rule categorizes matching uncategorized demo rows
  and never a row the user set.
- `npm run check` green; screenshots (light and dark) of the Rules page,
  the editor with a live preview, the "Make a rule" bulk action and the
  toast, saved under `.claude/shots/` in your worktree.
