// Migration 0009 (spec 18): essential or extra flags and the new default
// categories, on a fresh database and on one the user already shaped.

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { migrate, openDatabase } from "./index";
import { MIGRATIONS } from "./migrations";

const ESSENTIAL = [
  "Groceries", "Transport", "Fuel", "Parking", "Bills & Utilities", "Home", "Insurance", "Health",
  "Education", "Kids & Childcare", "Pet Care", "Cash & ATM", "Transfers",
];
const EXTRA = [
  "Restaurants", "Coffee & Cafes", "Bars", "Entertainment", "Shopping", "Travel", "Vacation",
  "Impulsive buying", "Sports & Hobbies", "Personal Care", "Subscriptions", "Gifts & Donations",
];

interface Row {
  id: number;
  parent_id: number | null;
  name: string;
  kind: string;
  emoji: string | null;
  color: string | null;
  archived: number;
  sort_order: number;
  essential?: number | null;
  parent?: string | null;
}

const all = (db: DatabaseSync, sql: string): unknown[] => db.prepare(sql).all();
const WITH_PARENT = `SELECT c.*, p.name AS parent FROM categories c LEFT JOIN categories p ON p.id = c.parent_id ORDER BY c.id`;
const OLD_COLUMNS = "SELECT id, parent_id, name, kind, emoji, color, archived, sort_order FROM categories ORDER BY id";

function byName(db: DatabaseSync, name: string): Row[] {
  return all(db, WITH_PARENT).filter((r) => (r as Row).name === name) as Row[];
}

// A database as it stood before 0009, with the user's changes in it.
function databaseAt8(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const m of MIGRATIONS.filter((x) => x.version <= 8)) {
    db.exec(m.sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '')").run(m.version);
  }
  return db;
}

function userShaped(): DatabaseSync {
  const db = databaseAt8();
  const id = (name: string) => (db.prepare("SELECT id FROM categories WHERE name = ?").get(name) as { id: number }).id;
  // Renamed group: Transportation gets none of its additions.
  db.prepare("UPDATE categories SET name = 'Getting around', emoji = '🛵' WHERE name = 'Transportation'").run();
  // The user's own "Bars" under Food, in another case, and a "Vacation" moved under Food.
  db.prepare("INSERT INTO categories (parent_id, name, kind, emoji, color, sort_order) VALUES (?, 'BARS', 'expense', '🥂', '#123456', 7)").run(id("Food"));
  db.prepare("UPDATE categories SET parent_id = ?, name = 'Vacation' WHERE name = 'Travel'").run(id("Food"));
  // A brand new group and child of the user's, and a rename of a seeded child.
  db.prepare("INSERT INTO categories (name, kind, emoji, sort_order) VALUES ('Garden', 'expense', '🌱', 9)").run();
  db.prepare("INSERT INTO categories (parent_id, name, kind, sort_order) VALUES (?, 'Seeds', 'expense', 1)").run(id("Garden"));
  db.prepare("UPDATE categories SET name = 'Eating out' WHERE name = 'Restaurants'").run();
  db.exec(`INSERT INTO accounts (provider, kind, account_number, created_at) VALUES ('discount', 'bank', '1', '')`);
  const insert = db.prepare(
    `INSERT INTO transactions (account_id, date, amount, description, status, category_id, category_source,
       dedup_hash, dedup_seq, created_at, updated_at)
     VALUES (1, '2026-03-01', ?, ?, 'completed', (SELECT id FROM categories WHERE name = ?), 'user', ?, 0, 'c', 'u')`,
  );
  for (const [i, name] of ["BARS", "Vacation", "Transport", "Seeds", "Eating out", "Salary"].entries()) {
    insert.run(-100 * (i + 1), `row ${i}`, name, `h${i}`);
  }
  return db;
}

describe("migration 0009 (essential categories)", () => {
  it("on a fresh database flags every seeded category as listed and adds the new ones in place", () => {
    const db = openDatabase(":memory:");
    for (const name of ESSENTIAL) expect(byName(db, name).map((r) => r.essential), name).toEqual([1]);
    for (const name of EXTRA) expect(byName(db, name).map((r) => r.essential), name).toEqual([0]);
    // Not in either list: a spending subcategory, so essential by default.
    expect(byName(db, "Fees & Taxes")[0]?.essential).toBe(1);

    const rows = all(db, WITH_PARENT) as Row[];
    for (const r of rows) {
      if (r.parent_id === null || r.kind !== "expense") expect(r.essential, r.name).toBeNull();
    }

    const placed = (name: string) => byName(db, name).map((r) => [r.parent, r.emoji]);
    expect(placed("Fuel")).toEqual([["Transportation", "⛽"]]);
    expect(placed("Parking")).toEqual([["Transportation", "🅿️"]]);
    expect(placed("Bars")).toEqual([["Food", "🍺"]]);
    expect(placed("Vacation")).toEqual([["Lifestyle", "🏖️"]]);
    expect(placed("Impulsive buying")).toEqual([["Lifestyle", "⚡"]]);
    expect(byName(db, "Impulsive buying")[0]?.emoji).not.toBe(byName(db, "Shopping")[0]?.emoji);
  });

  it("puts the new categories after the group's own, in the listed order", () => {
    const db = openDatabase(":memory:");
    const order = (parent: string) =>
      (all(db, `SELECT c.name FROM categories c JOIN categories p ON p.id = c.parent_id WHERE p.name = '${parent}' ORDER BY c.sort_order`) as { name: string }[]).map((r) => r.name);
    expect(order("Transportation")).toEqual(["Transport", "Travel", "Fuel", "Parking"]);
    expect(order("Food").slice(-1)).toEqual(["Bars"]);
    expect(order("Lifestyle").slice(-2)).toEqual(["Vacation", "Impulsive buying"]);
  });

  it("on a database the user shaped: nothing duplicated, moved or renamed, every row keeps its category", () => {
    const db = userShaped();
    const before = all(db, OLD_COLUMNS) as Row[];
    const transactions = all(db, "SELECT * FROM transactions ORDER BY id");

    migrate(db);

    // Every category the user had is exactly as it was.
    const after = all(db, OLD_COLUMNS) as Row[];
    expect(after.slice(0, before.length)).toEqual(before);
    expect(all(db, "SELECT * FROM transactions ORDER BY id").map(withoutSource)).toEqual(transactions);
    expect(all(db, "PRAGMA foreign_key_check")).toEqual([]);

    // Added: only Lifestyle's Vacation and Impulsive buying. Food has BARS, the
    // renamed Transportation gets neither Fuel nor Parking.
    const added = (all(db, WITH_PARENT) as Row[]).slice(before.length).map((r) => [r.parent, r.name]);
    expect(added).toEqual([
      ["Lifestyle", "Vacation"],
      ["Lifestyle", "Impulsive buying"],
    ]);
    expect(byName(db, "Fuel")).toEqual([]);
    expect(byName(db, "Parking")).toEqual([]);
    expect(byName(db, "Bars")).toEqual([]);
    expect(byName(db, "BARS").map((r) => [r.parent, r.emoji, r.color])).toEqual([["Food", "🥂", "#123456"]]);

    // Flags: the user's own spending subcategories start essential; seeded
    // names keep their listed flag wherever they sit; groups and income stay null.
    const flag = (name: string) => byName(db, name).map((r) => r.essential);
    expect(flag("Seeds")).toEqual([1]);
    expect(flag("Eating out")).toEqual([1]);
    expect(flag("Transport")).toEqual([1]);
    expect(flag("Vacation")).toEqual([0, 0]);
    expect(flag("Garden")).toEqual([null]);
    expect(flag("Getting around")).toEqual([null]);
    expect(flag("Salary")).toEqual([null]);
  });

  it("runs once: migrating again changes nothing", () => {
    const db = openDatabase(":memory:");
    const once = all(db, "SELECT * FROM categories ORDER BY id");
    migrate(db);
    expect(all(db, "SELECT * FROM categories ORDER BY id")).toEqual(once);
  });
});

// 0010 (spec 20) adds `transactions.source` later; every column before it must hold.
function withoutSource(row: unknown): unknown {
  const rest = { ...(row as Record<string, unknown>) };
  delete rest.source;
  return rest;
}
