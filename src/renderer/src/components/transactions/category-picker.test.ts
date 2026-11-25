// The category picker's list (spec 34): the three-level tree by kind while
// browsing, every level a choice; full paths while searching.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Category, CategoryKind } from "@shared/types";
import { indexCategories } from "@/lib/categories";
import { CategoryPicker, pickerItems } from "./category-picker";

const cat = (id: number, name: string, parentId: number | null = null, kind: CategoryKind = "expense"): Category => ({
  id,
  parentId,
  name,
  kind,
  emoji: null,
  color: null,
  archived: false,
});

const index = indexCategories([
  cat(1, "Groceries & Shop"),
  cat(2, "Groceries", 1),
  cat(3, "Weekly shop", 2),
  cat(4, "Local shop", 1),
  cat(5, "Transportation"),
  cat(6, "Savings & Investments", null, "transfer"),
  cat(7, "Savings", 6, "transfer"),
  cat(8, "Salary", null, "income"),
]);

const lines = (kind: CategoryKind, query: string) =>
  pickerItems(index, kind, query).map((i) => `${"  ".repeat(i.depth - 1)}${i.label}`);

describe("category picker list", () => {
  it("browses the tree depth first, spending first for money out, every level listed", () => {
    expect(lines("expense", "")).toEqual([
      "Groceries & Shop",
      "  Groceries",
      "    Weekly shop",
      "  Local shop",
      "Transportation",
      "Savings & Investments",
      "  Savings",
      "Salary",
    ]);
  });

  it("puts income first for money in, transfers in the middle", () => {
    expect(lines("income", "").slice(0, 3)).toEqual(["Salary", "Savings & Investments", "  Savings"]);
  });

  it("searches full paths and shows them, in tree order", () => {
    expect(lines("expense", "weekly")).toEqual(["Groceries & Shop › Groceries › Weekly shop"]);
    // A parent's name finds everything under it too.
    expect(lines("expense", "groceries")).toEqual([
      "Groceries & Shop",
      "Groceries & Shop › Groceries",
      "Groceries & Shop › Groceries › Weekly shop",
      "Groceries & Shop › Local shop",
    ]);
    expect(lines("expense", "  SHOP ")).toHaveLength(4);
    expect(lines("expense", "nothing like this")).toEqual([]);
  });
});

// The rule editor renders outside the router (App.tsx), and its category
// field is this picker: a router hook in it blanked every rule editor.
describe("the picker outside the router", () => {
  it("renders without a router around it", () => {
    const picker = createElement(CategoryPicker, { index, onSelect: () => undefined, children: "Pick" });
    expect(renderToStaticMarkup(picker)).toContain("Pick");
  });
});
