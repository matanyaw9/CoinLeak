import { describe, expect, it } from "vitest";
import { NOW, bank, categoryId, newDb, txn } from "../testing/ledger";
import { ingest } from "../ledger/ingest";

describe("ledger schema (0002)", () => {
  it("refuses a float in a money column", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-03-01", amount: -100, description: "x" })])], { now: NOW });
    expect(() => db.prepare("UPDATE transactions SET amount = 12.5").run()).toThrow();
    expect(() => db.prepare("UPDATE accounts SET balance = 0.1").run()).toThrow();
  });

  it("keeps dedup keys unique per account", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-03-01", amount: -100, description: "x" })])], { now: NOW });
    expect(() =>
      db.exec(
        `INSERT INTO transactions (account_id, date, amount, description, status, dedup_hash, dedup_seq, created_at, updated_at)
         SELECT account_id, date, amount, description, status, dedup_hash, dedup_seq, created_at, updated_at FROM transactions`,
      ),
    ).toThrow();
  });

  it("keeps categories to two levels of the same kind", () => {
    const db = newDb();
    const groceries = categoryId(db, "Groceries");
    const food = categoryId(db, "Food");
    const insert = db.prepare("INSERT INTO categories (parent_id, name, kind) VALUES (?, ?, ?)");
    expect(() => insert.run(groceries, "Too deep", "expense")).toThrow();
    expect(() => insert.run(food, "Wrong kind", "income")).toThrow();
    expect(() => db.prepare("UPDATE categories SET parent_id = ? WHERE id = ?").run(categoryId(db, "Lifestyle"), food)).toThrow();
    expect(insert.run(food, "Bakery", "expense").changes).toBe(1);
  });

  it("gives every card a mode and no bank a mode", () => {
    const db = newDb();
    const insert = db.prepare(
      "INSERT INTO accounts (provider, kind, account_number, card_mode, created_at) VALUES ('x', ?, ?, ?, '')",
    );
    expect(() => insert.run("card", "1111", null)).toThrow();
    expect(() => insert.run("bank", "2222", "credit")).toThrow();
  });
});
