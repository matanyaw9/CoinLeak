// The three-level tree helpers (spec 34): descendants, full paths, depth,
// tree order and where a category may move.

import { describe, expect, it } from "vitest";
import type { Category, CategoryKind } from "@shared/types";
import { depthOf, heightOf, idsUnder, indexCategories, parentChoices, pathOf, treeOf } from "./categories";

const cat = (id: number, name: string, parentId: number | null = null, kind: CategoryKind = "expense"): Category => ({
  id,
  parentId,
  name,
  kind,
  emoji: null,
  color: null,
  archived: false,
});

// Core sends them depth first.
const index = indexCategories([
  cat(1, "Groceries & Shop"),
  cat(2, "Groceries", 1),
  cat(3, "Weekly shop", 2),
  cat(4, "Top-up", 2),
  cat(5, "Local shop", 1),
  cat(6, "Transportation"),
  cat(7, "Transport", 6),
  cat(8, "Bus", 7),
  cat(9, "Fuel", 6),
  cat(10, "Board games"),
  cat(20, "Salary", null, "income"),
]);
const byName = (name: string): Category => {
  const c = [...index.byId.values()].find((x) => x.name === name);
  if (!c) throw new Error(name);
  return c;
};

describe("category tree helpers", () => {
  it("finds everything under a category, grandchildren included", () => {
    expect(idsUnder(index, 1)).toEqual([1, 2, 3, 4, 5]);
    expect(idsUnder(index, 2)).toEqual([2, 3, 4]);
    expect(idsUnder(index, 3)).toEqual([3]);
  });

  it("gives full paths and depths", () => {
    expect(pathOf(index, byName("Weekly shop"))).toBe("Groceries & Shop › Groceries › Weekly shop");
    expect(pathOf(index, byName("Groceries"))).toBe("Groceries & Shop › Groceries");
    expect(pathOf(index, byName("Board games"))).toBe("Board games");
    expect([1, 2, 3].map((id) => depthOf(index, index.byId.get(id) as Category))).toEqual([1, 2, 3]);
    expect([1, 2, 3, 10].map((id) => heightOf(index, id))).toEqual([3, 2, 1, 1]);
  });

  it("lists one kind depth first with each entry's depth", () => {
    expect(treeOf(index, "expense").map((e) => `${e.depth} ${e.category.name}`)).toEqual([
      "1 Groceries & Shop",
      "2 Groceries",
      "3 Weekly shop",
      "3 Top-up",
      "2 Local shop",
      "1 Transportation",
      "2 Transport",
      "3 Bus",
      "2 Fuel",
      "1 Board games",
    ]);
    expect(treeOf(index, "income").map((e) => e.category.name)).toEqual(["Salary"]);
  });

  it("offers as parents only same-kind categories at level 1 or 2, never the category or anything under it", () => {
    const names = (c: Category | null, kind: CategoryKind = "expense") =>
      parentChoices(index, kind, c).map((e) => e.category.name);
    // A new category, or one without children: any level 1 or 2 category.
    expect(names(null)).toEqual(["Groceries & Shop", "Groceries", "Local shop", "Transportation", "Transport", "Fuel", "Board games"]);
    expect(names(byName("Bus"))).toEqual(names(null));
    // A category with children spans two levels, so only top-level categories, never itself.
    expect(names(byName("Groceries"))).toEqual(["Groceries & Shop", "Transportation", "Board games"]);
    // A three-level branch fits nowhere but the top.
    expect(names(byName("Transportation"))).toEqual([]);
    // Without children a top-level category may go anywhere but under itself.
    expect(names(byName("Board games"))).toEqual(["Groceries & Shop", "Groceries", "Local shop", "Transportation", "Transport", "Fuel"]);
    expect(names(null, "income")).toEqual(["Salary"]);
  });
});
