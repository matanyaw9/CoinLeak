// Opens the app's SQLite file and brings its schema up to date.
// Uses Node's built-in node:sqlite, so there is no native module to build.

import { DatabaseSync } from "node:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MIGRATIONS } from "./migrations";

export type Db = DatabaseSync;

export function openDatabase(path: string): Db {
  if (path !== ":memory:") ensurePrivateDir(dirname(path));
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  migrate(db);
  if (path !== ":memory:") restrictFile(path);
  return db;
}

export function migrate(db: Db): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  // Every missing version, not only those above the newest: a branch build
  // may have recorded a later number before an earlier one reached main.
  const done = db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[];
  const applied = new Set(done.map((r) => r.version));
  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
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
