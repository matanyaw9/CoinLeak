import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrate } from "./index";
import { MIGRATIONS } from "./migrations";

// A database as it stood before 0010, with a bank, two cards, a removed
// account, rows of every kind, a card bill, a rule on an account and a
// tombstone: everything that points at an account id.
function databaseAt9(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const m of MIGRATIONS.filter((x) => x.version <= 9)) {
    db.exec(m.sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '')").run(m.version);
  }
  db.exec(`INSERT INTO accounts (id, provider, kind, account_number, card_mode, balance, last_synced_at, created_at, sync_enabled)
    VALUES (3, 'discount', 'bank', '111', NULL, 500, 's', 'c', 1),
           (7, 'visaCal', 'card', '4321', 'credit', NULL, 's', 'c', 1),
           (9, 'max', 'card', '8765', 'debit', NULL, NULL, 'c', 0)`);
  const insert = db.prepare(
    `INSERT INTO transactions (account_id, date, amount, description, status, excluded, internal, internal_by_user,
       card_bill_account_id, card_bill_style, card_bill_date, gone_at, trashed_at, dedup_hash, dedup_seq, created_at, updated_at)
     VALUES (?, '2026-03-01', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 0, 'c', 'u')`,
  );
  insert.run(7, -1000, "coffee", "completed", 0, 0, null, null, null, null, null, "h1");
  insert.run(3, -1000, "card bill", "completed", 0, 1, 7, "credit", "2026-03-10", null, null, "h2");
  insert.run(3, 5000, "salary", "completed", 0, 0, null, null, null, null, null, "h3");
  insert.run(3, -300, "excluded", "completed", 1, 0, null, null, null, null, null, "h4");
  insert.run(9, -200, "gone", "pending", 0, 0, null, null, null, "g", null, "h5");
  insert.run(9, -100, "trashed", "completed", 0, 0, null, null, null, null, "t", "h6");
  db.exec(`INSERT INTO rules (id, name, position, set_excluded, created_at, updated_at) VALUES (1, 'r', 1, 1, '', '')`);
  db.exec(`INSERT INTO rule_conditions (rule_id, position, kind, account_id) VALUES (1, 1, 'account', 7)`);
  db.exec(`INSERT INTO trash_tombstones (account_id, dedup_hash, dedup_seq, emptied_at) VALUES (9, 'x', 0, 'e')`);
  return db;
}

const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all();

describe("migration 0010 (cash wallet)", () => {
  it("keeps every account, id and row that points at one", () => {
    const db = databaseAt9();
    const accounts = all(db, "SELECT * FROM accounts ORDER BY id");
    const rows = all(db, "SELECT * FROM transactions ORDER BY id");
    const conditions = all(db, "SELECT * FROM rule_conditions ORDER BY id");
    const tombstones = all(db, "SELECT * FROM trash_tombstones");

    migrate(db);

    expect(all(db, "SELECT * FROM accounts ORDER BY id")).toEqual(accounts);
    const after = all(db, "SELECT * FROM transactions ORDER BY id") as Record<string, unknown>[];
    expect(after.map(({ source, ...rest }) => (expect(source).toBe("sync"), rest))).toEqual(rows);
    expect(all(db, "SELECT * FROM rule_conditions ORDER BY id")).toEqual(conditions);
    expect(all(db, "SELECT * FROM trash_tombstones")).toEqual(tombstones);
    expect(all(db, "PRAGMA foreign_key_check")).toEqual([]);
  });

  it("allows one cash wallet, never syncing, and manual rows", () => {
    const db = databaseAt9();
    migrate(db);
    db.exec(`INSERT INTO accounts (provider, kind, account_number, created_at, sync_enabled) VALUES ('cash', 'cash', 'cash', 'c', 0)`);
    expect(() =>
      db.exec(`INSERT INTO accounts (provider, kind, account_number, created_at, sync_enabled) VALUES ('cash', 'cash', 'other', 'c', 0)`),
    ).toThrow();
    expect(() =>
      db.exec(`INSERT INTO accounts (provider, kind, account_number, created_at, sync_enabled) VALUES ('x', 'cash', 'y', 'c', 1)`),
    ).toThrow();
    expect(() => db.exec(`UPDATE transactions SET source = 'other' WHERE id = 1`)).toThrow();
    db.exec(`UPDATE transactions SET source = 'manual' WHERE id = 1`);
  });

  it("keeps the foreign keys working", () => {
    const db = databaseAt9();
    migrate(db);
    expect(() => db.exec("DELETE FROM accounts WHERE id = 3")).toThrow();
    expect(() =>
      db.exec(`INSERT INTO transactions (account_id, date, amount, description, status, dedup_hash, dedup_seq, created_at, updated_at)
               VALUES (99, '2026-03-01', -1, 'x', 'completed', 'z', 0, 'c', 'u')`),
    ).toThrow();
  });
});
