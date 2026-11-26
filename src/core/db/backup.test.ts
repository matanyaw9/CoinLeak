// Backups (spec 39): a backup holds everything and is one whole file, and the
// check refuses anything that is not an untouched CoinLeak database.

import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { seedDemo } from "@core/demo";
import { ingest, setBudget, updateTransactions } from "@core/ledger";
import { setSetting } from "@core/settings";
import { bank, categoryId, NOW, txn } from "@core/testing/ledger";
import { applyMigrations, BACKUP_MAX_BYTES, checkBackup, openDatabase, writeBackup, type Db } from "./index";
import { MIGRATIONS } from "./migrations";

const dirs: string[] = [];
const open: Db[] = [];
afterEach(() => {
  for (const db of open.splice(0)) if (db.isOpen) db.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  vi.useRealTimers();
});

function tempDir(): string {
  const dir = mkdtempSync(join(process.env["TMPDIR"] ?? tmpdir(), "coinleak-backup-"));
  dirs.push(dir);
  return dir;
}

function track(db: Db): Db {
  open.push(db);
  return db;
}

/** A profile database with rows, categories, rules, an exception, a note, a budget and a setting. */
function fullDatabase(dir: string): Db {
  const db = track(openDatabase(join(dir, "profile.db")));
  seedDemo(db, NOW);
  const [first, second] = (db.prepare("SELECT id FROM transactions ORDER BY id LIMIT 2").all() as { id: number }[]).map(
    (r) => r.id,
  );
  const rule = db.prepare("SELECT id FROM rules ORDER BY id LIMIT 1").get() as { id: number };
  if (first === undefined || second === undefined) throw new Error("the demo has rows");
  updateTransactions(db, [first], { note: "ארוחה עם חברים" });
  db.prepare("INSERT INTO rule_exceptions (rule_id, transaction_id) VALUES (?, ?)").run(rule.id, second);
  setBudget(db, categoryId(db, "Groceries"), 150_000);
  setSetting(db, { key: "syncFrom", value: "2025-01-01" });
  return db;
}

/** Every row of every table, so two databases can be compared whole. */
function contents(db: DatabaseSync): Record<string, string[]> {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  const out: Record<string, string[]> = {};
  for (const { name } of tables) {
    out[name] = db
      .prepare(`SELECT * FROM "${name}"`)
      .all()
      .map((r) => JSON.stringify(r))
      .sort();
  }
  return out;
}

/** A good backup file, then `change` run on it with a plain writable connection. */
function backupWith(dir: string, change: (db: DatabaseSync) => void): string {
  const db = fullDatabase(dir);
  const path = join(dir, "changed.coinleak");
  writeBackup(db, path);
  const raw = new DatabaseSync(path);
  change(raw);
  raw.close();
  return path;
}

function refusal(path: string): string | undefined {
  try {
    checkBackup(path);
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
}

describe("writeBackup", () => {
  it("holds rows, categories, rules, exceptions, notes, budgets and settings", () => {
    const dir = tempDir();
    const db = fullDatabase(dir);
    const path = join(dir, "CoinLeak backup Me 2026-03-31.coinleak");
    const { transactions } = writeBackup(db, path);
    expect(transactions).toBeGreaterThan(100);

    const restored = new DatabaseSync(path, { readOnly: true });
    const want = contents(db);
    expect(Object.keys(want)).toEqual(expect.arrayContaining(["transactions", "categories", "rules", "rule_exceptions", "settings"]));
    expect(want["rule_exceptions"]).toHaveLength(1);
    expect(contents(restored)).toEqual(want);
    restored.close();
    expect(checkBackup(path)).toBeUndefined();
  });

  it("is one file, private to the user, with no -wal or temp file beside it", () => {
    const dir = tempDir();
    const db = fullDatabase(dir);
    const out = join(dir, "out");
    mkdirSync(out);
    writeBackup(db, join(out, "b.coinleak"));
    expect(readdirSync(out)).toEqual(["b.coinleak"]);
    const header = readFileSync(join(out, "b.coinleak"));
    // Bytes 18 and 19 are 1 for a rollback-journal file, 2 for WAL.
    expect([header[18], header[19]]).toEqual([1, 1]);
    if (process.platform !== "win32") {
      expect(statSync(join(out, "b.coinleak")).mode & 0o777).toBe(0o600);
    }
  });

  it("replaces an existing file only with a whole backup", () => {
    const dir = tempDir();
    const db = fullDatabase(dir);
    const path = join(dir, "b.coinleak");
    writeFileSync(path, "an older file");
    writeBackup(db, path);
    expect(checkBackup(path)).toBeUndefined();
  });

  it("a failed write leaves no file behind", () => {
    const dir = tempDir();
    const db = fullDatabase(dir);
    const out = join(dir, "out");
    mkdirSync(out);
    // A folder where the file should go: VACUUM INTO writes the temp file, the rename fails.
    mkdirSync(join(out, "b.coinleak"));
    expect(() => writeBackup(db, join(out, "b.coinleak"))).toThrow(expect.objectContaining({ code: "FILE_NOT_SAVED" }));
    expect(readdirSync(out)).toEqual(["b.coinleak"]);
    expect(() => writeBackup(db, join(dir, "missing", "b.coinleak"))).toThrow(
      expect.objectContaining({ code: "FILE_NOT_SAVED" }),
    );
    expect(readdirSync(dir).some((n) => n.startsWith("missing"))).toBe(false);
  });
});

describe("checkBackup accepts", () => {
  it("a database migrated step by step over time, as the owner's was", () => {
    const dir = tempDir();
    const path = join(dir, "old.db");
    // An early version: the ledger tables, with a row typed straight in.
    const early = new DatabaseSync(path);
    early.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    applyMigrations(early, MIGRATIONS.slice(0, 2));
    early.exec(
      `INSERT INTO accounts (provider, kind, account_number, created_at) VALUES ('discount', 'bank', '100-200300', '2026-01-01');
       INSERT INTO transactions (account_id, date, amount, description, status, dedup_hash, dedup_seq, created_at, updated_at)
       VALUES (1, '2026-01-02', -4590, 'קפה', 'completed', 'h1', 0, '2026-01-02', '2026-01-02');`,
    );
    early.close();
    // Months later the app updates: the rest of the migrations run, more rows come in.
    const later = track(openDatabase(path));
    ingest(later, [bank([txn({ date: "2026-03-02", amount: -12000, description: "סופר" })])], { now: NOW });
    expect(checkBackup(path)).toBeUndefined();
    const backup = join(dir, "b.coinleak");
    writeBackup(later, backup);
    expect(checkBackup(backup)).toBeUndefined();
  });

  it("a database whose migrations ran out of order (a branch build ran a later one first)", () => {
    const dir = tempDir();
    const path = join(dir, "branch.db");
    const db = new DatabaseSync(path);
    db.exec("PRAGMA foreign_keys = ON");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T10:00:00Z"));
    applyMigrations(db, MIGRATIONS.filter((m) => m.version <= 13));
    vi.setSystemTime(new Date("2026-01-02T10:00:00Z"));
    applyMigrations(db, MIGRATIONS.filter((m) => m.version === 16));
    vi.setSystemTime(new Date("2026-01-03T10:00:00Z"));
    applyMigrations(db, MIGRATIONS.filter((m) => m.version === 14 || m.version === 15));
    db.close();
    expect(checkBackup(path)).toBeUndefined();
  });
});

describe("checkBackup refuses", () => {
  it("a file that is not SQLite", () => {
    const path = join(tempDir(), "notes.coinleak");
    writeFileSync(path, "Date,Amount\r\n2026-01-01,-45.90\r\n");
    expect(refusal(path)).toBe("BACKUP_NOT_COINLEAK");
    writeFileSync(path, "");
    expect(refusal(path)).toBe("BACKUP_NOT_COINLEAK");
  });

  it("a file over the size cap, before reading any of it as a database", () => {
    const path = join(tempDir(), "huge.coinleak");
    writeFileSync(path, "SQLite format 3\u0000");
    truncateSync(path, BACKUP_MAX_BYTES + 1);
    expect(refusal(path)).toBe("BACKUP_NOT_COINLEAK");
  });

  it("a damaged file: garbage inside, or cut short", () => {
    const dir = tempDir();
    const db = fullDatabase(dir);
    const path = join(dir, "b.coinleak");
    writeBackup(db, path);
    const bytes = readFileSync(path);
    const pageSize = bytes.readUInt16BE(16);
    const garbled = Buffer.from(bytes);
    garbled.fill(0xa5, pageSize * 3, pageSize * 6);
    writeFileSync(path, garbled);
    expect(refusal(path)).toBe("BACKUP_DAMAGED");
    writeFileSync(path, bytes.subarray(0, Math.floor(bytes.length / 2)));
    expect(refusal(path)).toBe("BACKUP_DAMAGED");
  });

  it("a SQLite file that is not CoinLeak", () => {
    const path = join(tempDir(), "other.coinleak");
    const other = new DatabaseSync(path);
    other.exec("CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT)");
    other.close();
    expect(refusal(path)).toBe("BACKUP_NOT_COINLEAK");
  });

  it("a backup from a newer CoinLeak, with its own code", () => {
    const dir = tempDir();
    const path = backupWith(dir, (db) => {
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '2027-01-01')").run(
        MIGRATIONS.length + 1,
      );
    });
    expect(refusal(path)).toBe("BACKUP_TOO_NEW");
  });

  it("a migration number this app never had that is not newer", () => {
    const path = backupWith(tempDir(), (db) => {
      db.exec("INSERT INTO schema_migrations (version, applied_at) VALUES (0, '2025-01-01')");
    });
    expect(refusal(path)).toBe("BACKUP_NOT_COINLEAK");
  });

  it("a CoinLeak database with one extra trigger", () => {
    const path = backupWith(tempDir(), (db) => {
      db.exec(
        "CREATE TRIGGER hide_spending AFTER INSERT ON transactions BEGIN UPDATE transactions SET excluded = 1 WHERE id = NEW.id; END",
      );
    });
    expect(refusal(path)).toBe("BACKUP_NOT_COINLEAK");
  });

  it("a CoinLeak database with one extra view", () => {
    const path = backupWith(tempDir(), (db) => db.exec("CREATE VIEW totals AS SELECT SUM(amount) FROM transactions"));
    expect(refusal(path)).toBe("BACKUP_NOT_COINLEAK");
  });

  it("a CoinLeak database with one extra table", () => {
    const path = backupWith(tempDir(), (db) => db.exec("CREATE TABLE extra (x TEXT)"));
    expect(refusal(path)).toBe("BACKUP_NOT_COINLEAK");
  });

  it("a CoinLeak database whose trigger was changed under the same name", () => {
    const path = backupWith(tempDir(), (db) => {
      const name = (
        db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name LIMIT 1").get() as { name: string }
      ).name;
      const table = (db.prepare("SELECT tbl_name FROM sqlite_master WHERE name = ?").get(name) as { tbl_name: string }).tbl_name;
      db.exec(`DROP TRIGGER "${name}"`);
      db.exec(`CREATE TRIGGER "${name}" AFTER INSERT ON "${table}" BEGIN SELECT 1; END`);
    });
    expect(refusal(path)).toBe("BACKUP_NOT_COINLEAK");
  });

  it("a trigger renamed to look like SQLite's own statistics table", () => {
    const dir = tempDir();
    const path = join(dir, "renamed.coinleak");
    writeBackup(fullDatabase(dir), path);
    // `defensive` is newer than our Node typings; writable_schema needs it off.
    const raw = new DatabaseSync(path, { defensive: false } as ConstructorParameters<typeof DatabaseSync>[1]);
    raw.exec(
      "CREATE TRIGGER evil AFTER INSERT ON transactions BEGIN UPDATE transactions SET excluded = 1 WHERE id = NEW.id; END",
    );
    raw.exec("PRAGMA writable_schema = ON");
    raw.exec("UPDATE sqlite_master SET name = 'sqlite_stat1', sql = replace(sql, 'evil', 'sqlite_stat1') WHERE name = 'evil'");
    raw.close();
    expect(refusal(path)).toBe("BACKUP_NOT_COINLEAK");
  });
});
