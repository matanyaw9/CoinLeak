// Three levels of categories (spec 34): a level 3 row counts in its parent's
// and its top-level category's totals, filters and budgets, and charts drill
// one level at a time.

import { beforeAll, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { NOW, bank, categoryId, idOf, newDb, txn } from "../testing/ledger";
import { budgetStatus, setBudget } from "./budgets";
import { createCategory } from "./categories";
import { ingest } from "./ingest";
import { groupFlow } from "./money-flow";
import { monthRange, periodSummary, periodTrend, spendingByChild } from "./period";
import { listCategories, listTransactions, updateTransactions } from "./queries";

// Food › Groceries › Weekly shop, with rows on all three levels:
//   Weekly shop  -1,000 and a +300 refund   (level 3)
//   Groceries    -2,000                     (level 2)
//   Food           -500                     (level 1)
//   Restaurants    -700                     (level 2)
// So Groceries is 2,700 with Weekly shop, and Food is 3,900 in all.
let db: Db;
let food: number;
let groceries: number;
let weekly: number;
let restaurants: number;

beforeAll(() => {
  db = newDb();
  food = categoryId(db, "Food");
  groceries = categoryId(db, "Groceries");
  restaurants = categoryId(db, "Restaurants");
  const made = createCategory(db, { name: "Weekly shop", kind: "expense", parentId: groceries, emoji: null, color: null });
  if (!made.ok) throw new Error(made.problem);
  weekly = made.category.id;

  const rows: [string, number, number][] = [
    ["SYNTH WEEKLY", -1000, weekly],
    ["SYNTH WEEKLY BACK", 300, weekly],
    ["SYNTH GROCER", -2000, groceries],
    ["SYNTH FOOD", -500, food],
    ["SYNTH DINER", -700, restaurants],
  ];
  ingest(db, [bank(rows.map(([description, amount], i) => txn({ date: `2026-03-0${i + 1}`, amount, description })))], {
    now: NOW,
  });
  for (const [description, , id] of rows) updateTransactions(db, [idOf(db, description)], { categoryId: id });
});

const march = monthRange("2026-03");
const until = "2026-04-01";

describe("three levels in the totals", () => {
  it("a level 3 row counts in its top-level category's roll-up", () => {
    const summary = periodSummary(db, march, { now: NOW });
    expect(summary.byParent).toContainEqual({ categoryId: food, amount: 3900, count: 5 });
    expect(summary.spending).toBe(3900);
  });

  it("the transactions filter: a category matches itself, its children and its grandchildren", () => {
    const count = (ids: number[]) => listTransactions(db, { categoryIds: ids }).length;
    expect(count([food])).toBe(5);
    expect(count([groceries])).toBe(3);
    expect(count([weekly])).toBe(2);
    expect(count([restaurants])).toBe(1);
  });

  it("a budget counts everything under its category", () => {
    setBudget(db, food, 100_000);
    setBudget(db, groceries, 50_000);
    setBudget(db, weekly, 10_000);
    const lines = budgetStatus(db, { month: "2026-03", today: "2026-03-31" }).lines;
    const spent = (id: number) => lines.find((l) => l.categoryId === id)?.spentMonth;
    expect(spent(food)).toBe(3900);
    expect(spent(groceries)).toBe(2700);
    expect(spent(weekly)).toBe(700);
  });
});

describe("one level at a time", () => {
  it("splits a category by its direct children, grandchildren included, plus its own rows", () => {
    expect(spendingByChild(db, march.from, until, food)).toEqual([
      { categoryId: groceries, amount: 2700, count: 3 },
      { categoryId: restaurants, amount: 700, count: 1 },
      { categoryId: food, amount: 500, count: 1 },
    ]);
    expect(spendingByChild(db, march.from, until, groceries)).toEqual([
      { categoryId: groceries, amount: 2000, count: 1 },
      { categoryId: weekly, amount: 700, count: 2 },
    ]);
    expect(spendingByChild(db, march.from, until, weekly)).toEqual([{ categoryId: weekly, amount: 700, count: 2 }]);
  });

  it("the money flow drills the same way, at every level", () => {
    const top = groupFlow(db, { ...march, categoryId: food });
    expect(top.total).toBe(3900);
    expect(top.nodes).toEqual([
      { kind: "group", categoryId: food, amount: 3900 },
      { kind: "spending", categoryId: groceries, amount: 2700 },
      { kind: "spending", categoryId: restaurants, amount: 700 },
      { kind: "spending", categoryId: food, amount: 500 },
    ]);
    const second = groupFlow(db, { ...march, categoryId: groceries });
    expect(second.nodes.map((n) => [n.kind, n.categoryId, n.amount])).toEqual([
      ["group", groceries, 2700],
      ["spending", groceries, 2000],
      ["spending", weekly, 700],
    ]);
  });

  it("the trend's chosen categories come split one level down", () => {
    const points = periodTrend(db, { ...march, categoryIds: [food] }, { now: NOW });
    const point = points.find((p) => p.month === "2026-03");
    expect(point?.byCategory).toEqual([{ categoryId: food, amount: 3900 }]);
    expect(point?.parts).toEqual([
      { categoryId: groceries, amount: 2700 },
      { categoryId: restaurants, amount: 700 },
      { categoryId: food, amount: 500 },
    ]);
  });
});

describe("listCategories", () => {
  it("lists depth first: each category right before its children", () => {
    const list = listCategories(db);
    const at = (id: number) => list.findIndex((c) => c.id === id);
    expect(at(groceries)).toBe(at(food) + 1);
    expect(at(weekly)).toBe(at(groceries) + 1);
    expect(at(restaurants)).toBe(at(weekly) + 1);
    // Every parent comes before its children.
    for (const c of list) if (c.parentId !== null) expect(at(c.parentId), c.name).toBeLessThan(at(c.id));
  });
});
