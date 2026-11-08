# 15 Categories editor, removing money accounts, the app icon (wave 5)

## Goal

Let the owner shape their own categories, stop syncing a money account
without losing its history, and see CoinLeak's logo in the Linux dock.
Owner features F11, F12, F24, F26, and the "known places" view of F29
(`docs/FEATURES.md`).

## Owns

- `src/core/db/migrations/0008_accounts_settings.sql` (new) and its line
  in `src/core/db/migrations.ts`
- New `src/core/ledger/categories.ts`, new `src/core/ledger/accounts.ts`,
  new `src/core/settings.ts`, their tests; exports in
  `src/core/ledger/index.ts`
- `src/core/ledger/queries.ts`: only `listAccounts` and `listCategories`
  (new fields)
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/main/handlers.ts`: the new channels only
- `src/main/index.ts`: only the window `icon` option. Nothing else in that
  file; do not touch `webPreferences`.
- `package.json`: only a `desktopName` field. No dependencies.
- New `build/` folder for icon files, new `scripts/` helper for the Linux
  desktop entry
- `src/renderer/src/pages/categories-page.tsx`, new
  `components/categories/**`
- `src/renderer/src/pages/accounts-page.tsx`, `components/accounts/**`,
  `components/sync/**`, `lib/sync.tsx`
- `src/renderer/src/lib/demo.ts`: categories and accounts channels only
- `src/renderer/src/strings.ts`: append at the end in a `// spec 15` block

Do not touch `flow.ts`, `src/core/rules/**`, `components/rules/**`,
`components/transactions/**`, `home-page.tsx`, `components/home/**`.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 3, 4 and 7, the
existing Categories and Money accounts pages, `docs/specs/10-money-accounts.md`.

## Build

1. **Categories editor (F11, F12).** Rename, change emoji and color, add a
   category, add a meta category (top level), delete (only when no rows
   or rules use it, or by moving its rows to another category first, with
   a clear question). Drag a category from one meta category to another
   (and buttons for keyboard users). Kinds: offer expense and income.
   Spec 14 is adding a third kind, `transfer`, tonight; read the kinds
   from `CategoryKind` so the lead can add it to the picker after merging.
   Core enforces the existing two-level and same-kind triggers; show their
   failures as friendly messages (fixed error codes, no SQL text).
2. **Known places on the Categories page (F29).** Under each category,
   the business names in its list rule, from spec 13's `rules:knownPlaces`
   channel. Spec 13 is building that channel in parallel: build against
   the shape in its spec (`docs/specs/13-rules-v2.md` section 5), keep
   the call in one small function, and if the channel is missing at
   merge time the section shows nothing. Read-only here: "Edit" opens the
   rule.
3. **Remove a money account from syncing (F24).** Accounts get a
   `sync_enabled` flag. "Remove from syncing" on the account (and on a
   provider: all its accounts) asks first, says the transactions stay
   and keep counting, and hides it from the Sync panel. A "Removed" group
   on the Money accounts page offers "Add back". Deleting an account's
   transactions is not part of this spec.
4. **Settings table.** Move the "added providers" list from localStorage
   into the database `settings` table (`settings:get` / `settings:set`
   for a fixed list of keys, validated in core), migrating any value
   still in localStorage once.
5. **App icon (F26).** Make PNG icons (16 to 512 px) and an SVG from the
   logo in `components/layout/logo.tsx` into `build/`, set the window
   icon, set `desktopName` in package.json, and add
   `npm run desktop:install` (a script writing a `.desktop` file and icon
   into `~/.local/share/` for the current user, pointing at this checkout's
   dev run) so GNOME on Wayland shows the logo. Document it in `README.md`
   under a short "Linux dock icon" note. The installer spec will reuse the
   icon files.

## Tests (definition of done)

- Categories core: create, rename, recolor, move between parents, delete
  rules (blocked when in use, or move rows then delete), two-level and
  same-kind rules enforced with fixed codes.
- Accounts: removing from sync keeps every row and every total; the Sync
  panel list excludes it; add back restores it.
- Settings: only known keys, validated values, localStorage migration once.
- `npm run check` green. Screenshots light and dark: Categories with the
  editor open, a drag in progress or the move dialog, known places under a
  category (demo), Money accounts with the "Remove from syncing" question
  and the Removed group. A note in the report on whether the dock icon
  showed after `npm run desktop:install` (you may not be able to check
  this in the sandbox; say so).

## Report

What you built, the new channels, commits, anything outside Owns,
screenshot paths, and exact steps for the owner to get the dock icon.
