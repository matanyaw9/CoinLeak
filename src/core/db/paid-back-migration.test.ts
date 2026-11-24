// Migration 0014 (spec 33): every row starts with no pay-back link, and
// deleting the purchase for good lets go of the link.

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrate } from "./index";
import { MIGRATIONS } from "./migrations";

function databaseAt13(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const m of MIGRATIONS.filter((x) => x.version <= 13)) {
    db.exec(m.sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '')").run(m.version);
  }
  db.exec(`INSERT INTO accounts (id, provider, kind, account_number, card_mode, balance, last_synced_at, created_at, sync_enabled)
    VALUES (1, 'discount', 'bank', '111', NULL, 500, 's', 'c', 1)`);
  const insert = db.prepare(
    `INSERT INTO transactions (id, account_id, date, amount, description, status, dedup_hash, dedup_seq, created_at, updated_at)
     VALUES (?, 1, '2026-03-01', ?, ?, 'completed', ?, 0, 'c', 'u')`,
  );
  insert.run(1, -10000, "pizza", "h1");
  insert.run(2, 5000, "friend", "h2");
  return db;
}

const links = (db: DatabaseSync) =>
  db.prepare("SELECT id, paid_back_for FROM transactions ORDER BY id").all() as { id: number; paid_back_for: number | null }[];

describe("migration 0014 (paid back)", () => {
  it("gives every existing row no link", () => {
    const db = databaseAt13();
    const before = db.prepare("SELECT * FROM transactions ORDER BY id").all();
    migrate(db);
    expect(links(db)).toEqual([
      { id: 1, paid_back_for: null },
      { id: 2, paid_back_for: null },
    ]);
    const after = db.prepare("SELECT * FROM transactions ORDER BY id").all() as Record<string, unknown>[];
    expect(after.map(({ paid_back_for, ...rest }) => (expect(paid_back_for).toBeNull(), rest))).toEqual(before);
  });

  it("sets the link to null when the purchase is deleted", () => {
    const db = databaseAt13();
    migrate(db);
    db.prepare("UPDATE transactions SET paid_back_for = 1 WHERE id = 2").run();
    expect(links(db)).toEqual([
      { id: 1, paid_back_for: null },
      { id: 2, paid_back_for: 1 },
    ]);
    db.prepare("DELETE FROM transactions WHERE id = 1").run();
    expect(links(db)).toEqual([{ id: 2, paid_back_for: null }]);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });
});
