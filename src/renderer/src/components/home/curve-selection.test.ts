// The category curves' chosen set: gone categories, the summed line's name, colors.

import { describe, expect, it } from "vitest";
import type { Category } from "@shared/types";
import { categorySlice, indexCategories } from "@/lib/categories";
import { liveChoice, sumName } from "./curve-selection";

const cat = (id: number, name: string, parentId: number | null, color: string | null = null): Category =>
  ({ id, name, parentId, kind: "expense", emoji: null, color, archived: false }) as Category;

// Food (1) with Groceries (2) and Restaurants (3); Home (4); Fuel (5); Coffee (6).
const index = indexCategories([
  cat(1, "Food", null, "#111111"),
  cat(2, "Groceries", 1),
  cat(3, "Restaurants", 1, "#333333"),
  cat(4, "Home", null),
  cat(5, "Fuel", null),
  cat(6, "Coffee", null),
]);

describe("curve choice", () => {
  it("gone categories drop out; uncategorized stays", () => {
    expect(liveChoice([4, 77, null, 2], index)).toEqual([4, null, 2]);
  });

  it("names the summed line: one, two, three, and past three", () => {
    expect(sumName([2], index)).toBe("Groceries");
    expect(sumName([2, null], index)).toBe("Groceries and Uncategorized");
    expect(sumName([2, 6, 5], index)).toBe("Groceries, Coffee and Fuel");
    expect(sumName([2, 6, 5, 4, 3], index)).toBe("Groceries and 4 more");
  });

  it("a subcategory takes its own color, else its group's", () => {
    expect(categorySlice(index, 3).color).toBe("#333333");
    expect(categorySlice(index, 2).color).toBe(categorySlice(index, 1).color);
    expect(categorySlice(index, null)).toMatchObject({ key: "none", categoryId: null });
  });
});
