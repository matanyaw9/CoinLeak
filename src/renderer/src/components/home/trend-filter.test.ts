// The trend card's category ticks (add, remove, never overlap) and what a click does.

import { describe, expect, it } from "vitest";
import type { Category } from "@shared/types";
import { categorySlice, indexCategories, otherSlice, ownRowsSlice } from "@/lib/categories";
import { legendAction, monthAction, segmentAction, toggleTick } from "./trend-filter";

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

  it("three levels: a tick unticks everything under it and above it (spec 34)", () => {
    // Food (1) › Groceries (2) › Weekly shop (5).
    const deep = indexCategories([cat(1, "Food", null), cat(2, "Groceries", 1), cat(5, "Weekly shop", 2), cat(3, "Restaurants", 1)]);
    expect(toggleTick([5, 3], 1, deep)).toEqual([1]);
    expect(toggleTick([1], 5, deep)).toEqual([5]);
    expect(toggleTick([2, 3], 5, deep)).toEqual([3, 5]);
    expect(toggleTick([5], 2, deep)).toEqual([2]);
  });
});

describe("what a click on the month by month bars does (spec 38)", () => {
  // Shop (1) › Groceries (2) › Weekly shop (5); Restaurants (3) under 1; Home (4).
  const deep = indexCategories([cat(1, "Shop", null), cat(2, "Groceries", 1), cat(5, "Weekly shop", 2), cat(3, "Restaurants", 1), cat(4, "Home", null)]);
  const month = "2026-10";
  const slice = (id: number | null) => categorySlice(deep, id);

  it("all spending: a segment or legend name ticks its group; Other opens the month", () => {
    expect(segmentAction([], deep, slice(1), month)).toEqual({ kind: "tick", id: 1 });
    expect(segmentAction([], deep, slice(null), month)).toEqual({ kind: "tick", id: null });
    expect(segmentAction([], deep, otherSlice(0), month)).toEqual({ kind: "month", categories: [], month });
    expect(legendAction([], slice(4))).toEqual({ kind: "tick", id: 4 });
    expect(legendAction([], otherSlice(0))).toBeNull();
  });

  it("ticked: a segment with children drills one more level down", () => {
    // Shop ticked shows Groceries (has children) and Restaurants (none).
    expect(segmentAction([1], deep, slice(2), month)).toEqual({ kind: "tick", id: 2 });
    // The tick replaces its parent, one level at a time.
    expect(toggleTick([1], 2, deep)).toEqual([2]);
  });

  it("ticked: no children, Other in, and Uncategorized open that month", () => {
    expect(segmentAction([1], deep, slice(3), month)).toEqual({ kind: "month", categories: [3], month });
    expect(segmentAction([2], deep, slice(5), month)).toEqual({ kind: "month", categories: [5], month });
    // "Other in Groceries": Groceries' own rows, under its own (ticked) id.
    expect(segmentAction([2], deep, ownRowsSlice(deep, 2), month)).toEqual({ kind: "month", categories: [2], month });
    expect(segmentAction([4, null], deep, slice(null), month)).toEqual({ kind: "month", categories: [null], month });
  });

  it("ticked: a legend name opens every month the bars show", () => {
    expect(legendAction([1], slice(2))).toEqual({ kind: "range", categories: [2] });
    expect(legendAction([4, null], slice(null))).toEqual({ kind: "range", categories: [null] });
  });

  it("Enter on a month opens it with the chart's filter", () => {
    expect(monthAction([], month)).toEqual({ kind: "month", categories: [], month });
    expect(monthAction([2, null], month)).toEqual({ kind: "month", categories: [2, null], month });
  });
});
