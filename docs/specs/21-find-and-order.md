# 21 Find categories and rules, clear rule order (wave 8)

## Goal

Ctrl+F finds what the current page holds, and the Rules page makes it
obvious which rule wins. Owner features F47, F50 (`docs/FEATURES.md`).

## Owns

- `src/renderer/src/pages/categories-page.tsx`, `components/categories/**`
- `src/renderer/src/pages/rules-page.tsx`, `components/rules/**`,
  `lib/rules.ts`, `lib/rule-sentence.ts`
- `src/renderer/src/components/layout/app-shell.tsx`: only the Ctrl+F
  handler
- `src/core/rules/**`: only for the "also matched by an earlier rule"
  count below
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/renderer/src/strings.ts`: append at the end in a `// spec 21` block

Do not touch Transactions, Home, Accounts, `core/ledger/**`, or any
migration (specs 20 and 22). No migration.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 4 and 7,
`docs/specs/13-rules-v2.md`, `docs/specs/17-transactions-tools.md` item 5.

## Build

1. **Ctrl+F per page (F47).** Ctrl+F (Cmd+F on Mac) focuses and selects
   a search box on the page you are on: Transactions as today, Categories
   searches category and group names (and known places), Rules searches
   rule names, condition values and the target category name. On other
   pages it keeps opening Transactions search. Escape clears and leaves
   the box. Matching is case-insensitive, Hebrew and English, `dir="auto"`.
   - Categories: groups with no match collapse away; a group whose name
     matches shows all its categories; matched text is highlighted.
   - Rules: non-matching rules hide; **dragging is off while a search is
     active** (say so in a hint), because reordering a filtered list is
     confusing.
   - "No matches" empty state with a clear button.
2. **Rule order (F50).** The top rule wins. Make it impossible to miss:
   - Number every rule (1, 2, 3) at the left of its card.
   - A short header above the list: "Checked from the top. When two rules
     fit a transaction, the higher one wins." Replace the current one-line
     `order` text.
   - On a rule card, when some rows it fits are decided by a higher rule,
     show "Also fits 12 transactions that rule 2 decides" (name or number
     of the winning rule; if several, "higher rules"). Core computes this
     per rule for one action kind at a time (category vs exclude, since
     first match wins per action); add it to `rules:list` as an optional
     field or a new channel. Do not compute matches in the window.
   - After a drag, a toast: "Rule moved to position 3. It now runs before
     <name>." The counts above refresh.
   - In the rule editor preview, when some matching rows are won by a
     higher rule, say so with the count.

## Tests (definition of done)

- Core: the "decided by a higher rule" counts for category rules and
  exclude rules, with overlapping and non-overlapping rules, after reorder.
- Search helpers (pure functions with tests): categories by group, name,
  known place; rules by name, value, category name; Hebrew text.
- Ctrl+F focuses the right box on Transactions, Categories and Rules.
- Dragging disabled while searching.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  Categories with a search, Rules with numbers and an "also fits" line,
  Rules with a search, the reorder toast.

## Report

What you built, channel or type changes, commits, anything outside Owns,
screenshot paths.
