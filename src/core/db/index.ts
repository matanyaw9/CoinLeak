// Opens the app's SQLite file and brings its schema up to date.
// Uses Node's built-in node:sqlite, so there is no native module to build.

import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MIGRATIONS, type Migration } from "./migrations";

export type Db = DatabaseSync;
export { MIGRATIONS, type Migration } from "./migrations";
export { BACKUP_MAX_BYTES, checkBackup, writeBackup } from "./backup";

export function openDatabase(path: string): Db {
  if (path !== ":memory:") ensurePrivateDir(dirname(path));
  const db = new DatabaseSync(path);
  // secure_delete: deleted rows are overwritten in the file, not only marked free (spec 23).
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA secure_delete = ON;");
  migrate(db);
  if (path !== ":memory:") restrictFile(path);
  return db;
}

const MIGRATIONS_TABLE_SQL =
  "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)";

export function migrate(db: Db): void {
  db.exec(MIGRATIONS_TABLE_SQL);
  // Every missing version, not only those above the newest: a branch build
  // may have recorded a later number before an earlier one reached main.
  const done = db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[];
  const applied = new Set(done.map((r) => r.version));
  applyMigrations(
    db,
    MIGRATIONS.filter((m) => !applied.has(m.version)),
  );
}

/** Runs these migrations in this order, each in its own transaction. The backup check (spec 39) replays them too. */
export function applyMigrations(db: Db, list: readonly Migration[]): void {
  db.exec(MIGRATIONS_TABLE_SQL);
  for (const m of list) {
    transaction(db, () => {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        m.version,
        new Date().toISOString(),
      );
    });
  }
}

/** Runs `fn` inside BEGIN/COMMIT, rolling back on any throw. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function ensurePrivateDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== "win32") chmodSync(dir, 0o700);
}

function restrictFile(path: string): void {
  if (process.platform === "win32") return;
  for (const p of [path, `${path}-wal`, `${path}-shm`]) {
    if (existsSync(p)) chmodSync(p, 0o600);
  }
}
