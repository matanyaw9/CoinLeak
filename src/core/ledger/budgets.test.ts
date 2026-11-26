import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "../db/migrations";
import { seedDemo } from "../demo";
import { openDatabase, type Db } from "../db";
import { NOW, bank, card, categoryId, charge, idOf, newDb, txn } from "../testing/ledger";
import { BUDGET_MAX, budgetPlan, budgetStatus, budgetWeek, planMonths, setBudget, setBudgetTotal, weekOf, weeklyBudget } from "./budgets";
import { createCategory } from "./categories";
import { ingest } from "./ingest";
import { israelToday, periodSummary, spendingUnder } from "./period";
import { listCategories, trashTransactions, updateTransactions } from "./queries";

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
    // The Demo uses the current default categories (spec 28), so every migration runs.
    const db = openDatabase(":memory:");
    seedDemo(db, TODAY);
    const today = israelToday(TODAY);
    // Budget every spending category, groups too: parents first, each raised when its children need more.
    const ids = listCategories(db).filter((c) => c.kind === "expense").map((c) => c.id);
    for (const id of ids) setBudget(db, id, null);
    for (const id of ids) expect(setBudget(db, id, 100000, { raiseParents: true })).toEqual({ ok: true });
    for (const month of ["2026-10", "2026-11"]) {
      const summary = periodSummary(db, { from: `${month}-01`, to: month === "2026-10" ? "2026-10-31" : "2026-11-30" }, { now: TODAY });
      const status = budgetStatus(db, { month, today });
      expect(status.lines).toHaveLength(ids.length);
      for (const line of status.lines) {
        // Every category's Home total includes everything under it (spec 34); a group's is also its byParent.
        const under = summary.spendingUnder.find((c) => c.categoryId === line.categoryId)?.amount ?? 0;
        const parent = summary.byParent.find((c) => c.categoryId === line.categoryId)?.amount;
        expect(line.spentMonth).toBe(under);
        if (parent !== undefined) expect(line.spentMonth).toBe(parent);
      }
      expect(status.lines.some((l) => l.spentMonth > 0)).toBe(true);
    }
  });

  it("the Budgets page's spent matches Home's category totals, and usual is the last 3 full months (spec 37)", () => {
    const db = openDatabase(":memory:");
    seedDemo(db, TODAY);
    const today = israelToday(TODAY);
    const months = planMonths(db, today);
    expect(months).toEqual(["2026-08", "2026-09", "2026-10"]);
    const past = spendingUnder(db, "2026-08-01", "2026-11-01");
    for (const month of ["2026-10", "2026-11"]) {
      const summary = periodSummary(db, { from: `${month}-01`, to: month === "2026-10" ? "2026-10-31" : "2026-11-30" }, { now: TODAY });
      const plan = budgetPlan(db, { month, today });
      for (const line of plan.lines) {
        expect(line.spent).toBe(summary.spendingUnder.find((c) => c.categoryId === line.categoryId)?.amount ?? 0);
        const sum = past.find((c) => c.categoryId === line.categoryId)?.amount ?? 0;
        expect(line.usual).toBe(Math.round(sum / 3 / 100) * 100);
      }
      expect(plan.lines.some((l) => l.spent > 0)).toBe(true);
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

// ---- spec 37: the Budgets page ----

// Food › Groceries › Weekly shop (level 3), Food › Restaurants, Lifestyle › Shopping.
// Salary and spending in January to March, April is the chosen month:
//   income      Jan 9,000   Feb 9,000   Mar 12,000          average 10,000
//   Weekly shop Jan   300   Feb   300   Mar    600   Apr 120
//   Groceries                           Mar    150            (its own rows)
//   Restaurants             Feb    90                Apr 50 and a 20 refund
function planLedger(): Db {
  const db = newDb();
  const made = createCategory(db, { name: "Weekly shop", kind: "expense", parentId: categoryId(db, "Groceries"), emoji: null, color: null });
  if (!made.ok) throw new Error(made.problem);
  const rows: [string, string, number, string][] = [
    ["2026-01-10", "SYNTH PAY JAN", 900_000, "Salary"],
    ["2026-02-10", "SYNTH PAY FEB", 900_000, "Salary"],
    ["2026-03-10", "SYNTH PAY MAR", 1_200_000, "Salary"],
    ["2026-01-05", "SYNTH SHOP JAN", -30_000, "Weekly shop"],
    ["2026-02-05", "SYNTH SHOP FEB", -30_000, "Weekly shop"],
    ["2026-03-05", "SYNTH SHOP MAR", -60_000, "Weekly shop"],
    ["2026-03-08", "SYNTH GROCER MAR", -15_000, "Groceries"],
    ["2026-02-20", "SYNTH DINER FEB", -9_000, "Restaurants"],
    ["2026-04-02", "SYNTH SHOP APR", -12_000, "Weekly shop"],
    ["2026-04-03", "SYNTH DINER APR", -5_000, "Restaurants"],
    ["2026-04-04", "SYNTH DINER BACK", 2_000, "Restaurants"],
  ];
  ingest(db, [bank(rows.map(([date, description, amount]) => txn({ date, amount, description })))], { now: NOW });
  for (const [, description, , name] of rows) updateTransactions(db, [idOf(db, description)], { categoryId: categoryId(db, name) });
  return db;
}

const APRIL = { month: "2026-04", today: "2026-04-15" };
const planLine = (db: Db, name: string, args = APRIL) =>
  budgetPlan(db, args).lines.find((l) => l.categoryId === categoryId(db, name));
const budgetsNow = (db: Db) => db.prepare("SELECT id, monthly_budget FROM categories ORDER BY id").all();
const ok = { ok: true };

/** Total 5,000. Food 2,000 holds Groceries 1,200 (holding Weekly shop 500) and Restaurants 300; Shopping 1,000 is a top budget. */
function budgeted(db: Db): void {
  expect(setBudgetTotal(db, 500_000)).toEqual(ok);
  for (const [name, amount] of [
    ["Food", 200_000],
    ["Groceries", 120_000],
    ["Weekly shop", 50_000],
    ["Restaurants", 30_000],
    ["Shopping", 100_000],
  ] as const) {
    expect(setBudget(db, categoryId(db, name), amount)).toEqual(ok);
  }
}

describe("budgetPlan", () => {
  it("lists every spending category in tree order with its depth, and nothing else", () => {
    const db = planLedger();
    const lines = budgetPlan(db, APRIL).lines;
    const kinds = db.prepare("SELECT id, kind FROM categories").all() as { id: number; kind: string }[];
    const spending = new Set(kinds.filter((c) => c.kind === "expense").map((c) => c.id));
    expect(new Set(lines.map((l) => l.categoryId))).toEqual(spending);
    expect(lines).toHaveLength(spending.size);
    const at = (name: string) => lines.findIndex((l) => l.categoryId === categoryId(db, name));
    expect([at("Food"), at("Groceries"), at("Weekly shop"), at("Restaurants")]).toEqual([0, 1, 2, 3]);
    expect(lines.slice(0, 4).map((l) => l.depth)).toEqual([1, 2, 3, 2]);
  });

  it("has no total, no split and no budgets on a new profile", () => {
    const plan = budgetPlan(planLedger(), APRIL);
    expect(plan).toMatchObject({ month: "2026-04", total: null, split: 0, left: null });
    expect(plan.lines.every((l) => l.budget === null && l.inside === 0 && l.room === null)).toBe(true);
  });

  it("split counts only top budgets; left is the total minus the split", () => {
    const db = planLedger();
    budgeted(db);
    // Food and Shopping are top budgets; Groceries, Weekly shop and Restaurants sit inside Food.
    expect(budgetPlan(db, APRIL)).toMatchObject({ total: 500_000, split: 300_000, left: 200_000 });
  });

  it("a grandchild under an unbudgeted child counts toward the grandparent", () => {
    const db = planLedger();
    setBudget(db, categoryId(db, "Weekly shop"), 40_000);
    expect(budgetPlan(db, APRIL).split).toBe(40_000);
    setBudget(db, categoryId(db, "Food"), 100_000);
    expect(budgetPlan(db, APRIL).split).toBe(100_000);
    expect(planLine(db, "Food")).toMatchObject({ inside: 40_000, room: null });
    // Groceries has no budget: Weekly shop would sit inside it, so it is not counted beside it.
    expect(planLine(db, "Groceries")).toMatchObject({ budget: null, inside: 40_000, room: 100_000 });
    expect(planLine(db, "Weekly shop")).toMatchObject({ room: 100_000 });
    expect(planLine(db, "Restaurants")).toMatchObject({ room: 60_000 });
  });

  it("room at every level", () => {
    const db = planLedger();
    budgeted(db);
    // The total less the other top budgets.
    expect(planLine(db, "Food")).toMatchObject({ budget: 200_000, inside: 150_000, room: 400_000 });
    expect(planLine(db, "Shopping")).toMatchObject({ budget: 100_000, inside: 0, room: 300_000 });
    expect(planLine(db, "Transportation")).toMatchObject({ budget: null, inside: 0, room: 200_000 });
    // Lifestyle has no budget: Shopping would sit inside it.
    expect(planLine(db, "Lifestyle")).toMatchObject({ budget: null, inside: 100_000, room: 300_000 });
    // Food less its other budgeted children.
    expect(planLine(db, "Groceries")).toMatchObject({ budget: 120_000, weekly: 30_000, inside: 50_000, leftInside: 70_000, room: 170_000 });
    expect(planLine(db, "Transportation")).toMatchObject({ leftInside: null });
    expect(planLine(db, "Restaurants")).toMatchObject({ budget: 30_000, room: 80_000 });
    expect(planLine(db, "Coffee & Cafes")).toMatchObject({ budget: null, weekly: null, room: 50_000 });
    // Groceries less nothing else.
    expect(planLine(db, "Weekly shop")).toMatchObject({ budget: 50_000, room: 120_000 });
  });

  it("room is null when nothing above limits it", () => {
    const db = planLedger();
    budgeted(db);
    setBudgetTotal(db, null);
    expect(planLine(db, "Food")?.room).toBeNull();
    expect(planLine(db, "Shopping")?.room).toBeNull();
    expect(planLine(db, "Transportation")?.room).toBeNull();
    expect(planLine(db, "Groceries")?.room).toBe(170_000);
    expect(budgetPlan(db, APRIL)).toMatchObject({ total: null, split: 300_000, left: null });
  });

  it("usual and the averages are over the last 3 full months, everything under a category included", () => {
    const db = planLedger();
    const plan = budgetPlan(db, APRIL);
    expect(plan.averageIncome).toEqual({ from: "2026-01", to: "2026-03", count: 3, amount: 1_000_000 });
    expect(plan.averageSpending).toEqual({ from: "2026-01", to: "2026-03", count: 3, amount: 48_000 });
    expect(planLine(db, "Weekly shop")?.usual).toBe(40_000);
    expect(planLine(db, "Groceries")?.usual).toBe(45_000);
    expect(planLine(db, "Restaurants")?.usual).toBe(3_000);
    expect(planLine(db, "Food")?.usual).toBe(48_000);
    expect(planLine(db, "Shopping")?.usual).toBe(0);
  });

  it("the averages follow today's month, not the chosen one", () => {
    const db = planLedger();
    const march = budgetPlan(db, { month: "2026-03", today: "2026-04-15" });
    expect(march.averageIncome?.amount).toBe(1_000_000);
    expect(march.lines.find((l) => l.categoryId === categoryId(db, "Weekly shop"))?.spent).toBe(60_000);
  });

  it("with 1 month of history the averages are that month", () => {
    const db = planLedger();
    const args = { month: "2026-02", today: "2026-02-15" };
    const plan = budgetPlan(db, args);
    expect(plan.averageIncome).toEqual({ from: "2026-01", to: "2026-01", count: 1, amount: 900_000 });
    expect(plan.averageSpending).toEqual({ from: "2026-01", to: "2026-01", count: 1, amount: 30_000 });
    expect(planLine(db, "Groceries", args)?.usual).toBe(30_000);
    expect(planLine(db, "Restaurants", args)?.usual).toBe(0);
  });

  it("rounds the averages and usual to whole shekels", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-01-05", amount: -1_051, description: "SYNTH ODD" }), txn({ date: "2026-01-06", amount: 2_049, description: "SYNTH ODD PAY" })])], { now: NOW });
    updateTransactions(db, [idOf(db, "SYNTH ODD")], { categoryId: categoryId(db, "Shopping") });
    updateTransactions(db, [idOf(db, "SYNTH ODD PAY")], { categoryId: categoryId(db, "Salary") });
    const args = { month: "2026-02", today: "2026-02-15" };
    const plan = budgetPlan(db, args);
    expect(plan.averageSpending?.amount).toBe(1_100);
    expect(plan.averageIncome?.amount).toBe(2_000);
    expect(planLine(db, "Shopping", args)?.usual).toBe(1_100);
  });

  it("with no full month of history there are no averages and no usual", () => {
    const db = planLedger();
    const plan = budgetPlan(db, { month: "2026-01", today: "2026-01-20" });
    expect(plan.averageIncome).toBeNull();
    expect(plan.averageSpending).toBeNull();
    expect(plan.lines.every((l) => l.usual === null)).toBe(true);
    expect(budgetPlan(newDb(), APRIL).averageIncome).toBeNull();
  });

  it("spent is the chosen month, refunds lowering it, everything under a category included", () => {
    const db = planLedger();
    expect(planLine(db, "Weekly shop")?.spent).toBe(12_000);
    expect(planLine(db, "Restaurants")?.spent).toBe(3_000);
    expect(planLine(db, "Food")?.spent).toBe(15_000);
    expect(planLine(db, "Shopping")?.spent).toBe(0);
  });

  it("refuses a malformed month or day", () => {
    const db = planLedger();
    expect(() => budgetPlan(db, { month: "2026-13", today: "2026-04-15" })).toThrow("BAD_REQUEST");
    expect(() => budgetPlan(db, { month: "2026-04", today: "2026-04-31" })).toThrow("BAD_REQUEST");
    expect(() => budgetPlan(db, null as never)).toThrow("BAD_REQUEST");
  });
});

describe("the budget rules (spec 37)", () => {
  it("over_parent: more than the nearest budgeted parent has left", () => {
    const db = planLedger();
    budgeted(db);
    const before = budgetsNow(db);
    // Food 2,000 less Groceries 1,200 leaves 800 for Restaurants.
    expect(setBudget(db, categoryId(db, "Restaurants"), 100_000)).toEqual({
      ok: false,
      problem: { code: "over_parent", parentId: categoryId(db, "Food"), room: 80_000, raises: [{ categoryId: categoryId(db, "Food"), to: 220_000 }] },
    });
    expect(budgetsNow(db)).toEqual(before);
    expect(setBudget(db, categoryId(db, "Restaurants"), 80_000)).toEqual(ok);
  });

  it("over_parent: a grandchild under an unbudgeted child counts against the grandparent", () => {
    const db = planLedger();
    setBudget(db, categoryId(db, "Food"), 100_000);
    setBudget(db, categoryId(db, "Restaurants"), 70_000);
    expect(setBudget(db, categoryId(db, "Weekly shop"), 40_000)).toMatchObject({
      ok: false,
      problem: { code: "over_parent", parentId: categoryId(db, "Food"), room: 30_000 },
    });
  });

  it("a parent already over (old budgets, or a moved category) still lets a child go down, not up", () => {
    const db = planLedger();
    setBudget(db, categoryId(db, "Food"), 100_000);
    // Spec 27 allowed this: children 800 + 600 under Food 1,000.
    db.prepare("UPDATE categories SET monthly_budget = ? WHERE id = ?").run(80_000, categoryId(db, "Groceries"));
    db.prepare("UPDATE categories SET monthly_budget = ? WHERE id = ?").run(60_000, categoryId(db, "Restaurants"));
    expect(setBudget(db, categoryId(db, "Restaurants"), 50_000)).toEqual(ok);
    expect(planLine(db, "Food")).toMatchObject({ inside: 130_000, leftInside: -30_000 });
    expect(setBudget(db, categoryId(db, "Restaurants"), 50_001)).toMatchObject({ ok: false, problem: { code: "over_parent" } });
  });

  it("a total already over still lets a top budget go down, not up", () => {
    const db = planLedger();
    expect(setBudgetTotal(db, 150_000)).toEqual(ok);
    setBudget(db, categoryId(db, "Shopping"), 50_000);
    // As if a budgeted category moved to the top: the split is 2,100 under a total of 1,500.
    db.prepare("UPDATE categories SET monthly_budget = ? WHERE id = ?").run(160_000, categoryId(db, "Food"));
    expect(setBudget(db, categoryId(db, "Shopping"), 40_000)).toEqual(ok);
    expect(setBudget(db, categoryId(db, "Shopping"), 40_001)).toMatchObject({ ok: false, problem: { code: "over_total" } });
  });

  it("over_total: top budgets more than the total", () => {
    const db = planLedger();
    budgeted(db);
    const before = budgetsNow(db);
    expect(setBudget(db, categoryId(db, "Shopping"), 350_000)).toEqual({
      ok: false,
      problem: { code: "over_total", room: 300_000, raises: [{ categoryId: null, to: 550_000 }] },
    });
    // A new top budget: Transportation has room for what is left.
    expect(setBudget(db, categoryId(db, "Transportation"), 200_001)).toMatchObject({ ok: false, problem: { code: "over_total", room: 200_000 } });
    expect(budgetsNow(db)).toEqual(before);
    expect(budgetPlan(db, APRIL).total).toBe(500_000);
  });

  it("under_children: less than the budgets under it add up to", () => {
    const db = planLedger();
    budgeted(db);
    const before = budgetsNow(db);
    expect(setBudget(db, categoryId(db, "Groceries"), 40_000)).toEqual({ ok: false, problem: { code: "under_children", inside: 50_000 } });
    expect(setBudget(db, categoryId(db, "Food"), 140_000, { raiseParents: true })).toEqual({
      ok: false,
      problem: { code: "under_children", inside: 150_000 },
    });
    // A new budget above budgeted children takes them inside.
    expect(setBudget(db, categoryId(db, "Lifestyle"), 90_000)).toEqual({ ok: false, problem: { code: "under_children", inside: 100_000 } });
    expect(budgetsNow(db)).toEqual(before);
  });

  it("under_split: a total less than the top budgets add up to", () => {
    const db = planLedger();
    budgeted(db);
    expect(setBudgetTotal(db, 250_000)).toEqual({ ok: false, problem: { code: "under_split", split: 300_000 } });
    expect(budgetPlan(db, APRIL).total).toBe(500_000);
    expect(setBudgetTotal(db, 300_000)).toEqual(ok);
    expect(budgetPlan(db, APRIL)).toMatchObject({ total: 300_000, left: 0 });
  });

  it("clearing a budget or the total always works", () => {
    const db = planLedger();
    budgeted(db);
    expect(setBudget(db, categoryId(db, "Groceries"), null)).toEqual(ok);
    // Weekly shop now sits right under Food.
    expect(planLine(db, "Food")).toMatchObject({ inside: 80_000 });
    expect(setBudget(db, categoryId(db, "Food"), null)).toEqual(ok);
    expect(budgetPlan(db, APRIL).split).toBe(180_000);
    expect(setBudgetTotal(db, null)).toEqual(ok);
    expect(budgetPlan(db, APRIL)).toMatchObject({ total: null, left: null });
  });

  it("raiseParents raises a parent, a grandparent and the total, in one go", () => {
    const db = planLedger();
    // Total 3,000: Food 2,000 (Groceries 1,200 with Weekly shop 500, Restaurants 600) and Shopping 1,000.
    budgeted(db);
    setBudget(db, categoryId(db, "Restaurants"), 60_000);
    expect(setBudgetTotal(db, 300_000)).toEqual(ok);
    const weekly = categoryId(db, "Weekly shop");
    const raises = [
      { categoryId: categoryId(db, "Groceries"), to: 150_000 },
      { categoryId: categoryId(db, "Food"), to: 210_000 },
      { categoryId: null, to: 310_000 },
    ];
    expect(setBudget(db, weekly, 150_000)).toEqual({
      ok: false,
      problem: { code: "over_parent", parentId: categoryId(db, "Groceries"), room: 120_000, raises },
    });
    expect(setBudget(db, weekly, 150_000, { raiseParents: true })).toEqual(ok);
    expect(budgetPlan(db, APRIL)).toMatchObject({ total: 310_000, split: 310_000, left: 0 });
    expect(planLine(db, "Weekly shop")?.budget).toBe(150_000);
    expect(planLine(db, "Groceries")?.budget).toBe(150_000);
    expect(planLine(db, "Food")?.budget).toBe(210_000);
    expect(planLine(db, "Shopping")?.budget).toBe(100_000);
  });

  it("raiseParents changes nothing when a step is refused", () => {
    const db = planLedger();
    budgeted(db);
    const before = budgetsNow(db);
    // Food would go past the largest budget allowed.
    expect(() => setBudget(db, categoryId(db, "Groceries"), BUDGET_MAX, { raiseParents: true })).toThrow("BAD_REQUEST");
    expect(budgetsNow(db)).toEqual(before);
    expect(budgetPlan(db, APRIL).total).toBe(500_000);
    // Less than the budgets inside: no raise helps.
    expect(setBudget(db, categoryId(db, "Groceries"), 10_000, { raiseParents: true })).toMatchObject({ ok: false });
    expect(budgetsNow(db)).toEqual(before);
  });

  it("raiseParents with nothing to raise just sets the budget", () => {
    const db = planLedger();
    budgeted(db);
    expect(setBudget(db, categoryId(db, "Restaurants"), 40_000, { raiseParents: true })).toEqual(ok);
    expect(planLine(db, "Food")?.budget).toBe(200_000);
  });

  it("refuses a malformed total or raiseParents", () => {
    const db = planLedger();
    for (const total of [0, -100, 10.5, BUDGET_MAX + 1, "100"]) {
      expect(() => setBudgetTotal(db, total as number)).toThrow("BAD_REQUEST");
    }
    expect(() => setBudget(db, categoryId(db, "Food"), 100, { raiseParents: "yes" as never })).toThrow("BAD_REQUEST");
    expect(() => setBudget(db, categoryId(db, "Food"), 100, null as never)).toThrow("BAD_REQUEST");
    expect(budgetPlan(db, APRIL).total).toBeNull();
  });
});
