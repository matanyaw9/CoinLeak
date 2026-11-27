import { describe, expect, it } from "vitest";
import type { CategoryInput } from "@shared/types";
import { CodedError } from "@shared/errors";
import type { Db } from "../db";
import { NOW, bank, categoryId, idOf, newDb, stored, txn } from "../testing/ledger";
import { ruleInput } from "../testing/rules";
import { createRule, listRules } from "../rules";
import { budgetPlan, setBudget } from "./budgets";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./categories";
import { ingest } from "./ingest";
import { updateTransactions } from "./edits";
import { monthSummary } from "./queries";

const input = (over: Partial<CategoryInput> = {}): CategoryInput => ({
  name: "Books",
  kind: "expense",
  parentId: null,
  emoji: "📚",
  color: "#aabbcc",
  ...over,
});

function created(db: Db, over: Partial<CategoryInput> = {}): number {
  const res = createCategory(db, input(over));
  if (!res.ok) throw new Error(res.problem);
  return res.category.id;
}

function badRequest(fn: () => unknown): void {
  expect(fn).toThrow(CodedError);
  try {
    fn();
  } catch (e) {
    expect((e as CodedError).code).toBe("BAD_REQUEST");
  }
}

describe("createCategory", () => {
  it("adds a top-level category and a subcategory under it", () => {
    const db = newDb();
    const top = createCategory(db, input({ name: "  Hobbies  " }));
    expect(top).toMatchObject({ ok: true, category: { name: "Hobbies", parentId: null, kind: "expense", color: "#AABBCC" } });
    const meta = top.ok ? top.category.id : 0;
    const child = createCategory(db, input({ name: "Books", parentId: meta }));
    expect(child).toMatchObject({ ok: true, category: { name: "Books", parentId: meta, emoji: "📚", rowCount: 0, ruleCount: 0 } });
    const list = listCategories(db);
    expect(list.findIndex((c) => c.name === "Books")).toBe(list.findIndex((c) => c.name === "Hobbies") + 1);
  });

  it("adds an income category", () => {
    const db = newDb();
    expect(createCategory(db, input({ name: "Rent from flat", kind: "income" }))).toMatchObject({
      ok: true,
      category: { kind: "income" },
    });
  });

  it("refuses a name already used at the same level, ignoring case", () => {
    const db = newDb();
    expect(createCategory(db, input({ name: "food" }))).toEqual({ ok: false, problem: "name_taken" });
    // Same name under another parent is fine.
    expect(createCategory(db, input({ name: "Groceries", parentId: categoryId(db, "Lifestyle") })).ok).toBe(true);
  });

  it("nests three levels: a level 2 category holds one, a level 3 category does not", () => {
    const db = newDb();
    const weekly = created(db, { name: "Weekly shop", parentId: categoryId(db, "Groceries") });
    const list = listCategories(db);
    expect(list.findIndex((c) => c.id === weekly)).toBe(list.findIndex((c) => c.name === "Groceries") + 1);
    expect(createCategory(db, input({ parentId: weekly }))).toEqual({ ok: false, problem: "too_deep" });
  });

  it("keeps kinds apart: an income category cannot sit under an expense one", () => {
    const db = newDb();
    expect(createCategory(db, input({ kind: "income", parentId: categoryId(db, "Food") }))).toEqual({
      ok: false,
      problem: "parent_other_kind",
    });
  });

  it("rejects malformed input as BAD_REQUEST", () => {
    const db = newDb();
    badRequest(() => createCategory(db, input({ name: "   " })));
    badRequest(() => createCategory(db, input({ name: "x".repeat(61) })));
    badRequest(() => createCategory(db, input({ color: "red" })));
    badRequest(() => createCategory(db, input({ kind: "savings" as never })));
    badRequest(() => createCategory(db, input({ parentId: 9999 })));
    badRequest(() => createCategory(db, input({ emoji: "x".repeat(17) })));
  });
});

describe("updateCategory", () => {
  it("renames, changes the emoji and recolors", () => {
    const db = newDb();
    const id = categoryId(db, "Groceries");
    expect(updateCategory(db, id, { name: "Supermarket", emoji: "🥦", color: "#123456" })).toMatchObject({
      ok: true,
      category: { id, name: "Supermarket", emoji: "🥦", color: "#123456", parentId: categoryId(db, "Food") },
    });
    expect(updateCategory(db, id, { emoji: null }).ok && listCategories(db).find((c) => c.id === id)?.emoji).toBe(
      null,
    );
  });

  it("refuses renaming onto a sibling's name", () => {
    const db = newDb();
    expect(updateCategory(db, categoryId(db, "Groceries"), { name: "Restaurants" })).toEqual({
      ok: false,
      problem: "name_taken",
    });
  });

  it("moves a subcategory to another top-level category, rows following it", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-03-03", amount: -5000, description: "SYNTH CAFE" })])], { now: NOW });
    const cafes = categoryId(db, "Coffee & Cafes");
    updateTransactions(db, [idOf(db, "SYNTH CAFE")], { categoryId: cafes });
    const lifestyle = categoryId(db, "Lifestyle");

    expect(updateCategory(db, cafes, { parentId: lifestyle })).toMatchObject({ ok: true, category: { parentId: lifestyle } });
    const byParent = monthSummary(db, "2026-03").byParent;
    expect(byParent).toContainEqual({ categoryId: lifestyle, amount: 5000, count: 1 });
    expect(stored(db, idOf(db, "SYNTH CAFE"))["category_id"]).toBe(cafes);
  });

  it("makes a subcategory top level, and back", () => {
    const db = newDb();
    const travel = categoryId(db, "Travel");
    expect(updateCategory(db, travel, { parentId: null })).toMatchObject({ ok: true, category: { parentId: null } });
    expect(updateCategory(db, travel, { parentId: categoryId(db, "Lifestyle") }).ok).toBe(true);
  });

  it("moves a whole branch when it still fits in three levels", () => {
    const db = newDb();
    // Travel goes to level 3, under Groceries.
    expect(updateCategory(db, categoryId(db, "Travel"), { parentId: categoryId(db, "Groceries") })).toMatchObject({
      ok: true,
      category: { parentId: categoryId(db, "Groceries") },
    });
    // Lifestyle and its children go under Home & Bills: levels 2 and 3.
    const lifestyle = categoryId(db, "Lifestyle");
    expect(updateCategory(db, lifestyle, { parentId: categoryId(db, "Home & Bills") }).ok).toBe(true);
    expect(listCategories(db).find((c) => c.name === "Entertainment")?.parentId).toBe(lifestyle);
  });

  it("enforces three levels with fixed codes", () => {
    const db = newDb();
    const groceries = categoryId(db, "Groceries");
    const weekly = created(db, { name: "Weekly shop", parentId: groceries });
    // Under a level 3 category.
    expect(updateCategory(db, categoryId(db, "Travel"), { parentId: weekly })).toEqual({ ok: false, problem: "too_deep" });
    // Food spans three levels now, so it cannot go under anything.
    expect(updateCategory(db, categoryId(db, "Food"), { parentId: categoryId(db, "Lifestyle") })).toEqual({
      ok: false,
      problem: "too_deep",
    });
    // A two-level branch cannot go under a level 2 category.
    expect(updateCategory(db, groceries, { parentId: categoryId(db, "Restaurants") })).toEqual({
      ok: false,
      problem: "too_deep",
    });
  });

  it("refuses a move under the category's own subcategory", () => {
    const db = newDb();
    const lifestyle = categoryId(db, "Lifestyle");
    expect(updateCategory(db, lifestyle, { parentId: categoryId(db, "Entertainment") })).toEqual({
      ok: false,
      problem: "parent_is_descendant",
    });
    const groceries = categoryId(db, "Groceries");
    const weekly = created(db, { name: "Weekly shop", parentId: groceries });
    expect(updateCategory(db, categoryId(db, "Food"), { parentId: weekly })).toEqual({
      ok: false,
      problem: "parent_is_descendant",
    });
  });

  it("enforces same kind with a fixed code", () => {
    const db = newDb();
    expect(updateCategory(db, categoryId(db, "Groceries"), { parentId: categoryId(db, "Salary") })).toEqual({
      ok: false,
      problem: "parent_other_kind",
    });
  });

  it("refuses a name taken in the new parent", () => {
    const db = newDb();
    const id = created(db, { name: "Groceries" });
    expect(updateCategory(db, id, { parentId: categoryId(db, "Food") })).toEqual({ ok: false, problem: "name_taken" });
  });

  it("rejects unknown ids and self-parenting", () => {
    const db = newDb();
    badRequest(() => updateCategory(db, 9999, { name: "x" }));
    const id = created(db);
    badRequest(() => updateCategory(db, id, { parentId: id }));
  });
});

describe("the old Routine / Treats column (spec 34, F72)", () => {
  const column = (db: Db, id: number) =>
    (db.prepare("SELECT essential FROM categories WHERE id = ?").get(id) as { essential: number | null }).essential;

  it("keeps its values through edits and moves, gives new categories NULL, and is not sent to the window", () => {
    const db = newDb();
    const bars = categoryId(db, "Bars");
    expect(column(db, bars)).toBe(0);
    updateCategory(db, bars, { name: "Pubs", parentId: categoryId(db, "Lifestyle") });
    updateCategory(db, bars, { parentId: null });
    expect(column(db, bars)).toBe(0);
    expect(column(db, created(db, { name: "Bakery", parentId: categoryId(db, "Food") }))).toBeNull();
    expect(listCategories(db).some((c) => "essential" in c)).toBe(false);
  });
});

describe("deleteCategory", () => {
  function withRows(): { db: Db; groceries: number; restaurants: number } {
    const db = newDb();
    ingest(
      db,
      [
        bank([
          txn({ date: "2026-03-03", amount: -5000, description: "SYNTH MARKET A" }),
          txn({ date: "2026-03-04", amount: -7000, description: "SYNTH MARKET B" }),
        ]),
      ],
      { now: NOW },
    );
    const groceries = categoryId(db, "Groceries");
    updateTransactions(db, [idOf(db, "SYNTH MARKET A")], { categoryId: groceries });
    createRule(db, ruleInput({ matchText: "MARKET B", setCategoryId: groceries }));
    return { db, groceries, restaurants: categoryId(db, "Restaurants") };
  }

  it("deletes a category nothing uses", () => {
    const db = newDb();
    const id = created(db);
    expect(deleteCategory(db, id)).toEqual({ ok: true, movedRows: 0, movedRules: 0 });
    expect(listCategories(db).some((c) => c.id === id)).toBe(false);
  });

  it("takes the budget with it, which the plan reports for the dialog to say first", () => {
    const db = newDb();
    const id = created(db);
    setBudget(db, id, 30_000);
    const line = () => budgetPlan(db, { month: "2026-03", today: "2026-03-10" }).lines.find((l) => l.categoryId === id);
    expect(line()?.budget).toBe(30_000);
    expect(deleteCategory(db, id)).toEqual({ ok: true, movedRows: 0, movedRules: 0 });
    expect(line()).toBeUndefined();
  });

  it("refuses while rows or rules use it, and changes nothing", () => {
    const { db, groceries } = withRows();
    expect(listCategories(db).find((c) => c.id === groceries)).toMatchObject({ rowCount: 2, ruleCount: 1 });
    expect(deleteCategory(db, groceries)).toEqual({ ok: false, problem: "in_use" });
    expect(listCategories(db).some((c) => c.id === groceries)).toBe(true);
  });

  it("refuses while only a rule uses it", () => {
    const db = newDb();
    const id = created(db);
    createRule(db, ruleInput({ matchText: "SYNTH", setCategoryId: id }));
    expect(deleteCategory(db, id)).toEqual({ ok: false, problem: "in_use" });
  });

  it("moves rows and rules to another category, then deletes", () => {
    const { db, groceries, restaurants } = withRows();
    const before = monthSummary(db, "2026-03");
    expect(deleteCategory(db, groceries, restaurants)).toEqual({ ok: true, movedRows: 2, movedRules: 1 });
    expect(stored(db, idOf(db, "SYNTH MARKET A"))).toMatchObject({ category_id: restaurants, category_source: "user" });
    expect(stored(db, idOf(db, "SYNTH MARKET B"))).toMatchObject({ category_id: restaurants, category_source: "rule" });
    expect(listRules(db)[0]?.setCategoryId).toBe(restaurants);
    const after = monthSummary(db, "2026-03");
    expect(after.spending).toBe(before.spending);
    expect(after.byCategory).toContainEqual({ categoryId: restaurants, amount: 12000, count: 2 });
  });

  it("refuses moving rows to another kind or to itself", () => {
    const { db, groceries } = withRows();
    expect(deleteCategory(db, groceries, categoryId(db, "Salary"))).toEqual({ ok: false, problem: "target_other_kind" });
    badRequest(() => deleteCategory(db, groceries, groceries));
    expect(stored(db, idOf(db, "SYNTH MARKET A"))["category_id"]).toBe(groceries);
  });

  it("never deletes a category that still has subcategories, at any level", () => {
    const db = newDb();
    expect(deleteCategory(db, categoryId(db, "Food"))).toEqual({ ok: false, problem: "has_children" });
    const weekly = created(db, { name: "Weekly shop", parentId: categoryId(db, "Groceries") });
    expect(deleteCategory(db, categoryId(db, "Groceries"))).toEqual({ ok: false, problem: "has_children" });
    // A level 3 category nothing uses goes.
    expect(deleteCategory(db, weekly)).toEqual({ ok: true, movedRows: 0, movedRules: 0 });
  });

  it("the database triggers still guard the same rules underneath", () => {
    const db = newDb();
    expect(() =>
      db.prepare("UPDATE categories SET parent_id = ? WHERE id = ?").run(categoryId(db, "Salary"), categoryId(db, "Groceries")),
    ).toThrow();
  });
});
