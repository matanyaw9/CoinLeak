// Migration 0016 (spec 35): the rule exceptions table exists, starts empty,
// changes no existing data, and loses a pair when its rule or row is deleted.

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrate } from "./index";
import { MIGRATIONS } from "./migrations";

function databaseBefore16(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const m of MIGRATIONS.filter((x) => x.version < 16)) {
    db.exec(m.sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '')").run(m.version);
  }
  db.exec(`INSERT INTO accounts (id, provider, kind, account_number, card_mode, balance, last_synced_at, created_at, sync_enabled)
    VALUES (1, 'discount', 'bank', '111', NULL, 500, 's', 'c', 1)`);
  const insert = db.prepare(
    `INSERT INTO transactions (id, account_id, date, amount, description, status, dedup_hash, dedup_seq, created_at, updated_at)
     VALUES (?, 1, '2026-03-01', ?, ?, 'completed', ?, 0, 'c', 'u')`,
  );
  insert.run(1, -1800, "cafe one", "h1");
  insert.run(2, -2400, "cafe two", "h2");
  const rule = db.prepare(
    "INSERT INTO rules (id, name, position, set_excluded, created_at, updated_at) VALUES (?, ?, ?, 1, 'c', 'u')",
  );
  rule.run(1, "first", 1);
  rule.run(2, "second", 2);
  return db;
}

const everything = (db: DatabaseSync) => ({
  transactions: db.prepare("SELECT * FROM transactions ORDER BY id").all(),
  rules: db.prepare("SELECT * FROM rules ORDER BY id").all(),
  conditions: db.prepare("SELECT * FROM rule_conditions ORDER BY id").all(),
  categories: db.prepare("SELECT * FROM categories ORDER BY id").all(),
});

const pairs = (db: DatabaseSync) =>
  db.prepare("SELECT rule_id, transaction_id FROM rule_exceptions ORDER BY rule_id, transaction_id").all();

describe("migration 0016 (rule exceptions)", () => {
  it("adds an empty table and changes no existing data", () => {
    const db = databaseBefore16();
    const before = everything(db);
    migrate(db);
    expect(pairs(db)).toEqual([]);
    expect(everything(db)).toEqual(before);
  });

  it("keeps one pair per rule and row, and refuses unknown ids and text", () => {
    const db = databaseBefore16();
    migrate(db);
    const add = db.prepare("INSERT INTO rule_exceptions (rule_id, transaction_id) VALUES (?, ?)");
    add.run(1, 1);
    expect(() => add.run(1, 1)).toThrow();
    expect(() => add.run(9, 1)).toThrow();
    expect(() => add.run(1, 9)).toThrow();
    expect(() => add.run("one", 2)).toThrow();
  });

  it("deletes a rule's exceptions with the rule, and a row's with the row", () => {
    const db = databaseBefore16();
    migrate(db);
    const add = db.prepare("INSERT INTO rule_exceptions (rule_id, transaction_id) VALUES (?, ?)");
    add.run(1, 1);
    add.run(1, 2);
    add.run(2, 1);
    add.run(2, 2);

    db.prepare("DELETE FROM rules WHERE id = 1").run();
    expect(pairs(db)).toEqual([
      { rule_id: 2, transaction_id: 1 },
      { rule_id: 2, transaction_id: 2 },
    ]);
    db.prepare("DELETE FROM transactions WHERE id = 2").run();
    expect(pairs(db)).toEqual([{ rule_id: 2, transaction_id: 1 }]);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});
