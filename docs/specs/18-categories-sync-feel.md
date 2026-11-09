# 18 Essential or extra, new default categories, sync feel (wave 6)

## Goal

Show where the month can be cut, add the categories the owner asked for,
and make syncing and rule dragging feel alive. Owner features F36, F37,
F38, F39 (`docs/FEATURES.md`).

## Owns

- `src/core/db/migrations/0009_essential_categories.sql` (new) and its line
  in `src/core/db/migrations.ts`
- `src/core/ledger/categories.ts` and tests; `queries.ts`: only
  `listCategories`
- `src/core/rules/starter-places.ts`: only the fuel and parking lists and
  where they point
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/main/handlers.ts`: your channel changes only
- `src/renderer/src/pages/categories-page.tsx`, `components/categories/**`
- `src/renderer/src/pages/rules-page.tsx`: only the drag (auto-scroll)
- `src/renderer/src/components/sync/**`, `lib/sync.tsx`
- `src/renderer/src/lib/demo.ts`: categories channels only
- `src/renderer/src/strings.ts`: append at the end in a `// spec 18` block

Do not touch Home, Transactions, the month picker (specs 16 and 17), or
`src/main/sync-service.ts` and the scraper (the bank window itself is not
ours to draw on).

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 3, 4 and 7,
`docs/specs/15-categories-accounts.md`, `src/core/db/migrations/0002_ledger.sql`
(the seeded tree), `0006_transfers.sql`.

## Build

1. **Essential or extra (F37).** Spending categories get `essential`
   (true or false; null for income and savings kinds, and for groups).
   Seeded defaults, essential: Groceries, Transport, Fuel, Parking, Bills &
   Utilities, Home, Insurance, Health, Education, Kids & Childcare, Pet
   Care, Cash & ATM, Transfers. Extra: Restaurants, Coffee & Cafes, Bars,
   Entertainment, Shopping, Travel, Vacation, Impulsive buying, Sports &
   Hobbies, Personal Care, Subscriptions, Gifts & Donations. Unknown
   (user-made) categories default to essential until the user says
   otherwise. The editor has an Essential / Extra switch; the Categories
   page shows a small "Extra" badge. A later spec shows "Essentials vs
   extras" on Home: expose the flag on `Category`, nothing more.
2. **New defaults (F38), for new and existing databases.** Under
   Transportation: Fuel ⛽ and Parking 🅿️. Under Food: Bars 🍺. Under
   Lifestyle: Vacation 🏖️ and Impulsive buying 🛍️ (pick a distinct emoji).
   Skip any whose name already exists under that group, and skip all of a
   group's additions if the group was renamed or deleted. Never move or
   rename the user's categories. Migration 0009 does both 1 and 2.
3. **Starter lists.** The fuel list sorts into Fuel. Add a parking list
   (Pango, Cellopark, אחוזות החוף and Hebrew spellings as banks print them)
   into Parking. Same rules as spec 13: never added automatically.
4. **Dragging a rule scrolls (F36).** While dragging a rule near the top
   or bottom edge of the visible list, the page scrolls, faster the closer
   to the edge. Keyboard reordering stays.
5. **Sync feels alive (F39).** While a sync runs (opening the browser,
   waiting for login, downloading, saving): an animated indicator, the
   elapsed time ticking, the provider's name, and the line "Keep the bank
   window open. CoinLeak is downloading; this can take a minute or two."
   in the Sync panel and on the Sync button. No fake progress
   percentages: only real stages and real time.
6. **Demo** shows the new categories, flags and badge.
7. **Rules change hand-set rows (F45).** Owner decided: no tick box. When
   a new or edited rule matches rows the user categorized by hand into
   another category, the editor shows them as a plain list ("This rule
   will also change 4 transactions you categorized by hand") and saving
   always hands them over (send every `handSet` id as `alsoChange`).
   Remove the checkbox and its state. Core stays as it is. Only rule
   save does this: sync and "Apply now" still never change a hand-set
   category. Owns for this item: `components/rules/rule-editor.tsx`,
   `components/rules/hand-set.tsx`, and `lib/demo-rules.ts` if needed.

## Tests (definition of done)

- Migration on a fresh database: every seeded flag as listed, the new
  categories in the right groups.
- Migration on an existing database with a renamed group and a user
  category named "Bars": nothing duplicated, nothing moved, user
  categories untouched, every row keeps its category.
- Editor: switching essential and extra persists; income categories have
  no switch.
- Starter lists: fuel points at Fuel, parking at Parking.
- Sync indicator shows elapsed time from the start stage and stops on
  done, failed and cancel.
- Rule editor: with hand-set matches, the list shows and saving sends
  all their ids; with none, nothing extra shows.
- `npm run check` green. Screenshots light and dark: Categories with
  badges and the switch in the editor, the Sync panel mid-download.

## Report

What you built, type changes, commits, anything outside Owns, screenshot
paths.
