// The trend card's category ticks: add, remove, and never overlap.

import { describe, expect, it } from "vitest";
import type { Category } from "@shared/types";
import { indexCategories } from "@/lib/categories";
import { toggleTick } from "./trend-filter";

const cat = (id: number, name: string, parentId: number | null): Category =>
  ({ id, name, parentId, kind: "expense", emoji: null, color: null, archived: false }) as Category;

// Food (1) with Groceries (2) and Restaurants (3); Home (4).
const index = indexCategories([cat(1, "Food", null), cat(2, "Groceries", 1), cat(3, "Restaurants", 1), cat(4, "Home", null)]);

describe("trend ticks", () => {
  it("adds and removes ids, uncategorized included", () => {
    expect(toggleTick([], 4, index)).toEqual([4]);
    expect(toggleTick([4], null, index)).toEqual([4, null]);
    expect(toggleTick([4, null], 4, index)).toEqual([null]);
    expect(toggleTick([null], null, index)).toEqual([]);
  });

  it("ticking a group unticks its categories", () => {
    expect(toggleTick([2, 3, 4], 1, index)).toEqual([4, 1]);
  });

  it("ticking a category unticks its group, not other groups", () => {
    expect(toggleTick([1, 4], 2, index)).toEqual([4, 2]);
    expect(toggleTick([2], 3, index)).toEqual([2, 3]);
  });
});
