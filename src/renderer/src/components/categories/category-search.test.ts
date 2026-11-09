import { describe, expect, it } from "vitest";
import type { Category } from "@shared/types";
import { indexCategories } from "@/lib/categories";
import { hitsElsewhere, searchCategories } from "./category-search";

let next = 1;
function cat(name: string, parentId: number | null = null, kind: Category["kind"] = "expense"): Category {
  return { id: next++, parentId, name, kind, emoji: null, color: null, archived: false, essential: null };
}

const food = cat("Food");
const groceries = cat("Groceries", food.id);
const cafes = cat("Coffee & Cafes", food.id);
const fun = cat("Fun");
const bars = cat("Bars", fun.id);
const gifts = cat("מתנות");
const salary = cat("Salary", null, "income");
const index = indexCategories([food, groceries, cafes, fun, bars, gifts, salary]);
const places = new Map([[groceries.id, ["שופרסל", "Rami Levy"]]]);
const placeNames = (id: number) => places.get(id);

const names = (query: string, kind: Category["kind"] = "expense") =>
  searchCategories(index, kind, query, placeNames).map((g) => [g.root.name, g.kids.map((c) => c.name)]);

describe("the Categories search", () => {
  it("shows everything with no search", () => {
    expect(names("")).toEqual([
      ["Food", ["Groceries", "Coffee & Cafes"]],
      ["Fun", ["Bars"]],
      ["מתנות", []],
    ]);
  });

  it("a group whose name matches keeps all its categories", () => {
    expect(names("fo")).toEqual([["Food", ["Groceries", "Coffee & Cafes"]]]);
  });

  it("otherwise keeps only matching categories, and groups with none collapse away", () => {
    expect(names("CAFE")).toEqual([["Food", ["Coffee & Cafes"]]]);
    expect(names("bar")).toEqual([["Fun", ["Bars"]]]);
  });

  it("finds a category by a known place, in Hebrew or English", () => {
    expect(names("שופר")).toEqual([["Food", ["Groceries"]]]);
    expect(names("rami")).toEqual([["Food", ["Groceries"]]]);
  });

  it("finds Hebrew category names", () => {
    expect(names("מתנ")).toEqual([["מתנות", []]]);
  });

  it("finds nothing, and says where else it would", () => {
    expect(names("salary")).toEqual([]);
    expect(hitsElsewhere(index, "expense", "salary", placeNames)).toEqual([{ kind: "income", count: 1 }]);
    expect(names("salary", "income")).toEqual([["Salary", []]]);
  });
});
