// Migration 0013 (spec 28): routine and treat categories, on a fresh
// database and on one the user already shaped.

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrate, openDatabase } from "./index";
import { MIGRATIONS } from "./migrations";

interface Row {
  id: number;
  parent_id: number | null;
  name: string;
  kind: string;
  emoji: string | null;
  essential: number | null;
  parent: string | null;
}

const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all();
const WITH_PARENT = `SELECT c.*, p.name AS parent FROM categories c LEFT JOIN categories p ON p.id = c.parent_id ORDER BY c.id`;

/** The expense layout: each group in order with its children in order, (R) routine, (T) treat. */
function layout(db: DatabaseSync): string[] {
  const rows = all(
    db,
    `SELECT c.name, c.essential, c.parent_id FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
     WHERE c.kind = 'expense'
     ORDER BY COALESCE(p.sort_order, c.sort_order), COALESCE(p.id, c.id), c.parent_id IS NOT NULL, c.sort_order, c.name`,
  ) as { name: string; essential: number | null; parent_id: number | null }[];
  return rows.map((r) => (r.parent_id === null ? r.name : `  ${r.name} (${r.essential === 1 ? "R" : "T"})`));
}

const FRESH_LAYOUT = [
  "Groceries & Shop",
  "  Groceries (R)",
  "  Local shop (R)",
  "Eating out & Treats",
  "  Restaurants (T)",
  "  Coffee & Cafes (T)",
  "  Bars (T)",
  "  Small treats (T)",
  "Shopping",
  "  Online shopping (T)",
  "  Clothes & Shoes (T)",
  "  Other shopping (T)",
  "Transportation",
  "  Transport (R)",
  "  Travel (T)",
  "  Fuel (R)",
  "  Parking (R)",
  "Lifestyle",
  "  Entertainment (T)",
  "  Personal Care (T)",
  "  Sports & Hobbies (T)",
  "  Vacation (T)",
  "  Impulsive buying (T)",
  "Home & Bills",
  "  Bills & Utilities (R)",
  "  Home (R)",
  "  Insurance (R)",
  "  Subscriptions (T)",
  "Health & Family",
  "  Health (R)",
  "  Education (R)",
  "  Kids & Childcare (R)",
  "  Pet Care (R)",
  "Work",
  "  Work equipment (R)",
  "  Work travel (R)",
  "  Work meals (R)",
  "  Courses & training (R)",
  "Money Movement",
  "  Cash & ATM (R)",
  "  Transfers (R)",
  "  Gifts & Donations (T)",
  "  Fees & Taxes (R)",
];

/** A database as it stood before 0013 (every earlier migration that exists here). */
function databaseBefore13(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const m of MIGRATIONS.filter((x) => x.version < 13)) {
    db.exec(m.sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '')").run(m.version);
  }
  return db;
}

const idOf = (db: DatabaseSync, name: string, parent?: string): number => {
  const rows = (all(db, WITH_PARENT) as Row[]).filter((r) => r.name === name && (parent === undefined || r.parent === parent));
  if (rows.length !== 1) throw new Error(`expected one ${name}, found ${rows.length}`);
  return (rows[0] as Row).id;
};

/** The old defaults with the user's changes, rows and rules. */
function userShaped(): DatabaseSync {
  const db = databaseBefore13();
  db.prepare("UPDATE categories SET name = 'Eating' WHERE name = 'Food' AND parent_id IS NULL").run();
  db.prepare("DELETE FROM categories WHERE name = 'Bars'").run();
  db.prepare("INSERT INTO categories (parent_id, name, kind, emoji, sort_order, essential) VALUES (?, 'Board games', 'expense', '🎲', 9, 0)").run(
    idOf(db, "Lifestyle"),
  );
  db.exec(`INSERT INTO accounts (provider, kind, account_number, created_at) VALUES ('discount', 'bank', '1', '')`);
  const insert = db.prepare(
    `INSERT INTO transactions (account_id, date, amount, description, status, category_id, category_source,
       dedup_hash, dedup_seq, created_at, updated_at)
     VALUES (1, '2026-03-01', -100, ?, 'completed', ?, 'user', ?, 0, 'c', 'u')`,
  );
  const rule = db.prepare(
    `INSERT INTO rules (name, position, join_mode, set_category_id, created_at, updated_at) VALUES (?, ?, 'all', ?, '', '')`,
  );
  for (const [i, [name, parent]] of [["Groceries", "Eating"], ["Shopping", "Lifestyle"], ["Board games", "Lifestyle"]].entries()) {
    const id = idOf(db, name as string, parent);
    insert.run(`row ${i}`, id, `h${i}`);
    rule.run(`rule ${i}`, i + 1, id);
  }
  return db;
}

describe("migration 0013 (routine and treat categories)", () => {
  it("on a fresh database gives exactly the new layout", () => {
    const db = openDatabase(":memory:");
    expect(layout(db)).toEqual(FRESH_LAYOUT);
    // Groups keep no routine or treat flag.
    for (const r of all(db, WITH_PARENT) as Row[]) if (r.parent_id === null) expect(r.essential, r.name).toBeNull();
    // Every new category has an emoji and a color, and Other shopping no longer shares its group's emoji.
    const blank = all(db, "SELECT name FROM categories WHERE emoji IS NULL OR color IS NULL");
    expect(blank).toEqual([]);
    const emoji = (name: string) => (all(db, WITH_PARENT) as Row[]).find((r) => r.name === name && r.parent_id !== null)?.emoji;
    expect(emoji("Other shopping")).toBe("🏷️");
  });

  it("keeps ids: Groceries and Shopping moved, not remade", () => {
    const before = databaseBefore13();
    const groceries = idOf(before, "Groceries");
    const shopping = idOf(before, "Shopping", "Lifestyle");
    const food = idOf(before, "Food");
    migrate(before);
    expect(idOf(before, "Groceries", "Groceries & Shop")).toBe(groceries);
    expect(idOf(before, "Other shopping", "Shopping")).toBe(shopping);
    expect(idOf(before, "Eating out & Treats")).toBe(food);
  });

  it("on a database the user shaped: ids kept, rows and rules still attached, user changes untouched", () => {
    const db = userShaped();
    const groceries = idOf(db, "Groceries");
    const shopping = idOf(db, "Shopping", "Lifestyle");
    const boardGames = idOf(db, "Board games");
    const rowsBefore = all(db, "SELECT id, category_id FROM transactions ORDER BY id");
    const rulesBefore = all(db, "SELECT id, set_category_id FROM rules ORDER BY id");

    migrate(db);

    expect(all(db, "SELECT id, category_id FROM transactions ORDER BY id")).toEqual(rowsBefore);
    expect(all(db, "SELECT id, set_category_id FROM rules ORDER BY id")).toEqual(rulesBefore);
    expect(all(db, "PRAGMA foreign_key_check")).toEqual([]);

    // The renamed Food: not renamed again, keeps Groceries, gets no Small treats.
    expect(idOf(db, "Groceries", "Eating")).toBe(groceries);
    expect(all(db, "SELECT 1 FROM categories WHERE name IN ('Eating out & Treats', 'Small treats', 'Bars')")).toEqual([]);
    // Shopping moved with its id; the user's own Lifestyle category stays put.
    expect(idOf(db, "Other shopping", "Shopping")).toBe(shopping);
    expect(idOf(db, "Board games", "Lifestyle")).toBe(boardGames);
    // The new groups are there, Groceries & Shop with only its new category.
    const children = (group: string) =>
      (all(db, `${WITH_PARENT.replace("ORDER BY c.id", "ORDER BY c.sort_order, c.id")}`) as Row[])
        .filter((r) => r.parent === group)
        .map((r) => r.name);
    expect(children("Groceries & Shop")).toEqual(["Local shop"]);
    expect(children("Shopping")).toEqual(["Online shopping", "Clothes & Shoes", "Other shopping"]);
    expect(children("Work")).toHaveLength(4);
    // No duplicates anywhere.
    const names = (all(db, WITH_PARENT) as Row[]).map((r) => `${r.parent}/${r.name.toLowerCase()}`);
    expect(new Set(names).size).toBe(names.length);
  });

  it("skips a name already under its target group, and reuses a group the user already has", () => {
    const db = databaseBefore13();
    db.prepare("INSERT INTO categories (name, kind, emoji, sort_order) VALUES ('work', 'expense', '🏢', 7)").run();
    db.prepare("INSERT INTO categories (parent_id, name, kind, sort_order, essential) VALUES (?, 'WORK MEALS', 'expense', 1, 1)").run(
      idOf(db, "work"),
    );
    migrate(db);
    expect(all(db, "SELECT 1 FROM categories WHERE name = 'Work'")).toEqual([]);
    const children = (all(db, WITH_PARENT) as Row[]).filter((r) => r.parent === "work").map((r) => r.name);
    expect(children).toEqual(["WORK MEALS", "Work equipment", "Work travel", "Courses & training"]);
  });

  it("runs after a migration that adds a column to categories (spec 27's 0012)", () => {
    const db = databaseBefore13();
    db.exec("ALTER TABLE categories ADD COLUMN extra_from_0012 INTEGER");
    migrate(db);
    expect(layout(db)).toEqual(FRESH_LAYOUT);
  });

  it("runs once: migrating again changes nothing", () => {
    const db = openDatabase(":memory:");
    const once = all(db, "SELECT * FROM categories ORDER BY id");
    migrate(db);
    expect(all(db, "SELECT * FROM categories ORDER BY id")).toEqual(once);
  });
});
