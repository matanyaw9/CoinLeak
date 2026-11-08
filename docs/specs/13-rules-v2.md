# 13 Rules v2: several conditions, known places, starter lists (wave 5)

## Goal

Rules stay few and readable: one rule per category with a list of names
instead of one rule per shop, shown as the category's "known places".
Owner features F9, F10, F16, F21, F29 (`docs/FEATURES.md`), plus the
"undo Ignore" bug in `docs/BACKLOG.md` (From spec 11).

## Owns

- `src/core/rules/**` and tests
- `src/core/db/migrations/0007_rule_conditions.sql` (new) and its line in
  `src/core/db/migrations.ts`
- `src/core/rules/starter-places.ts` (new): the starter lists as data
- `src/core/ledger/queries.ts`: only `updateTransactions` (for the undo
  fix), with tests
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive, except the `Rule`
  and `RuleInput` shapes, which you may change (update every user of them)
- `src/main/handlers.ts`: rules channels only
- `src/renderer/src/pages/rules-page.tsx`, `components/rules/**`,
  `lib/rule-*.ts`, `lib/rules.ts`, `lib/demo-rules.ts`,
  `lib/review-actions.ts`
- `src/renderer/src/components/transactions/**`: only the row menu item
  "Add to known places" and the rule offer toast
- `src/renderer/src/strings.ts`: append at the end in a `// spec 13` block

Do not touch `flow.ts`, `categories-page.tsx`, `accounts-page.tsx`,
`components/sync/**`, `home-page.tsx`, `components/home/**`. Spec 14 owns
migration 0006, spec 15 owns 0008.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 4 and 7,
`docs/specs/07-rules-core.md`, `docs/specs/09-rules-screen.md`.

## Build

1. **Several conditions.** A rule has a list of conditions joined by
   **all** (AND) or **any** (OR). A text condition can hold several values
   ("description contains any of: ארומה, Aroma, קופיקס"). Other conditions
   stay: account, amount range, direction. Migrate every existing rule
   exactly (one condition, same meaning), with a test proving old rules
   match the same rows before and after.
2. **Editor**: "If" instead of "When"; add or remove conditions; an
   all/any switch; a values field that takes several names as chips.
   The plain sentence reads naturally ("If the description contains
   Aroma, Cofix or Landwer, set Coffee & Cafes").
3. **Visible results (F10, F16)**: saving a rule shows "Applied to 23
   transactions" (count from core). An **Apply now** button on the Rules
   page reapplies all rules and says what changed.
4. **Hand-set rows (F21)**: user edits still win by default. When a new or
   edited rule would match rows the user categorized by hand with a
   different category, the editor lists them: "Also change 4 transactions
   you categorized by hand?" unticked by default. Ticking applies the rule
   to exactly those rows once (they become `category_source = 'rule'`).
   Core gets this as an explicit option on save, with tests that without
   it no user row ever changes.
5. **Known places (F29)**: `rules:knownPlaces` returns, per category, the
   names in its list rules (a "list rule" is a rule with one text
   condition and one category action). Row menu "Add <business> to known
   places of <category>" appends the name to that category's list rule,
   or creates it if none exists. Spec 15 shows the lists on the
   Categories page using this channel; give it a clear shape in `ipc.ts`.
6. **Starter lists**: data for common Israeli chains per seeded category
   (supermarkets, cafes, restaurants, fuel, pharmacies, public transport,
   telecom, streaming), Hebrew and English spellings as banks print them.
   Never added automatically: the Rules page offers "Add starter lists",
   shows what will be added and how many rows it would sort, and creates
   ordinary list rules the user can edit or delete. Skip categories the
   user renamed or deleted.
7. **Undo Ignore fix**: undoing an Ignore restores the row's previous
   `excluded` and `excluded_source` exactly (rules may exclude it later
   if they could before).
8. **Demo** answers the new channels with demo rules that really sort.

## Tests (definition of done)

- Migration keeps every existing rule's matches identical.
- All / any, multi-value contains, with account and amount conditions.
- Saving reports the applied count; Apply now reports changes.
- User-set categories never change unless the explicit option names them.
- Known places: listing, appending a name, creating the rule.
- Starter lists: nothing is created without the call; renamed categories
  are skipped; created rules are ordinary rules.
- Undo Ignore restores both fields.
- `npm run check` green. Screenshots light and dark: editor with several
  conditions and chips, the "Also change 4 transactions" prompt, the
  starter-lists preview, the row menu's "Add to known places".

## Report

What you built, the new channel shapes (especially `rules:knownPlaces`
for spec 15), commits, anything outside Owns, screenshot paths.
