// Databases for tests written against the first default categories (Food
// holding Groceries, Lifestyle holding Shopping). Migration 0013 (spec 28)
// only reshuffles those defaults and changes no table, so these databases
// run every migration except 0013, and the ledger tests keep their layout.

import { DatabaseSync } from "node:sqlite";
import { migrate } from "../db";

const CATEGORY_RESHUFFLE = 13;

/** Brings the schema up to date, leaving the default categories as 0002 and 0009 made them. */
export function migrateKeepingFirstCategories(db: DatabaseSync): void {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  db.prepare("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, 'skipped in tests')").run(
    CATEGORY_RESHUFFLE,
  );
  migrate(db);
}

/** A new in-memory database with the full schema and the first default categories. */
export function dbWithFirstCategories(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON; PRAGMA secure_delete = ON;");
  migrateKeepingFirstCategories(db);
  return db;
}
