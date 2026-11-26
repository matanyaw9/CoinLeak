// Migration 0015 (spec 34): categories nest three levels. Two-level data
// stays as it was, and the database itself refuses a fourth level, another
// kind, a cycle and a move that pushes a branch too deep.

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrate, openDatabase } from "./index";
import { MIGRATIONS } from "./migrations";

const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all();

/** A database as it stood before migration `version`. */
function databaseBefore(version: number): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const m of MIGRATIONS.filter((x) => x.version < version)) {
    db.exec(m.sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '')").run(m.version);
  }
  return db;
}

/** The id of the one category with this name (and parent name, when given). */
function idOf(db: DatabaseSync, name: string, parent?: string): number {
  const rows = db
    .prepare("SELECT c.id, p.name AS parent FROM categories c LEFT JOIN categories p ON p.id = c.parent_id WHERE c.name = ?")
    .all(name) as { id: number; parent: string | null }[];
  const found = rows.filter((r) => parent === undefined || r.parent === parent);
  if (found.length !== 1) throw new Error(`expected one ${name}, found ${found.length}`);
  return (found[0] as { id: number }).id;
}

const insert = (db: DatabaseSync, parentId: number | null, name: string, kind = "expense"): number =>
  Number(db.prepare("INSERT INTO categories (parent_id, name, kind) VALUES (?, ?, ?)").run(parentId, name, kind).lastInsertRowid);

const move = (db: DatabaseSync, id: number, parentId: number | null): void => {
  db.prepare("UPDATE categories SET parent_id = ? WHERE id = ?").run(parentId, id);
};

describe("migration 0015 (nested categories)", () => {
  it("leaves existing two-level data, rows and rules as they were", () => {
    const db = databaseBefore(15);
    db.exec(`INSERT INTO accounts (provider, kind, account_number, created_at) VALUES ('discount', 'bank', '1', '')`);
    const groceries = idOf(db, "Groceries");
    db.prepare(
      `INSERT INTO transactions (account_id, date, amount, description, status, category_id, category_source,
         dedup_hash, dedup_seq, created_at, updated_at)
       VALUES (1, '2026-03-01', -100, 'row', 'completed', ?, 'user', 'h', 0, 'c', 'u')`,
    ).run(groceries);
    db.prepare(
      `INSERT INTO rules (name, position, join_mode, set_category_id, created_at, updated_at) VALUES ('r', 1, 'all', ?, '', '')`,
    ).run(groceries);
    const before = all(db, "SELECT id, parent_id, name, kind, emoji, color, sort_order FROM categories ORDER BY id");
    const rows = all(db, "SELECT id, category_id FROM transactions");
    const rules = all(db, "SELECT id, set_category_id FROM rules");

    migrate(db);

    // Every category that was there is still there, unchanged (phase 3 may only add).
    const after = all(db, "SELECT id, parent_id, name, kind, emoji, color, sort_order FROM categories ORDER BY id");
    for (const c of before) expect(after).toContainEqual(c);
    expect(all(db, "SELECT id, category_id FROM transactions")).toEqual(rows);
    expect(all(db, "SELECT id, set_category_id FROM rules")).toEqual(rules);
    expect(all(db, "PRAGMA foreign_key_check")).toEqual([]);
  });

  it("swaps the two-level triggers for the tree triggers", () => {
    const db = openDatabase(":memory:");
    const triggers = all(db, "SELECT name FROM sqlite_schema WHERE type = 'trigger' AND tbl_name = 'categories' ORDER BY name");
    expect(triggers).toEqual([{ name: "categories_tree_insert" }, { name: "categories_tree_update" }]);
  });

  it("accepts three levels of the same kind, and rows on every level", () => {
    const db = openDatabase(":memory:");
    const groceries = idOf(db, "Groceries");
    const bakery = insert(db, groceries, "Bakery");
    const savings = idOf(db, "Savings");
    insert(db, savings, "Pension", "transfer");
    const salary = idOf(db, "Salary");
    const bonus = insert(db, salary, "Bonus", "income");
    insert(db, bonus, "Holiday bonus", "income");
    db.exec(`INSERT INTO accounts (provider, kind, account_number, created_at) VALUES ('discount', 'bank', '1', '')`);
    const row = db.prepare(
      `INSERT INTO transactions (account_id, date, amount, description, status, category_id, dedup_hash, dedup_seq, created_at, updated_at)
       VALUES (1, '2026-03-01', -100, ?, 'completed', ?, ?, 0, 'c', 'u')`,
    );
    for (const [i, id] of [idOf(db, "Groceries & Shop"), groceries, bakery].entries()) row.run(`row ${i}`, id, `h${i}`);
    expect(all(db, "SELECT COUNT(*) AS n FROM transactions")).toEqual([{ n: 3 }]);
  });

  it("refuses a fourth level, on insert and on a move", () => {
    const db = openDatabase(":memory:");
    const bakery = insert(db, idOf(db, "Groceries"), "Bakery");
    expect(() => insert(db, bakery, "Too deep")).toThrow(/three levels/);
    const travel = idOf(db, "Travel");
    expect(() => move(db, travel, bakery)).toThrow(/three levels/);
  });

  it("refuses a parent of another kind, on insert, on a move and on a kind change", () => {
    const db = openDatabase(":memory:");
    expect(() => insert(db, idOf(db, "Groceries"), "Wage", "income")).toThrow(/same kind/);
    expect(() => move(db, idOf(db, "Groceries"), idOf(db, "Salary"))).toThrow(/same kind/);
    // A parent cannot change kind under its children, nor a child away from its parent.
    expect(() => db.prepare("UPDATE categories SET kind = 'income' WHERE id = ?").run(idOf(db, "Groceries & Shop"))).toThrow(
      /kind/,
    );
    expect(() => db.prepare("UPDATE categories SET kind = 'income' WHERE id = ?").run(idOf(db, "Groceries"))).toThrow(
      /same kind/,
    );
  });

  it("refuses a category under itself or its own subcategory", () => {
    const db = openDatabase(":memory:");
    const shop = idOf(db, "Groceries & Shop");
    const groceries = idOf(db, "Groceries");
    const bakery = insert(db, groceries, "Bakery");
    expect(() => move(db, shop, shop)).toThrow();
    expect(() => move(db, shop, groceries)).toThrow(/itself or its own subcategory/);
    expect(() => move(db, shop, bakery)).toThrow(/itself or its own subcategory/);
    expect(() => move(db, groceries, bakery)).toThrow(/itself or its own subcategory/);
  });

  it("refuses a move that would put a descendant below level 3, and allows one that fits", () => {
    const db = openDatabase(":memory:");
    const groceries = idOf(db, "Groceries");
    insert(db, groceries, "Bakery");
    // Groceries spans two levels: under a top-level category it fits, under a level 2 one it does not.
    expect(() => move(db, groceries, idOf(db, "Restaurants"))).toThrow(/three levels/);
    move(db, groceries, idOf(db, "Transportation"));
    // A three-level branch can only be top level.
    expect(() => move(db, idOf(db, "Transportation"), idOf(db, "Lifestyle"))).toThrow(/three levels/);
    // A top-level category without children may go to level 3.
    const own = insert(db, null, "Board games");
    move(db, own, idOf(db, "Entertainment"));
    expect(idOf(db, "Board games", "Entertainment")).toBe(own);
  });

  it("adds the new defaults on a fresh database, in order, each with its own emoji and color", () => {
    // Up to 0015 only: 0017 takes level 3 off a new profile again (F94).
    const db = databaseBefore(16);
    const children = (name: string, parent: string) =>
      db
        .prepare("SELECT name, emoji, color, essential FROM categories WHERE parent_id = ? ORDER BY sort_order")
        .all(idOf(db, name, parent)) as { name: string; emoji: string; color: string; essential: number | null }[];
    const groceries = children("Groceries", "Groceries & Shop");
    expect(groceries.map((c) => c.name)).toEqual(["Weekly shop", "Top-up", "Specialty food"]);
    const transport = children("Transport", "Transportation");
    expect(transport.map((c) => c.name)).toEqual(["Bus", "Train"]);
    const top = db
      .prepare("SELECT name, emoji, color, essential FROM categories WHERE parent_id = ? ORDER BY sort_order")
      .all(idOf(db, "Transportation")) as { name: string; emoji: string; color: string; essential: number | null }[];
    expect(top.map((c) => c.name)).toEqual([
      "Transport",
      "Travel",
      "Fuel",
      "Parking",
      "Taxi & rides",
      "Tolls",
      "Car repairs",
      "Car insurance",
      "Car license & test",
    ]);
    for (const list of [groceries, transport, top]) {
      expect(new Set(list.map((c) => c.emoji)).size, "emoji").toBe(list.length);
      expect(new Set(list.map((c) => c.color)).size, "colors").toBe(list.length);
    }
    // No Routine / Treats tag on the new ones (spec 34, F72).
    for (const c of [...groceries, ...transport, ...top.slice(4)]) expect(c.essential, c.name).toBeNull();
  });

  it("adds defaults only where the parent still looks default, skips names already there, and moves no row", () => {
    const db = databaseBefore(15);
    // Groceries renamed, Tolls of the user's own (any case) under Transportation.
    db.prepare("UPDATE categories SET name = 'Supermarket' WHERE id = ?").run(idOf(db, "Groceries", "Groceries & Shop"));
    insert(db, idOf(db, "Transportation"), "TOLLS");
    db.exec(`INSERT INTO accounts (provider, kind, account_number, created_at) VALUES ('discount', 'bank', '1', '')`);
    db.prepare(
      `INSERT INTO transactions (account_id, date, amount, description, status, category_id, category_source,
         dedup_hash, dedup_seq, created_at, updated_at)
       VALUES (1, '2026-03-01', -100, 'row', 'completed', ?, 'user', 'h', 0, 'c', 'u')`,
    ).run(idOf(db, "Transport"));
    const rows = all(db, "SELECT id, category_id FROM transactions");

    migrate(db);

    const under = (id: number) =>
      (db.prepare("SELECT name FROM categories WHERE parent_id = ? ORDER BY sort_order").all(id) as { name: string }[]).map(
        (r) => r.name,
      );
    expect(under(idOf(db, "Supermarket"))).toEqual([]);
    expect(under(idOf(db, "Transport"))).toEqual(["Bus", "Train"]);
    const transportation = under(idOf(db, "Transportation"));
    expect(transportation.filter((n) => n.toLowerCase() === "tolls")).toEqual(["TOLLS"]);
    expect(transportation.slice(-4)).toEqual(["Taxi & rides", "Car repairs", "Car insurance", "Car license & test"]);
    expect(all(db, "SELECT id, category_id FROM transactions")).toEqual(rows);
  });

  it("gives a renamed or moved parent none of the defaults", () => {
    const db = databaseBefore(15);
    db.prepare("UPDATE categories SET name = 'Getting around' WHERE id = ?").run(idOf(db, "Transportation"));
    // Groceries back under another group: not where the default sits.
    db.prepare("UPDATE categories SET parent_id = ? WHERE id = ?").run(idOf(db, "Eating out & Treats"), idOf(db, "Groceries"));
    const before = all(db, "SELECT COUNT(*) AS n FROM categories");
    migrate(db);
    expect(all(db, "SELECT COUNT(*) AS n FROM categories")).toEqual(before);
  });

  it("runs once: migrating again changes nothing", () => {
    const db = openDatabase(":memory:");
    const once = all(db, "SELECT * FROM categories ORDER BY id");
    migrate(db);
    expect(all(db, "SELECT * FROM categories ORDER BY id")).toEqual(once);
  });
});

describe("migration 0017 (two levels for new profiles, F94)", () => {
  const levelThree = (db: DatabaseSync) =>
    (
      db
        .prepare(
          `SELECT c.name FROM categories c JOIN categories p ON p.id = c.parent_id
           WHERE p.parent_id IS NOT NULL ORDER BY c.name`,
        )
        .all() as { name: string }[]
    ).map((r) => r.name);

  it("a new profile has no level 3 categories", () => {
    expect(levelThree(openDatabase(":memory:"))).toEqual([]);
  });

  it("a profile with rows keeps them all", () => {
    const db = databaseBefore(17);
    db.exec(`INSERT INTO accounts (provider, kind, account_number, created_at) VALUES ('discount', 'bank', '1', '')`);
    db.exec(
      `INSERT INTO transactions (account_id, date, amount, description, status, dedup_hash, dedup_seq, created_at, updated_at)
       VALUES (1, '2026-03-01', -100, 'row', 'completed', 'h', 0, 'c', 'u')`,
    );
    migrate(db);
    expect(levelThree(db)).toEqual(["Bus", "Specialty food", "Top-up", "Train", "Weekly shop"]);
  });

  it("an empty profile keeps them when it has a rule, and keeps one with a budget", () => {
    const withRule = databaseBefore(17);
    withRule
      .prepare("INSERT INTO rules (name, set_category_id, position, created_at, updated_at) VALUES ('Bus', ?, 1, '', '')")
      .run(idOf(withRule, "Bus"));
    migrate(withRule);
    expect(levelThree(withRule)).toHaveLength(5);

    const withBudget = databaseBefore(17);
    withBudget.prepare("UPDATE categories SET monthly_budget = 10000 WHERE id = ?").run(idOf(withBudget, "Train"));
    migrate(withBudget);
    expect(levelThree(withBudget)).toEqual(["Train"]);
  });
});
