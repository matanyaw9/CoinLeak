import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrate } from "./index";
import { MIGRATIONS } from "./migrations";

// A database as it stood before 0006, with users' data in it.
function databaseAt5(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const m of MIGRATIONS.filter((x) => x.version <= 5)) {
    db.exec(m.sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '')").run(m.version);
  }
  const food = (db.prepare("SELECT id FROM categories WHERE name = 'Food'").get() as { id: number }).id;
  db.prepare("INSERT INTO categories (parent_id, name, kind, archived, sort_order) VALUES (?, 'Bakery', 'expense', 1, 9)").run(food);
  db.prepare("DELETE FROM categories WHERE name = 'Pet Care'").run(); // leaves a gap in the ids
  db.exec(`INSERT INTO accounts (provider, kind, account_number, created_at) VALUES ('discount', 'bank', '1', '')`);
  const insert = db.prepare(
    `INSERT INTO transactions (account_id, date, amount, description, status, category_id, category_source,
       dedup_hash, dedup_seq, created_at, updated_at)
     VALUES (1, '2026-03-01', ?, ?, 'completed', (SELECT id FROM categories WHERE name = ?), ?, ?, 0, 'c', 'u')`,
  );
  for (const [i, name] of ["Groceries", "Bakery", "Salary", "Food"].entries()) {
    insert.run(-100 * (i + 1), `row ${i}`, name, "user", `h${i}`);
  }
  insert.run(-50, "uncategorized", "none", null, "h9");
  db.exec(`INSERT INTO rules (name, position, match_field, match_mode, match_text, set_category_id, created_at, updated_at)
           VALUES ('r', 1, 'description', 'contains', 'x', (SELECT id FROM categories WHERE name = 'Bakery'), '', '')`);
  return db;
}

const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all();
// 0009 (spec 18) adds a column later; the columns 0006 knew must hold.
const CATEGORY_COLUMNS = "SELECT id, parent_id, name, kind, emoji, color, archived, sort_order FROM categories ORDER BY id";

describe("migration 0006 (transfers)", () => {
  it("keeps every category id, child link and transaction category", () => {
    const db = databaseAt5();
    const categories = all(db, CATEGORY_COLUMNS);
    const transactions = all(db, "SELECT * FROM transactions ORDER BY id");
    // 0007 (spec 13) reshapes rules after this; their category links must hold.
    const rules = all(db, "SELECT id, name, set_category_id FROM rules ORDER BY id");

    migrate(db);

    const after = all(db, CATEGORY_COLUMNS);
    expect(after.slice(0, categories.length)).toEqual(categories);
    expect(all(db, "SELECT * FROM transactions ORDER BY id")).toEqual(transactions);
    expect(all(db, "SELECT id, name, set_category_id FROM rules ORDER BY id")).toEqual(rules);
    expect(all(db, "PRAGMA foreign_key_check")).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE category_id IS NOT NULL").get()).toEqual({ n: 4 });
  });

  it("seeds Savings & Investments as a transfer category with two children", () => {
    const db = databaseAt5();
    migrate(db);
    const rows = all(
      db,
      `SELECT c.name, c.kind, p.name AS parent FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
       WHERE c.kind = 'transfer' ORDER BY c.id`,
    );
    expect(rows).toEqual([
      { name: "Savings & Investments", kind: "transfer", parent: null },
      { name: "Savings", kind: "transfer", parent: "Savings & Investments" },
      { name: "Investments", kind: "transfer", parent: "Savings & Investments" },
    ]);
  });

  it("keeps the indexes, the two-level triggers and the foreign keys", () => {
    const db = databaseAt5();
    migrate(db);
    const names = all(db, "SELECT name FROM sqlite_schema WHERE tbl_name = 'categories' AND type <> 'table' ORDER BY name");
    expect(names).toEqual([
      { name: "categories_name" },
      { name: "categories_parent" },
      { name: "categories_two_levels_insert" },
      { name: "categories_two_levels_update" },
    ]);
    const savings = (db.prepare("SELECT id FROM categories WHERE name = 'Savings'").get() as { id: number }).id;
    const food = (db.prepare("SELECT id FROM categories WHERE name = 'Food'").get() as { id: number }).id;
    const insert = db.prepare("INSERT INTO categories (parent_id, name, kind) VALUES (?, ?, ?)");
    expect(() => insert.run(savings, "Too deep", "transfer")).toThrow();
    expect(() => insert.run(food, "Wrong kind", "transfer")).toThrow();
    expect(() => insert.run(null, "Bad kind", "other")).toThrow();
    expect(() => insert.run(null, "Food", "expense")).toThrow();
    expect(() => db.prepare("UPDATE transactions SET category_id = 9999").run()).toThrow();
    // Deleting a category still clears the rows that used it.
    const groceries = (db.prepare("SELECT id FROM categories WHERE name = 'Groceries'").get() as { id: number }).id;
    db.prepare("DELETE FROM categories WHERE id = ?").run(groceries);
    expect(db.prepare("SELECT category_id FROM transactions WHERE description = 'row 0'").get()).toEqual({
      category_id: null,
    });
  });
});
