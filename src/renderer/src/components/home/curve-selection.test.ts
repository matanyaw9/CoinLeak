// The category curves' chosen set: toggle, the limit, clearing, gone categories.

import { describe, expect, it } from "vitest";
import type { Category } from "@shared/types";
import { indexCategories } from "@/lib/categories";
import { atLimit, choiceSlice, liveChoice, MAX_CHOSEN, toggleChosen } from "./curve-selection";

const cat = (id: number, name: string, parentId: number | null, color: string | null = null): Category =>
  ({ id, name, parentId, kind: "expense", emoji: null, color, archived: false }) as Category;

// Food (1) with Groceries (2) and Restaurants (3); Home (4).
const index = indexCategories([cat(1, "Food", null, "#111111"), cat(2, "Groceries", 1), cat(3, "Restaurants", 1, "#333333"), cat(4, "Home", null)]);

describe("curve choice", () => {
  it("toggles ids in the order chosen, groups, subcategories and uncategorized alike", () => {
    let chosen = toggleChosen([], 2);
    chosen = toggleChosen(chosen, 1);
    chosen = toggleChosen(chosen, null);
    expect(chosen).toEqual([2, 1, null]);
    expect(toggleChosen(chosen, 1)).toEqual([2, null]);
    expect(toggleChosen(toggleChosen(chosen, null), 2)).toEqual([1]);
  });

  it("stops at the limit, and removing still works there", () => {
    const full = Array.from({ length: MAX_CHOSEN }, (_, i) => i + 1);
    expect(atLimit(full)).toBe(true);
    expect(atLimit(full.slice(1))).toBe(false);
    expect(toggleChosen(full, 99)).toBe(full);
    expect(toggleChosen(full, null)).toBe(full);
    expect(toggleChosen(full, 5)).toHaveLength(MAX_CHOSEN - 1);
  });

  it("clearing is the empty set (the top 5), and gone categories drop out", () => {
    expect(toggleChosen([4], 4)).toEqual([]);
    expect(liveChoice([4, 77, null, 2], index)).toEqual([4, null, 2]);
  });

  it("a subcategory takes its own color, else its group's", () => {
    expect(choiceSlice(index, 3).color).toBe("#333333");
    expect(choiceSlice(index, 2).color).toBe(choiceSlice(index, 1).color);
    expect(choiceSlice(index, null)).toMatchObject({ key: "none", categoryId: null });
  });
});
