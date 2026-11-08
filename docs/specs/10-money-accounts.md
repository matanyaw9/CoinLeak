# 10 Money accounts and the Sync panel (wave 4)

## Goal

Spec 08 made every provider work in core; the screens still offer only
Discount and Cal. Let the owner add any supported bank or card from the
app, see which are experimental, and see when each money account last
synced. Owner features F17 and F19 (`docs/FEATURES.md`).

## Owns

- `src/renderer/src/pages/accounts-page.tsx`
- `src/renderer/src/components/sync/**`
- `src/renderer/src/components/common/welcome.tsx`
- `src/renderer/src/components/layout/app-sidebar.tsx`: the label only
- `src/renderer/src/strings.ts`: change the accounts strings you need,
  append new ones at the end in a block headed `// spec 10`
- `src/renderer/src/lib/sync.tsx` and `lib/demo.ts` only where the Sync
  panel or Accounts need it (keep demo edits small and in one place)
- Any new files under `src/renderer/src/components/accounts/`

Read first: `AGENTS.md` (especially "Working in the sandbox"),
`docs/specs/08-all-providers.md` (sections 2 and 5), `src/shared/providers.ts`,
and the existing Accounts page and Sync panel.

No core, main, shared or migration changes are needed: `Account.lastSyncedAt`
and the provider registry already exist. If you find one is needed, stop
and say so in your report.

## Build

1. **Rename** "Accounts" to **"Money accounts"** everywhere the user sees it
   (sidebar, page title, welcome copy, empty states). Route and code names
   stay as they are.
2. **Add a bank or card** picker (dialog): providers from the registry,
   banks and cards in two groups, verified first, then experimental with a
   small "Experimental" tag and one line saying what that means ("works in
   tests, not yet confirmed on a real account"). Unsupported providers sit
   behind "Why isn't my bank here?" with each one's `reason`. Choosing a
   provider adds it to the Sync panel (remember the choice in settings via
   an existing channel if one fits; otherwise keep it in the renderer's
   local state and say so in the report) and offers to sync it now.
3. **Sync panel**: shows only providers that have accounts or that the user
   added. Hovering a provider (or its Sync button) shows a tooltip with
   each of its money accounts and its last sync time ("Cal ••1234: synced
   today 09:14", "never synced"). Relative and friendly, local time.
4. **Money accounts page**: group accounts by provider with the provider's
   name and tag, last sync per account, card mode as today.
5. **Welcome** copy is generic ("your bank and credit cards"), not
   Discount and Cal by name.
6. **Demo mode** shows at least one verified, one experimental and one
   never-synced provider.

## Tests (definition of done)

- The provider grouping and ordering (verified, experimental, hidden
  unsupported) as a pure function with a test.
- The "last synced" text for today, yesterday, older, and never.
- `npm run check` green. Screenshots, light and dark: Money accounts page,
  the Add picker, the "Why isn't my bank here?" section, the Sync tooltip.

## Report

What you built, anything you could not do inside "Owns", and the
screenshot paths.
