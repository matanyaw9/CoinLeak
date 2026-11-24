# 33 Paid back for a purchase, investment moves, and small fixes (wave 13)

## Goal

Owner features F65, F76, F77 and F74 (`docs/FEATURES.md`).

1. **Paid back (F65).** "If I paid 100 for a pizza, and my friend
   transferred to me 50 ... it should be just 50 spending." The money
   model already does this when the 50 gets the pizza's spending category
   (a refund, `flowOf` in `src/core/ledger/flow.ts`). Make it one easy
   action, linked to the purchase.
2. **Investment moves (F76).** "Getting money from my own investment
   should not be counted as an earning." Rows in the Savings &
   Investments categories (kind `transfer`) already count as neither
   income nor spending, both ways. Make it easy to get them there.
3. **Rename (F77).** "Money accounts" becomes "Finance accounts"
   everywhere the user reads it.
4. **Bigger emojis (F74)** in the category editor's suggestions.

## Owns

- `src/core/db/migrations/0014_paid_back.sql` (and its listing in
  `migrations.ts` if needed), a new `src/core/db/paid-back-migration.test.ts`
- New `src/core/ledger/paid-back.ts`, `paid-back.test.ts`, the export line
  in `src/core/ledger/index.ts`
- `src/core/ledger/queries.ts`: only to return the link on a row (the
  purchase's id, description and date), and its tests
- `src/core/rules/starter-places.ts` (new lists), `starters.test.ts`
- `src/main/handlers.ts`: only the new channels
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/renderer/src/components/transactions/row-menu.tsx`,
  `row-menu-entries.ts`, `row-menu-entries.test.ts`, `category-cell.tsx`,
  new `paid-back-dialog.tsx`
- `src/renderer/src/components/categories/category-editor.tsx` (emoji
  suggestions only)
- `src/renderer/src/lib/api.ts`, `hooks.ts`, `query-keys.ts`: additive only
- `src/renderer/src/strings.ts`: edit the existing "Money accounts"
  strings for the rename; new strings at the end in a `// spec 33` block

Do not touch `transaction-row.tsx`, `selection.ts`, `list-tools.tsx`,
`transactions-page.tsx` (spec 31), card bills or sync (spec 32), or any
window security file. Code names (`accounts`, `AccountsPage`) stay; only
text the user reads changes.

Read first: `AGENTS.md`, `REQUIREMENTS.md` section 4 (money model),
`flow.ts`, `src/core/ledger/queries.ts`, `src/core/rules/starters.ts` and
`starter-places.ts` (how starter lists are offered), `row-menu.tsx`,
`row-menu-entries.ts`, `category-cell.tsx`, `origin.ts`.

## Build

### 1. Paid back for a purchase (F65)

- **Migration 0014**: `transactions.paid_back_for INTEGER REFERENCES
  transactions (id) ON DELETE SET NULL`, null by default. Shipped
  migrations are never edited.
- **Core** `paid-back.ts`:
  - `paidBackCandidates(db, { rowId, text? })`: money-out rows that count
    as spending (flow `spending`), not trashed, from 60 days before to 7
    days after the money-in row, newest first, optional text search on
    description and note. At most 50.
  - `markPaidBack(db, { rowId, purchaseId })`: `rowId` must be money in,
    `purchaseId` money out and counting as spending, both not trashed.
    The row takes the purchase's category, `category_source = 'user'`,
    and `paid_back_for = purchaseId`. A purchase with no category is
    refused with a fixed problem code (the dialog tells the user to
    categorize the purchase first). Several rows may pay back the same
    purchase (two friends).
  - `clearPaidBack(db, rowId)`: removes the link and the category (the
    row returns to Needs review).
  - Integer agorot only; nothing else about the rows changes. Totals need
    no change: the row is a refund of that category.
- **Row menu**: on a money-in row, "Paid back for a purchase..." opens
  `paid-back-dialog.tsx`: a search box and the candidate list (date,
  description, account, amount, category). Picking one links it. On a
  linked row the menu offers "Not paid back" (clear) instead. Both work
  from the keyboard (arrow keys in the list, Enter to pick, Esc to close).
- **Shown**: the category cell of a linked row says so in its tooltip,
  for example "Paid back for Pizza Hut, 12 Nov (₪100)". The purchase's own
  row is not changed.

### 2. Investment and savings starter lists (F76)

Add starter lists in `starter-places.ts`, offered the same way as the
existing ones, never added without the user's click:

- **Investments**: Israeli investment houses and brokers and the bank's
  own securities lines, in Hebrew and English as bank statements write
  them. Research the names (for example Meitav, Altshuler Shaham, Psagot,
  IBI, Excellence, More, Interactive Brokers; securities buy and sell
  wording). Only names that cannot be ordinary shops.
- **Savings**: deposits and savings plans, provident and study funds
  (פיקדון, קופת גמל, קרן השתלמות and the bank wording for them).

Both point at the seeded "Investments" and "Savings" categories under
Savings & Investments (kind `transfer`), so a sale coming back and a
purchase going out both count as neither income nor spending. Existing
profiles see them in the same starter offer. List each name you add in
the report, with why it is safe.

### 3. Rename (F77)

Every user-visible "Money account(s)" becomes "Finance account(s)": page
title, sidebar, empty states, dialogs, plurals. Grep `strings.ts` for
"money account" in any case. Do not rename code.

### 4. Bigger emoji suggestions (F74)

In the category editor, the suggested emojis are at least twice their
current size, with a comfortable click target (at least 36 px) and a
visible focus ring. The layout must still fit the dialog without
scrolling sideways.

## Tests (definition of done)

- Migration: existing rows get null; deleting a purchase sets the link to
  null.
- Core: candidates window, order, search and limit; marking copies the
  category and sets `category_source = 'user'`; a money-out row or an
  uncategorized purchase is refused with its code; clearing returns the
  row to uncategorized; a 100 purchase with a 50 pay-back makes that
  category's spending 50 in `totals()`; two pay-backs on one purchase.
- Starters: the new lists are offered on a fresh profile; a sale (money
  in) and a buy (money out) from a listed broker both get flow
  `transfer`; no new name matches a demo shop name.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  the Paid back dialog, a linked row's tooltip, the renamed accounts page
  and sidebar, the category editor's emojis.

## Report

What you built, the starter names you added, commits, anything outside
Owns, screenshot paths, doubts. Under 40 lines.
