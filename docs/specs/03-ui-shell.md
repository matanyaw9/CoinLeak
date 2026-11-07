# 03 UI shell in Spent's look (wave 1)

## Goal

The app's frame and first screens, beautiful from day one, running on
realistic **demo data** until the real data is wired in wave 2. The owner
liked Spent's look; match its feel: warm buttercream and sage, warm dark,
serif numbers, soft rounded cards, generous whitespace.

## Owns

- `src/renderer/**` (you may extend `lib/api.ts` but keep its exports)
- `components.json` (new, shadcn config for base-ui)

Read but do not edit: `src/shared/*` (types and the IPC contract you build
against), `src/main/*`, `AGENTS.md`.

Prior art (read only; copy with a credit line in the file header):
- `~/Projects/Spent/src/components/ui/*`: shadcn components already on
  base-ui. Copy the ones you need and remove Next.js specifics
  (`"use client"`, `next/link`, `next/image`, `next-themes`).
- `~/Projects/Spent/src/components/layout/`, `home/`, `transactions/` for
  the look and layout.
- `~/Projects/Spent/public/screenshots/*.png`: the target feel.

All dependencies you need are already installed: base-ui, cva, clsx,
tailwind-merge, lucide-react, sonner, react-router, @tanstack/react-query,
recharts, tw-animate-css, shadcn. Do not add others.

## Build

1. **Shell.** Sidebar (Home, Transactions, Categories, Accounts,
   Settings) and a top bar with a month picker (arrows and keyboard left
   and right) and a Sync button. Hash router (`createHashRouter`), TanStack
   Query provider, sonner toaster.
2. **Data layer.** Hooks per channel (`useMonthSummary`,
   `useTransactions`, ...) calling `call()` from `lib/api.ts`. When the
   build has `VITE_DEMO=1`, the api layer answers from
   `lib/demo.ts` instead: synthetic but realistic data (Hebrew merchant
   names, a Discount account, two Cal cards, a card bill marked internal,
   some uncategorized rows, 12 months of history). Without `VITE_DEMO`,
   unimplemented channels show a friendly empty state, not a crash.
3. **Home.** Hero card (spent this month, income, what was left, change vs
   last month), cumulative spending curve this month vs last month,
   spending by category (donut or treemap with category colors), last 12
   months stacked by category. One shared tooltip component. Clicking a
   category navigates to Transactions filtered by it.
4. **Transactions.** Rows grouped by day with a day subtotal, category
   emoji chip, description with `dir="auto"`, memo muted, account chip,
   amount in serif (spending, income, and not-counted rows styled
   differently with a reason chip), pending marker, needs-review filter,
   search box. Category picker popover with search. Selection and bulk
   categorize can be visual only for now (calls `transactions:update`).
5. **Categories, Accounts, Settings.** Categories as a two-level list with
   emoji and color. Accounts by provider with last sync and a Sync button
   showing `SyncStage` progress (listen to `sync:progress`). Settings: theme
   (system, light, dark) kept in `localStorage`.
6. **Strings** in `src/renderer/src/strings.ts` (English). Money via
   `formatIls`. Dates in Israeli format.
7. Empty states with short friendly copy, never a blank table.

## Visual check (required)

Screenshot every page in light and dark with demo data, look at each, fix
what looks rough, and list the files in your report:

```
VITE_DEMO=1 COINLEAK_START_ROUTE=/transactions COINLEAK_THEME=light \
  COINLEAK_SCREENSHOT=/tmp/<you>/tx-light.png npm run preview
```

## Tests (definition of done)

- A few focused vitest tests: demo data is internally consistent (summary
  totals equal the sum of the rows), month picker logic, the api layer
  throws `ApiError` with the code on failure.
- `npm run check` green.

## Out of scope

Real data wiring, rules UI, packaging, Hebrew UI.
