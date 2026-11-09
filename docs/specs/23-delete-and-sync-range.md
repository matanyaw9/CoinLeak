# 23 Delete data, choose how far back to sync (wave 9)

## Goal

The user can wipe their data for good, and decide how much history a
sync downloads. Owner features F52, F53 (`docs/FEATURES.md`).

## Owns

- `src/main/profiles.ts`, `src/main/index.ts` (only the delete flow and
  reopening the database; never the `webPreferences` or security wiring),
  `src/main/handlers.ts` (your channels), `src/main/sync-service.ts` and
  `src/main/sync/index.ts` (only passing the start date)
- `src/core/settings.ts` (one new key `syncFrom`), `src/core/db/index.ts`
  (only `PRAGMA secure_delete`)
- `src/shared/types.ts`, `src/shared/ipc.ts`: additive only
- `src/renderer/src/pages/settings-page.tsx`,
  `components/layout/profiles-section.tsx`, a new
  `components/settings/**`, `components/sync/**` (only to show the range)
- `src/renderer/src/strings.ts`: append at the end in a `// spec 23` block

Do not touch Home, Transactions, Accounts page, `core/ledger/**`, or any
migration (specs 24 and 25). No migration.

Read first: `AGENTS.md`, `REQUIREMENTS.md` sections 3, 5 and 7,
`docs/specs/19-profiles.md`, `src/main/sync/history.ts`.

## Build

1. **Delete this profile's data (F52).** In Settings, a "Danger zone"
   section. Deletes every row of the open profile by deleting its
   database files (file, `-wal`, `-shm`) and starting a fresh empty
   database under the same profile name, then reloads the window. Works
   for the only profile too. On the Demo profile it is "Reset demo data"
   as today.
2. **Delete everything (F52).** Deletes every profile's database files,
   `profiles.json`, and everything CoinLeak stored in Electron's own
   storage for the window (`session.clearStorageData()`: local storage,
   caches). The app then starts like a fresh install (welcome screen, one
   "Me" profile). Leaves no CoinLeak file in the data folder except the
   new empty one.
3. **Confirmation.** Both use a dialog where the user types a fixed word
   (`DELETE`) to enable the button. The text says, honestly:
   - what goes (all transactions, categories, rules, notes, money
     accounts; for "everything", every profile),
   - that it cannot be undone and nothing is kept anywhere else (CoinLeak
     never sent the data off this computer),
   - that SSDs and some file systems can keep old copies of deleted files
     where no app can reach them, and disk encryption (offered when
     installing Fedora, Windows BitLocker) is what protects against that.
   Keep it short and calm; no scary red walls of text.
4. **Overwrite on delete.** Turn on `PRAGMA secure_delete = ON` for every
   database the app opens, so deleted rows (Empty trash, deleted rules)
   are overwritten inside the file, not just marked free.
5. **How far back a sync goes (F53).** Setting `syncFrom` per profile:
   `"max"` (default: as far back as each bank allows) or a date. Settings
   shows the choice with the limits per bank in plain words ("Discount 12
   months, Cal 18 months, Max 4 years..." from `history.ts`, enabled
   providers only). The sync passes it as the start date
   (`requestStart` already takes one). The Sync panel shows "Downloads
   from <date>" under each bank. A date in the future or before 2000 is
   refused in core.
6. **Errors** use `CodedError` codes; failures show through
   `showFailure` (`lib/failure.ts`).

## Tests (definition of done)

- Delete this profile: files gone, a fresh empty database opens, other
  profiles untouched; Demo resets instead.
- Delete everything: no profile database, no `profiles.json` left in a
  temp data dir; next start makes one empty "Me".
- `secure_delete` is on for a newly opened database.
- `syncFrom`: valid and invalid values; the start date reaches
  `requestStart`; "max" keeps today's behavior.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  the danger zone, the typed confirmation dialog, the sync range setting.

## Report

What you built, channel and type changes, commits, anything outside Owns,
screenshot paths, doubts.
