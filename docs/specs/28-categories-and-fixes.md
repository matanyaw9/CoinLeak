# 28 New default categories, Routine / Treats, and two fixes (wave 10)

## Goal

Owner requests from 2026-11-14:

1. New default categories that separate routine spending from treats.
2. Rename "Essentials / Extras" to "Routine / Treats" everywhere the user
   reads it.
3. The "Me" profile (or any profile) can be deleted.
4. A bank line the user marked as "This pays a card I track" and then
   undid must show the "Card bill?" flag again, so one click can mark it
   again.

## Owns

- `src/core/db/migrations/0013_*.sql` (spec 27 owns 0012),
  `src/core/db/migrations.ts` if new files must be listed, a new
  `src/core/db/categories-v2-migration.test.ts`
- `src/core/rules/starter-places.ts`, `starters.ts`: only to point
  starter lists at the new categories
- `src/core/demo/**`: only category names, to match the new defaults
  (spec 27 also edits Demo for budgets: keep your change small)
- `src/core/ledger/card-bills.ts`, `exclusions.ts`, `queries.ts` (only
  the code paths of the card-bill fix), their tests
- `src/main/profiles.ts`, `profiles.test.ts`, `src/main/handlers.ts`
  (only the profile delete channel)
- `src/renderer/src/components/settings/**`,
  `src/renderer/src/pages/settings-page.tsx`
- `src/renderer/src/components/transactions/**`: only the card-bill
  actions
- `src/renderer/src/strings.ts`: edit only the `essential` and
  `essentials` blocks and the profile and card-bill strings; new strings
  go at the end in a `// spec 28` block

Do not touch the Categories page, the Home cards or budgets (spec 27), or
packaging (spec 29).

Read first: `AGENTS.md`, `REQUIREMENTS.md`,
`src/core/db/migrations/0009_essential_categories.sql` (how the last
category change was done), `src/core/ledger/card-bills.ts`.

## Build

### 1. Default categories (migration 0013)

Target layout. (R) = routine (`essential = 1`), (T) = treat
(`essential = 0`). Groups keep `essential` NULL, as today.

```
Groceries & Shop                 new group
  Groceries (R)                  moved from Food
  Local shop (R)                 new: makolet, kiosk, small daily buys
Eating out & Treats              Food, renamed
  Restaurants (T), Coffee & Cafes (T), Bars (T)
  Small treats (T)               new
Shopping                         new group
  Online shopping (T)            new
  Clothes & Shoes (T)            new
  Shopping (T)                   moved from Lifestyle, renamed "Other shopping"
Transportation                   as today: Transport (R), Fuel (R), Parking (R), Travel (T)
Lifestyle                        Entertainment (T), Sports & Hobbies (T),
                                 Personal Care (T), Vacation (T), Impulsive buying (T)
Home & Bills                     as today: Bills & Utilities (R), Home (R),
                                 Insurance (R), Subscriptions (T)
Health & Family                  as today, all (R)
Work                             new group
  Work equipment (R), Work travel (R), Work meals (R), Courses & training (R)
Money Movement                   as today
```

Rules for existing profiles (owner: "existing too"), same spirit as 0009:

- Only touch rows that still look like the default: match by name
  (case-insensitive) and default parent. A category the user renamed,
  moved or deleted is left alone. A new name that already exists under
  the target group is skipped.
- Moving a category keeps its id, so every transaction, rule and budget
  stays attached. No transaction changes category.
- Renaming "Food" happens only if it still has that name.
- New categories get emoji and colors in the style of 0002 and 0009.
- Fresh profiles end up with exactly the layout above.

### 2. Routine / Treats

Rename the user-facing words: Essential becomes Routine, Extra becomes
Treat, "Essentials / Extras" on Home becomes "Routine / Treats". Code
names and the `essential` column stay as they are (no churn). Check every
string, hint and tooltip that says essential or extra.

### 3. Delete any profile

`deleteProfile` today refuses the open profile and the last real one.
New behavior:

- Deleting the open profile first switches to another profile (the first
  remaining real one, else Demo), then deletes it.
- Deleting the last real profile is allowed: afterwards a fresh empty
  profile named "Me" is created and opened (so the app always has a
  real profile to start in), unless the user is deleting it to keep only
  Demo; keep it simple and always create the fresh one.
- Same typed confirmation as today. The Settings UI enables Delete on
  every profile and words the dialog for the open-profile case ("CoinLeak
  will switch to <name> first").

### 4. Card bill flag comes back

Reproduce on Demo first: mark a "Card bill?" line as "This pays a card I
track", then undo it in every way the app offers (the toast's Undo, "Let
CoinLeak decide", un-ignoring, and Restore from Trash if it applies).
After each, the line must be back to the automatic state: the matcher
runs again and, if no tracked card matches, `possible_card_bill = 1`, so
the "Card bill?" badge and its one-click "This pays a card I track" are
there again. Fix the root cause in core (likely a path that clears
`internal_by_user` or `excluded` without running `applyCardBills`, or a
path that leaves the line protected). "Count it" is a real user decision
and stays as it is.

The owner also asked about a general "hide" switch. Not in this spec:
card bills already leave the totals and fold behind "Show N card bills",
and Ignore covers the rest. Say in your report if the fix leaves a case
where a "hide" would still be needed.

## Tests (definition of done)

- Migration 0013 on a fresh database gives exactly the layout above.
- On a database with the old defaults plus user changes (a renamed Food,
  a deleted Bars, a user category under Lifestyle, rows and rules on
  Groceries and Shopping): ids kept, rows and rules still point at the
  same ids, user changes untouched, no duplicates.
- Profiles: delete the open one (switches first), delete the last real
  one (fresh "Me" opens), delete Demo, refuse an unknown id.
- Card bill: each undo path above restores `possible_card_bill = 1` on a
  card-looking line with no matching card, and leaves a matched line
  internal.
- No "Essential"/"Extra" left in user-facing strings.
- `npm run check` green. Screenshots light and dark on Demo: Categories
  (new layout), Home with the Routine / Treats switch, Settings profiles
  with Delete on the open profile, Transactions with a "Card bill?" line
  after undo.

## Report

What you built, the root cause of the card-bill bug, the migration's
matching rules, commits, anything outside Owns, screenshot paths, doubts.
