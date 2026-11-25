# 39 Backup, restore and CSV export (wave 15)

## Goal

Owner feature F56 (`docs/FEATURES.md`). Owner, 2026-11-25: "an easy way to
migrate my data ... say I want to continue on another machine and migrate
my data." Promised in `REQUIREMENTS.md` section 6 (Settings: backup).

Two things, because they do different jobs:

1. **Backup file.** One file holding everything in the open profile:
   rows, categories, rules and their exceptions, notes, budgets, accounts,
   settings. "Restore from backup" on the other computer brings it all
   back. This is the way to move.
2. **CSV export** of transactions, for Excel. A CSV cannot carry rules,
   notes or budgets back in, so it is not a way to move, and there is no
   CSV import.

The backup file is **not encrypted** (the database it copies is not
either). The app says so where you save it: keep it on your own drive or
USB stick, do not email it or put it in a shared folder.

## Owns

- New `src/core/db/backup.ts` with `backup.test.ts` (make a backup, check
  a candidate file); `src/core/db/index.ts`: only an export line, or a
  small helper `backup.ts` needs
- New `src/core/ledger/export-csv.ts` with `export-csv.test.ts`;
  `src/core/ledger/index.ts`: the export line
- New `src/main/backup.ts` (the native save and open dialogs, files, and
  restoring as a new profile) with its test; `src/main/profiles.ts`: only
  adding a profile from a restored file; `src/main/handlers.ts`: only your
  channels
- `src/shared/types.ts`, `ipc.ts`, `errors.ts`: additive only
- Renderer: `pages/settings-page.tsx` (place the section only), a new
  `components/settings/backup-section.tsx`,
  `components/common/welcome.tsx` (one "Restore a backup" link),
  `lib/api.ts`, `lib/hooks.ts` (additive)
- `src/renderer/src/strings.ts`: append in a `// spec 39` block at the end

Do not touch the charts, budgets, Categories, migrations, `period.ts` or
any window security file (`security.ts`, `policy.ts`, `protocol.ts`,
`webPreferences`); specs 37 and 38 work elsewhere now. No new dependency.
Ask in your report for any change outside Owns.

Read first: `AGENTS.md` (non-negotiables), `REQUIREMENTS.md` sections 3,
4 and 7, `SECURITY.md`, `docs/ARCHITECTURE.md`, `docs/specs/19-profiles.md`,
`docs/specs/23-delete-and-sync-range.md` (how files are deleted),
`src/core/db/index.ts`, `src/main/profiles.ts`, `src/main/handlers.ts`
(`profiles:*`).

## Build

### Backup

1. **Settings, new section "Backup and export"**: "Back up now", "Restore
   from backup", "Export transactions (CSV)", and one line saying the
   backup is not encrypted and where to keep it.
2. **"Back up now"**: main opens the native save dialog (default name
   `CoinLeak backup <profile> <YYYY-MM-DD>.coinleak`, starting in the
   Documents folder). Core writes the open database with
   `VACUUM INTO` to a temporary file next to the chosen path, then renames
   it into place, so a failed backup never leaves half a file and an
   existing file is only replaced by a whole one. The file is made private
   to the user (0600 off Windows), like the database. The window says
   "Backed up 4,213 transactions" with the file name (not the full path).
   Cancelled dialog: nothing happens, no message.
3. Every channel is one user intention and **the renderer never sends a
   path**: main opens the dialog and keeps the path. No path, file name or
   row text in logs; log fixed codes and counts only.

### Restore

4. **"Restore from backup"** (Settings, and a small link on the first-run
   Welcome screen: "Moving from another computer? Restore a backup").
   Main opens the native open dialog (`.coinleak` files). The backup is
   restored **as a new profile**, never over the open one, so nothing is
   ever lost: the profile is named after the backup ("Restored
   2026-11-25", renamable as any profile), and the app switches to it.
   Refused while a sync runs (`SYNC_IN_PROGRESS`), like a profile switch.
5. **The file is checked before it is used**, in this order, on a copy in
   the data folder (never opening the user's file for writing):
   - size under a sane cap (1 GB) and the SQLite file header;
   - opened with `PRAGMA trusted_schema = OFF`, no extensions;
     `PRAGMA integrity_check` is ok;
   - it is a CoinLeak database: its `schema_migrations` versions are all
     known to this app (a backup from a **newer** app version is refused
     with its own code, saying to update the app first), and its schema
     (`sqlite_master`: every table, index, trigger and view, names and
     SQL, ignoring `sqlite_*`) is exactly what this app's migrations make
     for those versions. Build the expected schema by running the same
     migrations on an in-memory database and compare. Anything extra, such
     as a trigger or view the app never made, refuses the file.
   Refused files are deleted from the data folder and the window gets a
   fixed code with a plain message ("This is not a CoinLeak backup", "This
   backup is from a newer CoinLeak. Update the app first.", "The backup
   file is damaged"). Only then is the copy given a safe profile file
   name, added to `profiles.json`, opened (which runs any newer migrations)
   and switched to.
6. On the new computer, the restored accounts still need their bank login
   in the sync browser (that login lives outside the database and is never
   in a backup). Say this in the success message: "Restored. Sync once
   to log in to your banks on this computer."

### CSV export

7. **"Export transactions (CSV)"**: main opens the save dialog
   (`CoinLeak transactions <profile> <YYYY-MM-DD>.csv`); core builds the
   text. One line per transaction that counts or is ignored (not trashed,
   not gone), newest first. Columns: Date, Charged on, Account,
   Description, Amount, Category (full path, "Groceries › Weekly shop"),
   Note, Status (pending or completed), Ignored (yes or empty), Card bill
   (yes or empty), Paid back (yes or empty).
8. **Excel-friendly and safe:**
   - UTF-8 with a BOM (so Hebrew shows in Excel), CRLF line ends, RFC 4180
     quoting (quotes, commas, line breaks inside a field).
   - Amount as a plain number in shekels with two decimals and a dot,
     negative for money out, no ₪ and no thousands separator ("-45.90").
   - Dates as YYYY-MM-DD.
   - **Formula injection:** a text field (description, note, account,
     category) that starts with `=`, `+`, `-`, `@`, a tab or a carriage
     return gets a leading `'`, so Excel never runs it as a formula.

## Tests (definition of done)

- Core backup: a backup of a database with rows, categories, rules,
  exceptions, notes, budgets and settings restores to equal contents; the
  backup is one file (no `-wal`); a failed write leaves no file.
- Core check: accepts a backup made by `backup.ts`; accepts a database
  migrated step by step over time (old version, rows added, migrated
  later: the owner's case); refuses not SQLite, a damaged file, a SQLite
  file that is not CoinLeak, a backup from a newer version (an unknown
  migration number), and a CoinLeak database with one extra trigger, one
  extra view and one extra table.
- Main: restore adds a new profile and never touches the open one's file;
  refused files leave nothing behind in the data folder; refused while a
  sync runs; no path in any log line.
- CSV: columns and order; quoting of commas, quotes and line breaks;
  Hebrew text round trips with the BOM; amounts (-45.90, 1200.00, 0.05);
  each formula prefix is neutralized, and a negative amount is not;
  trashed and gone rows are left out, ignored rows are in.
- `npm run check` green. Screenshots light and dark on the Demo profile:
  the Settings section, the Welcome screen link, a success and a refusal
  message (use a screenshot hook that fakes the result; never open a real
  dialog in a screenshot run).

## Report

Write it to `.claude/shots/REPORT.md`: what you built, the check order,
channels and error codes, commits, anything outside Owns, screenshot
paths, doubts.
