# 19 Profiles, and a Demo profile that runs the real app (wave 7)

## Goal

Several people (or one person with separate money) can keep separate data
in one CoinLeak, and the demo stops being a second copy of the app. Owner
feature F41 (`docs/FEATURES.md`) and code review finding 1
(`docs/reviews/2026-11-code-health.md`).

Starts after specs 16 and 18 are merged (they edit `lib/demo.ts`, which
this spec deletes).

## Decisions already made (do not reopen)

- A profile is a name and its own database file. No passwords: a password
  that does not encrypt the file only looks safe.
- The owner's existing database stays where it is and becomes the first
  profile, named "Me". No file is moved or copied.
- Demo is a profile like any other, filled with made-up data by the real
  core. It never syncs. There is no separate demo build.

## Owns

- New `src/main/profiles.ts` and its test: the profile list file
- `src/main/index.ts`: opening the current profile's database, switching
  (window security lines untouched)
- `src/main/handlers.ts`: profile channels; reading the current database
- New `src/core/demo/` (the seeder) and its test
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive, plus removing
  nothing that other code still uses
- `src/renderer/src/lib/api.ts` (remove the demo transport)
- Delete `src/renderer/src/lib/demo.ts`, `demo-rules.ts`, `demo-flow*.ts`
  and their tests
- `src/renderer/src/components/layout/**` (the sidebar switcher),
  `pages/settings-page.tsx` (Profiles section)
- Screenshot helpers that relied on demo ids (`useShot`, `useDemoShot`):
  only to keep them working on seeded data
- `src/renderer/src/strings.ts`: a `// spec 19` block at the end

## Build

1. **Profile list.** `profiles.json` in the data folder:
   `{ current: string, profiles: [{ id, name, file, demo }] }`. If it is
   missing, create it with one profile `{ id: "me", name: "Me", file:
   "coinleak.db", demo: false }`, so today's data is the "Me" profile. New
   profiles get files `profile-<id>.db`; Demo gets `demo.db`. Write the
   file atomically (write a temp file, then rename). A broken file is a
   coded error, never silently replaced.
2. **Switching.** Main holds one open database. Switching: refuse while a
   sync runs (coded error), close the database, open the other (migrations
   run as usual), save `current`, reload the window. Handlers read the
   current database through one small getter; no other cleverness.
3. **Window.** Settings gets a Profiles section: the list, Add (name only),
   Rename, Delete. Delete asks to type the profile's name, never deletes
   the current or the last real profile, and deletes its database file.
   The sidebar's bottom card (today "Demo data") shows the current profile
   name and opens a small menu to switch. In the Demo profile the card
   says "Demo: made-up numbers" and Sync is disabled with that reason.
4. **Demo profile.** "Add the Demo profile" in Settings (only when there
   is none) and "Reset demo data". The seeder in `src/core/demo/` builds
   about 6 months of made-up accounts and transactions as
   `ScrapedAccount[]` and calls the real `ingest()`, `createRule()`,
   `createCategory()`. Same seed gives the same data (fixed date passed
   in). No real names, numbers or merchants copied from real data;
   ordinary chain names like a supermarket are fine.
5. **Remove the old demo.** Delete the demo transport from `api.ts` and
   the demo files. `VITE_DEMO` goes away.
6. **Screenshots.** A screenshot run (`COINLEAK_SCREENSHOT` set) uses a
   temp data folder with only a seeded Demo profile, so screenshots show
   the real app on made-up data. Update `useShot` helpers that used fixed
   demo ids to find things by name. Write the new screenshot command in
   your report; the lead updates `AGENTS.md`.

Keep it plain: one module for the list file, one seeder, a few channels.
No profile-aware caching layers, no plugin systems.

## Tests (definition of done)

- No `profiles.json`: one "Me" profile pointing at `coinleak.db`, nothing
  moved.
- Add, rename, delete, switch persist across a restart of the list module.
- Delete refuses the current profile and the last real profile.
- Switch while a sync runs is refused.
- Two profiles never see each other's transactions.
- Seeder: same input gives the same rows; Home summary of a seeded month
  adds up (income, spending, transfers); rules and categories exist.
- Demo profile cannot start a sync (main refuses, not only the button).
- `npm run check` green. Screenshots light and dark: Settings Profiles,
  the sidebar switcher open, Home and Transactions in the Demo profile.

## Report

What you built, channel shapes, the new screenshot command, commits,
anything outside Owns, screenshot paths, lines deleted vs added.
