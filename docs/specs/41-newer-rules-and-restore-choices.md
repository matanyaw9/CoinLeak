# 41 Newer rules win; restore lets you choose what to keep (wave 15 round 3)

## Goal

Owner features F92 and F93 (`docs/FEATURES.md`, the owner's words are
there). The owner confirmed the lead's reading of both on 2026-11-27. Two
parts, one agent each, in parallel. They share only `strings.ts` (append
only, each in its own block) and `src/shared/types.ts` / `ipc.ts`
(additive only, each its own lines).

Read first: `AGENTS.md`, `REQUIREMENTS.md` section 7, this spec, then only
the files under your part's Owns and what they import.

## Part A: newer rules have the final say (agent `round3-rules`)

### Owns

- `src/core/rules/**` and their tests
- `src/renderer/src/components/rules/**`, `src/renderer/src/pages/rules-page.tsx`
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/main/handlers.ts`: only rules channels
- `src/renderer/src/strings.ts`: append in a `// spec 41 A` block

### Build

1. **A new rule goes on top.** A rule saved from the rule editor, and the
   rule made when a known place is added to a category with no rule, take
   position 1; every other rule moves down one. Rules added from a starter
   list still go to the bottom, as today. Moving rules by hand on the Rules
   page stays as it is. Today both paths use `nextPosition`
   (`store.ts:94`, `queries.ts:76`, `places.ts:86`); keep one plain helper
   for "on top".
2. **The editor previews a new rule as the top rule.** With no saved rule
   (`ruleId` null), no other rule is higher, so every row the draft fits
   gets its tick box unless the user set it by hand or it is already in
   that category. Editing a saved rule keeps its own position, as today.
3. **Contradiction hints.** Two rules contradict on a row when both fit it
   and set different outcomes: different categories, or one ignores and
   the other un-ignores. Rules that agree (same category) do not
   contradict. Name the other rule in plain words:
   - In the editor preview: "Overrides <rule name> on N rows" for each
     lower rule it contradicts, and the existing "decided by a higher rule"
     line names that rule ("<rule name> decides N of these rows").
   - On the Rules page, on each rule line with any: the same two kinds of
     hint, naming the other rule. A hint with several other rules says
     "N rules" and lists their names in its title.
   Core counts them (extend `ruleOverlaps` / `draftReach` in `order.ts`,
   reads only); the window shows what core sends.
4. **Review nice 1** (`docs/reviews/2026-11-25-wave15-review.md`): an
   Ignore rule over a row the user ignored or un-ignored by hand gets no
   tick box and the label "Set by you", as a third reason next to "Already
   here" and "Higher rule". It does not count in "Changes N of M".

### Tests

- core: a saved rule lands at position 1 and the rest shift down by one;
  a known-place rule too; a starter-list rule lands last; a new rule wins a
  row an older rule also fits; the preview of a new draft ticks every row
  except hand-set and already-here rows; contradiction counts both ways,
  and agreeing rules give none; ignore against un-ignore contradicts;
  "Set by you" for a hand-ignored row under an Ignore rule.
- `npm run check` green.
- Screenshots, light and dark, Demo profile: the editor with an
  "Overrides" hint, the Rules page with hints, a preview row "Set by you".

## Part B: restore, choose what to keep (agent `round3-restore`)

### Owns

- `src/core/db/backup.ts` and its test, or a new `src/core/db/restore.ts`
  with its test, for the trimming
- `src/main/backup.ts` and its test; `src/shared/ipc.ts`, `types.ts`:
  additive, plus changing `backup:restore`'s args
- `src/renderer/src/components/settings/backup-section.tsx`, the Welcome
  screen's "Restore a backup" (find it), `lib/api.ts` only for this call
- `src/renderer/src/strings.ts`: append in a `// spec 41 B` block

### Build

1. **Choose first, then pick the file.** "Restore from backup" (Settings
   and the Welcome screen) opens a small dialog: "What to bring over"
   with three tick boxes, all ticked at first:
   - Transactions (with their accounts, notes and balances)
   - Rules (with their exceptions)
   - Budgets (each category's and the monthly total)
   and the line "Categories always come: your rows and rules use them."
   Continue opens the file picker; Cancel or Esc closes. Nothing ticked:
   Continue is disabled. Keyboard: Tab, Space, Enter, Esc.
2. **`backup:restore` takes `{ transactions, rules, budgets }`** (booleans).
   The flow stays as today (copy, `checkBackup`, new profile, open and
   migrate), then core removes what was not kept, in one transaction, and
   runs `VACUUM` so nothing removed stays in the file (`secure_delete` is
   already on):
   - no transactions: every transaction, balance, sync run, trash
     tombstone and rule exception; the accounts too, except the cash
     wallet and any account a kept rule is limited to (keep the row, drop
     its transactions and balance).
   - no rules: every rule (conditions and exceptions go with them). Rows a
     rule had sorted or ignored keep their category and ignore state as
     set by the user (`category_source` / `excluded_source` `'user'`,
     `rule_id` null), so no later sync clears them (`engine.ts:182` clears
     a rule's category when no rule fits any more).
   - no budgets: every category's `monthly_budget` and the `budgetTotal`
     setting.
   The open profile is never touched. A failure removes the new profile,
   as a failed open does today.
3. **Afterwards** the message says what came over: "Restored: 1,234
   transactions, 12 rules, budgets" (only what was kept, with counts from
   core after trimming).
4. CSV export stays as it is (for Excel). No CSV import.

### Tests

- core: each of the seven combinations of kept parts on a full Demo
  database: what is left, what is gone; categories always all there; with
  rules dropped, rule-sorted rows keep category and ignore state, and
  `applyAllRules` afterwards changes nothing; the cash wallet row stays;
  after VACUUM no removed transaction's description is in the file bytes.
- main: `backup:restore` with a choice, refused args (`BAD_REQUEST`), and
  a failure leaving no new profile.
- `npm run check` green.
- Screenshots, light and dark: the "What to bring over" dialog.

## Both parts

- Work in your own worktree on your own branch. Do not merge, push or
  touch `dev`. Conventional commits, one logical change each.
- Keep it simple: plain functions, reuse what is there, no new
  dependencies, no new migration.
- **Report** to `.claude/shots/REPORT.md` in your worktree, at most 40
  lines: what you built, commits, anything needed outside Owns (with the
  exact lines), screenshot paths, doubts.
