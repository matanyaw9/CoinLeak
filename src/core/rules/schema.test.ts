import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrate } from "../db";
import { MIGRATIONS } from "../db/migrations";
import { newDb } from "../testing/ledger";

describe("rules schema (0004)", () => {
  it("marks every exclusion made before rules existed as the user's", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    for (const m of MIGRATIONS.filter((m) => m.version <= 3)) {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '')").run(m.version);
    }
    db.exec(`INSERT INTO accounts (id, provider, kind, account_number, created_at) VALUES (1, 'discount', 'bank', '1', '')`);
    const insert = db.prepare(
      `INSERT INTO transactions (account_id, date, amount, description, status, excluded, dedup_hash, dedup_seq,
         created_at, updated_at) VALUES (1, '2026-03-01', -100, ?, 'completed', ?, ?, 0, '', '')`,
    );
    insert.run("excluded", 1, "a");
    insert.run("counted", 0, "b");

    migrate(db);
    expect(db.prepare("SELECT description, excluded_source, rule_id FROM transactions ORDER BY id").all()).toEqual([
      { description: "excluded", excluded_source: "user", rule_id: null },
      { description: "counted", excluded_source: null, rule_id: null },
    ]);
  });

  it("refuses a rule with no action, a float amount, a reversed range or an empty list", () => {
    const db = newDb();
    const rule = db.prepare(
      `INSERT INTO rules (name, position, set_category_id, set_excluded, created_at, updated_at)
       VALUES ('r', 1, NULL, ?, '', '')`,
    );
    expect(() => rule.run(null)).toThrow();
    const ruleId = Number(rule.run(1).lastInsertRowid);
    const amount = db.prepare(
      "INSERT INTO rule_conditions (rule_id, position, kind, amount_min, amount_max) VALUES (?, 1, 'amount', ?, ?)",
    );
    expect(() => amount.run(ruleId, 1.5, null)).toThrow();
    expect(() => amount.run(ruleId, 500, 400)).toThrow();
    expect(() => amount.run(ruleId, null, null)).toThrow();
    expect(amount.run(ruleId, 400, 500).changes).toBe(1);
    const text = db.prepare(
      "INSERT INTO rule_conditions (rule_id, position, kind, match_field, match_mode, match_values) VALUES (?, 2, 'text', 'description', 'contains', ?)",
    );
    expect(() => text.run(ruleId, "[]")).toThrow();
    expect(() => text.run(ruleId, "not json")).toThrow();
    expect(text.run(ruleId, '["x"]').changes).toBe(1);
  });
});
