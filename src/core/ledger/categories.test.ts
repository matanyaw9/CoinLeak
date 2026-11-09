import { describe, expect, it } from "vitest";
import type { CategoryInput } from "@shared/types";
import { CodedError } from "@shared/errors";
import type { Db } from "../db";
import { NOW, bank, categoryId, idOf, newDb, stored, txn } from "../testing/ledger";
import { ruleInput } from "../testing/rules";
import { createRule, listRules } from "../rules";
import { createCategory, deleteCategory, updateCategory } from "./categories";
import { ingest } from "./ingest";
import { listCategories, monthSummary, updateTransactions } from "./queries";

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

  it("keeps two levels: a subcategory cannot hold one", () => {
    const db = newDb();
    expect(createCategory(db, input({ parentId: categoryId(db, "Groceries") }))).toEqual({
      ok: false,
      problem: "parent_not_top_level",
    });
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

  it("enforces two levels with fixed codes", () => {
    const db = newDb();
    expect(updateCategory(db, categoryId(db, "Travel"), { parentId: categoryId(db, "Groceries") })).toEqual({
      ok: false,
      problem: "parent_not_top_level",
    });
    // A top-level category with subcategories cannot become one.
    expect(updateCategory(db, categoryId(db, "Food"), { parentId: categoryId(db, "Lifestyle") })).toEqual({
      ok: false,
      problem: "has_children",
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

describe("essential or extra (spec 18)", () => {
  const flag = (db: Db, name: string) => listCategories(db).find((c) => c.name === name)?.essential;

  it("switching essential and extra persists, and touches nothing else", () => {
    const db = newDb();
    const id = categoryId(db, "Groceries");
    const before = listCategories(db).find((c) => c.id === id);
    expect(updateCategory(db, id, { essential: false })).toMatchObject({ ok: true, category: { essential: false } });
    expect(flag(db, "Groceries")).toBe(false);
    expect(listCategories(db).find((c) => c.id === id)).toEqual({ ...before, essential: false });
    expect(updateCategory(db, id, { essential: true }).ok).toBe(true);
    expect(flag(db, "Groceries")).toBe(true);
    // A rename alone keeps the flag.
    updateCategory(db, categoryId(db, "Bars"), { name: "Pubs" });
    expect(flag(db, "Pubs")).toBe(false);
  });

  it("new spending subcategories are essential unless the user says extra", () => {
    const db = newDb();
    const food = categoryId(db, "Food");
    expect(createCategory(db, input({ name: "Bakery", parentId: food })).ok && flag(db, "Bakery")).toBe(true);
    expect(createCategory(db, input({ name: "Sweets", parentId: food, essential: false })).ok && flag(db, "Sweets")).toBe(false);
    expect(createCategory(db, input({ name: "Garden" })).ok && flag(db, "Garden")).toBeNull();
  });

  it("income, transfer and group categories have no switch", () => {
    const db = newDb();
    expect(flag(db, "Salary")).toBeNull();
    expect(flag(db, "Savings")).toBeNull();
    expect(flag(db, "Food")).toBeNull();
    badRequest(() => updateCategory(db, categoryId(db, "Salary"), { essential: true }));
    badRequest(() => updateCategory(db, categoryId(db, "Savings"), { essential: false }));
    badRequest(() => updateCategory(db, categoryId(db, "Food"), { essential: false }));
    badRequest(() => createCategory(db, input({ name: "Rent in", kind: "income", essential: true })));
    badRequest(() => updateCategory(db, categoryId(db, "Groceries"), { essential: "no" as unknown as boolean }));
  });

  it("moving out of a group clears the flag, moving in sets it essential", () => {
    const db = newDb();
    const id = categoryId(db, "Shopping");
    expect(updateCategory(db, id, { parentId: null })).toMatchObject({ ok: true, category: { essential: null } });
    expect(updateCategory(db, id, { parentId: categoryId(db, "Lifestyle") })).toMatchObject({
      ok: true,
      category: { essential: true },
    });
    const bars = categoryId(db, "Bars");
    expect(updateCategory(db, bars, { parentId: categoryId(db, "Lifestyle") })).toMatchObject({
      ok: true,
      category: { essential: false },
    });
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

  it("never deletes a top-level category that still has subcategories", () => {
    const db = newDb();
    expect(deleteCategory(db, categoryId(db, "Food"))).toEqual({ ok: false, problem: "has_children" });
  });

  it("the database triggers still guard the same rules underneath", () => {
    const db = newDb();
    expect(() =>
      db.prepare("UPDATE categories SET parent_id = ? WHERE id = ?").run(categoryId(db, "Salary"), categoryId(db, "Groceries")),
    ).toThrow();
  });
});
