import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "../db/migrations";
import { seedDemo } from "../demo";
import type { Db } from "../db";
import { NOW, bank, card, categoryId, charge, idOf, newDb, txn } from "../testing/ledger";
import { budgetStatus, budgetWeek, setBudget, weekOf, weeklyBudget } from "./budgets";
import { ingest } from "./ingest";
import { israelToday, periodSummary } from "./period";
import { trashTransactions, updateTransactions } from "./queries";

// A small made-up ledger. 2026-03-01 is a Sunday; 2026-03-29 to 04-04 is a
// week that crosses into April.
//
// Card 4321 (credit, billed by the bank on 03-10)
//   2026-02-26   -6,000 groceries       Groceries (February, billed 03-10)
//   2026-03-12   -4,000 groceries       Groceries
//   2026-03-14   +1,000 refund          Groceries
//   2026-03-18   -2,500 restaurant      Restaurants
//   2026-03-19   -8,000 groceries       Groceries, trashed
//   2026-03-20   -3,000 groceries       Groceries, excluded by the user
//   2026-03-30   -1,500 groceries       Groceries
//   2026-04-02   -2,000 groceries       Groceries
// Bank
//   2026-03-01  +100,000 salary         Salary (income)
//   2026-03-10    -6,000 card bill      internal: pays the February row
function ledger(): Db {
  const db = newDb();
  ingest(
    db,
    [
      card("4321", [
        charge("2026-02-26", -6000, "סופר פברואר", "2026-03-10"),
        charge("2026-03-12", -4000, "סופר מרץ", "2026-04-10"),
        charge("2026-03-14", 1000, "זיכוי סופר", "2026-04-10"),
        charge("2026-03-18", -2500, "מסעדה", "2026-04-10"),
        charge("2026-03-19", -8000, "סופר זבל", "2026-04-10"),
        charge("2026-03-20", -3000, "סופר בצד", "2026-04-10"),
        charge("2026-03-30", -1500, "סופר סוף חודש", "2026-04-10"),
        charge("2026-04-02", -2000, "סופר אפריל", "2026-05-10"),
      ]),
    ],
    { now: NOW },
  );
  ingest(
    db,
    [
      bank([
        txn({ date: "2026-03-01", amount: 100000, description: "משכורת" }),
        txn({ date: "2026-03-10", amount: -6000, description: "חיוב לכרטיס ויזה 4321" }),
      ]),
    ],
    { now: NOW },
  );
  const set = (description: string, category: string) =>
    updateTransactions(db, [idOf(db, description)], { categoryId: categoryId(db, category) });
  for (const d of ["סופר פברואר", "סופר מרץ", "זיכוי סופר", "סופר זבל", "סופר בצד", "סופר סוף חודש", "סופר אפריל"]) {
    set(d, "Groceries");
  }
  set("מסעדה", "Restaurants");
  set("משכורת", "Salary");
  trashTransactions(db, [idOf(db, "סופר זבל")]);
  updateTransactions(db, [idOf(db, "סופר בצד")], { excluded: true });
  return db;
}

const lineOf = (db: Db, args: { month: string; today: string }, name: string) =>
  budgetStatus(db, args).lines.find((l) => l.categoryId === categoryId(db, name));

describe("weeks", () => {
  it("start on Sunday and end on Saturday", () => {
    expect(weekOf("2026-03-01")).toEqual({ from: "2026-03-01", to: "2026-03-07" });
    expect(weekOf("2026-03-07")).toEqual({ from: "2026-03-01", to: "2026-03-07" });
    expect(weekOf("2026-03-08")).toEqual({ from: "2026-03-08", to: "2026-03-14" });
    expect(weekOf("2026-11-14")).toEqual({ from: "2026-11-08", to: "2026-11-14" });
  });

  it("may cross a month edge", () => {
    expect(weekOf("2026-03-31")).toEqual({ from: "2026-03-29", to: "2026-04-04" });
    expect(weekOf("2026-04-02")).toEqual({ from: "2026-03-29", to: "2026-04-04" });
  });

  it("is the week holding today this month, the last week for any other month", () => {
    expect(budgetWeek("2026-03", "2026-03-20")).toEqual({ from: "2026-03-15", to: "2026-03-21" });
    expect(budgetWeek("2026-02", "2026-03-20")).toEqual({ from: "2026-02-22", to: "2026-02-28" });
    expect(budgetWeek("2026-03", "2026-04-02")).toEqual({ from: "2026-03-29", to: "2026-04-04" });
  });
});

describe("weeklyBudget", () => {
  it("is the monthly budget divided by four, rounded down", () => {
    expect(weeklyBudget(1001)).toBe(250);
    expect(weeklyBudget(1003)).toBe(250);
    expect(weeklyBudget(1004)).toBe(251);
    expect(weeklyBudget(100000)).toBe(25000);
  });
});

describe("budgetStatus", () => {
  it("lists nothing when no category has a budget", () => {
    const status = budgetStatus(ledger(), { month: "2026-03", today: "2026-03-20" });
    expect(status).toEqual({
      month: "2026-03",
      week: { from: "2026-03-15", to: "2026-03-21" },
      currentMonth: true,
      lines: [],
    });
  });

  it("counts a subcategory: refunds lower it, trashed and excluded rows and card bills do not count", () => {
    const db = ledger();
    setBudget(db, categoryId(db, "Groceries"), 10001);
    // March: 4,000 - 1,000 + 1,500. The week 03-15 to 03-21 has only the trashed and excluded rows.
    expect(lineOf(db, { month: "2026-03", today: "2026-03-20" }, "Groceries")).toEqual({
      categoryId: categoryId(db, "Groceries"),
      monthlyBudget: 10001,
      spentMonth: 4500,
      weeklyBudget: 2500,
      spentWeek: 0,
    });
  });

  it("a group's spent includes its subcategories", () => {
    const db = ledger();
    setBudget(db, categoryId(db, "Food"), 20000);
    const food = lineOf(db, { month: "2026-03", today: "2026-03-20" }, "Food");
    expect(food).toMatchObject({ monthlyBudget: 20000, weeklyBudget: 5000, spentMonth: 4500 + 2500, spentWeek: 2500 });
  });

  it("a week crossing the month edge counts all its days; the month only its own", () => {
    const db = ledger();
    setBudget(db, categoryId(db, "Groceries"), 10000);
    // Today 04-02: the week is 03-29 to 04-04 with 1,500 in March and 2,000 in April.
    expect(lineOf(db, { month: "2026-04", today: "2026-04-02" }, "Groceries")).toMatchObject({ spentMonth: 2000, spentWeek: 3500 });
    // March, now a past month: its last week is the same one.
    expect(lineOf(db, { month: "2026-03", today: "2026-04-02" }, "Groceries")).toMatchObject({ spentMonth: 4500, spentWeek: 3500 });
  });

  it("a past month shows its last week", () => {
    const db = ledger();
    setBudget(db, categoryId(db, "Groceries"), 10000);
    const status = budgetStatus(db, { month: "2026-02", today: "2026-03-20" });
    expect(status.currentMonth).toBe(false);
    expect(status.week).toEqual({ from: "2026-02-22", to: "2026-02-28" });
    expect(status.lines[0]).toMatchObject({ spentMonth: 6000, spentWeek: 6000 });
  });

  it("refuses a malformed month or day", () => {
    const db = ledger();
    expect(() => budgetStatus(db, { month: "2026-13", today: "2026-03-20" })).toThrow("BAD_REQUEST");
    expect(() => budgetStatus(db, { month: "2026-03", today: "2026-03-32" })).toThrow("BAD_REQUEST");
  });
});

describe("setBudget", () => {
  it("sets and clears a budget", () => {
    const db = ledger();
    const id = categoryId(db, "Groceries");
    setBudget(db, id, 50000);
    expect(budgetStatus(db, { month: "2026-03", today: "2026-03-20" }).lines.map((l) => l.categoryId)).toEqual([id]);
    setBudget(db, id, null);
    expect(budgetStatus(db, { month: "2026-03", today: "2026-03-20" }).lines).toEqual([]);
  });

  it("rejects zero, negative, fractional and huge amounts, income categories and unknown ids", () => {
    const db = ledger();
    const id = categoryId(db, "Groceries");
    for (const amount of [0, -100, 10.5, Number.NaN, 1_000_000_001, "100"]) {
      expect(() => setBudget(db, id, amount as number)).toThrow("BAD_REQUEST");
    }
    expect(() => setBudget(db, categoryId(db, "Salary"), 10000)).toThrow("BAD_REQUEST");
    expect(() => setBudget(db, 99999, 10000)).toThrow("BAD_REQUEST");
    expect(() => setBudget(db, 0, 10000)).toThrow("BAD_REQUEST");
    expect(budgetStatus(db, { month: "2026-03", today: "2026-03-20" }).lines).toEqual([]);
  });

  it("the database refuses a budget on an income category too", () => {
    const db = ledger();
    expect(() => db.prepare("UPDATE categories SET monthly_budget = 100 WHERE id = ?").run(categoryId(db, "Salary"))).toThrow();
    expect(() => db.prepare("UPDATE categories SET monthly_budget = 0 WHERE id = ?").run(categoryId(db, "Groceries"))).toThrow();
  });
});

describe("on the Demo profile", () => {
  const TODAY = new Date("2026-11-14T10:00:00Z");

  it("spent matches Home's category totals for the same month", () => {
    const db = newDb();
    seedDemo(db, TODAY);
    const today = israelToday(TODAY);
    // Budget every spending category, groups too.
    const ids = (db.prepare("SELECT id FROM categories WHERE kind = 'expense'").all() as { id: number }[]).map((r) => r.id);
    for (const id of ids) setBudget(db, id, 100000);
    for (const month of ["2026-10", "2026-11"]) {
      const summary = periodSummary(db, { from: `${month}-01`, to: month === "2026-10" ? "2026-10-31" : "2026-11-30" }, { now: TODAY });
      const status = budgetStatus(db, { month, today });
      expect(status.lines).toHaveLength(ids.length);
      for (const line of status.lines) {
        const own = summary.byCategory.find((c) => c.categoryId === line.categoryId)?.amount ?? 0;
        const parent = summary.byParent.find((c) => c.categoryId === line.categoryId)?.amount;
        // A group's Home total is byParent (it and its subcategories); a subcategory's is its own.
        expect(line.spentMonth).toBe(parent ?? own);
      }
      expect(status.lines.some((l) => l.spentMonth > 0)).toBe(true);
    }
  });
});

describe("migration 0012", () => {
  function databaseAt11(): DatabaseSync {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    for (const m of MIGRATIONS.filter((x) => x.version <= 11)) {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '')").run(m.version);
    }
    db.exec(`INSERT INTO categories (parent_id, name, kind, emoji, color, sort_order) VALUES (NULL, 'Mine', 'expense', 'x', '#123456', 99)`);
    db.exec(`INSERT INTO accounts (id, provider, kind, account_number, created_at, sync_enabled) VALUES (3, 'discount', 'bank', '111', 'c', 1)`);
    db.exec(`INSERT INTO transactions (account_id, date, amount, description, status, category_id, dedup_hash, dedup_seq, created_at, updated_at)
      VALUES (3, '2026-03-01', -1000, 'coffee', 'completed', (SELECT id FROM categories WHERE name = 'Mine'), 'h1', 0, 'c', 'u')`);
    return db;
  }
  const all = (db: DatabaseSync, sql: string) => db.prepare(sql).all() as Record<string, unknown>[];

  it("keeps every category and row, with no budgets yet", () => {
    const db = databaseAt11();
    const categories = all(db, "SELECT * FROM categories ORDER BY id");
    const rows = all(db, "SELECT * FROM transactions ORDER BY id");
    // Only 0012: later migrations (spec 28) may add categories of their own.
    for (const m of MIGRATIONS.filter((x) => x.version === 12)) db.exec(m.sql);
    const after = all(db, "SELECT * FROM categories ORDER BY id");
    expect(after.map(({ monthly_budget, ...rest }) => (expect(monthly_budget).toBeNull(), rest))).toEqual(categories);
    expect(all(db, "SELECT * FROM transactions ORDER BY id")).toEqual(rows);
    expect(all(db, "PRAGMA foreign_key_check")).toEqual([]);
  });
});
