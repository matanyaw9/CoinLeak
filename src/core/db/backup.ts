// Backup files (spec 39): writes the open database to one whole file, and
// checks that a file the user picked is an untouched CoinLeak database
// before the app opens it. Refusals are fixed codes; nothing here logs.

import { randomBytes } from "node:crypto";
import { chmodSync, closeSync, openSync, readSync, renameSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CodedError } from "@shared/errors";
import { applyMigrations, type Db } from "./index";
import { MIGRATIONS, type Migration } from "./migrations";

/** A sane cap: years of transactions take a few megabytes. */
export const BACKUP_MAX_BYTES = 1024 ** 3;

const SQLITE_HEADER = "SQLite format 3\u0000";
const NEWEST = Math.max(...MIGRATIONS.map((m) => m.version));

/**
 * Copies the whole database to `path` with VACUUM INTO: first into a temp
 * file next to it, then renamed into place, so a failed backup never leaves
 * half a file and an existing file is only replaced by a whole one. The
 * result is one file (no -wal), private to the user like the database.
 */
export function writeBackup(db: Db, path: string): { transactions: number } {
  const temp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    // Private from the first byte: VACUUM INTO fills an existing empty file.
    closeSync(openSync(temp, "wx", 0o600));
    if (process.platform !== "win32") chmodSync(temp, 0o600);
    db.prepare("VACUUM INTO ?").run(temp);
    renameSync(temp, path);
  } catch {
    rmSync(temp, { force: true });
    throw new CodedError("FILE_NOT_SAVED");
  }
  const row = db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE trashed_at IS NULL").get() as { n: number };
  return { transactions: row.n };
}

/**
 * Refuses anything but a whole CoinLeak database this app can open, in this
 * order: size and SQLite header; integrity; known migration numbers (a newer
 * app's backup has its own code); and exactly the schema our migrations make.
 * Opens the file read-only. The caller deletes a refused file.
 */
export function checkBackup(path: string): void {
  checkSizeAndHeader(path);
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(path, { readOnly: true, allowExtension: false });
    // Views and triggers in the file may only call harmless functions.
    db.exec("PRAGMA trusted_schema = OFF");
  } catch {
    throw new CodedError("BACKUP_DAMAGED");
  }
  try {
    checkIntegrity(db);
    checkSchema(db);
  } finally {
    db.close();
  }
}

function checkSizeAndHeader(path: string): void {
  const head = Buffer.alloc(SQLITE_HEADER.length);
  let size: number;
  try {
    size = statSync(path).size;
    const fd = openSync(path, "r");
    try {
      readSync(fd, head, 0, head.length, 0);
    } finally {
      closeSync(fd);
    }
  } catch {
    throw new CodedError("FILE_NOT_READ");
  }
  if (size > BACKUP_MAX_BYTES || head.toString("latin1") !== SQLITE_HEADER) {
    throw new CodedError("BACKUP_NOT_COINLEAK");
  }
}

function checkIntegrity(db: DatabaseSync): void {
  let rows: Record<string, unknown>[];
  try {
    rows = db.prepare("PRAGMA integrity_check").all();
  } catch {
    throw new CodedError("BACKUP_DAMAGED");
  }
  if (rows.length !== 1 || rows[0]?.["integrity_check"] !== "ok") throw new CodedError("BACKUP_DAMAGED");
}

/** The file's migrations, replayed in the order it ran them, must make exactly its schema. */
function checkSchema(db: DatabaseSync): void {
  const actual = schemaOf(db);
  if (!actual.some((row) => row.startsWith("table\nschema_migrations\n"))) throw new CodedError("BACKUP_NOT_COINLEAK");
  const expected = expectedSchema(appliedMigrations(db));
  const same = actual.length === expected.length && actual.every((row, i) => row === expected[i]);
  if (!same) throw new CodedError("BACKUP_NOT_COINLEAK");
}

/**
 * Every table, index, trigger and view: type, name, table and SQL, sorted.
 * Nothing is left out, not even names SQLite reserves: a crafted file can give
 * a trigger such a name, and the app never runs ANALYZE, so no stat tables.
 */
function schemaOf(db: DatabaseSync): string[] {
  const rows = db.prepare("SELECT type, name, tbl_name, sql FROM sqlite_master").all() as {
    type: string;
    name: string;
    tbl_name: string;
    sql: string | null;
  }[];
  return rows.map((r) => [r.type, r.name, r.tbl_name, r.sql ?? ""].join("\n")).sort();
}

/**
 * The migrations the file recorded, in the order it ran them (a branch build
 * may have run a later number first, which can order columns differently).
 * A number above ours is a newer app's backup; any other unknown is not ours.
 */
function appliedMigrations(db: DatabaseSync): Migration[] {
  let versions: unknown[];
  try {
    const rows = db.prepare("SELECT version FROM schema_migrations ORDER BY applied_at, version").all();
    versions = rows.map((r) => r["version"]);
  } catch {
    throw new CodedError("BACKUP_NOT_COINLEAK");
  }
  if (versions.some((v) => typeof v === "number" && Number.isInteger(v) && v > NEWEST)) {
    throw new CodedError("BACKUP_TOO_NEW");
  }
  const known = versions.map((v) => MIGRATIONS.find((m) => m.version === v));
  if (known.length === 0 || known.some((m) => m === undefined)) throw new CodedError("BACKUP_NOT_COINLEAK");
  return known as Migration[];
}

/** What our migrations make, run in this order on an empty in-memory database. */
function expectedSchema(list: Migration[]): string[] {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys = ON");
    applyMigrations(db, list);
    return schemaOf(db);
  } catch {
    // Our own migrations cannot run in that order: not a file this app made.
    throw new CodedError("BACKUP_NOT_COINLEAK");
  } finally {
    db.close();
  }
}
