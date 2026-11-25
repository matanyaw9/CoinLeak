// The category chooser (spec 38): what it lists, the draft, Apply, clear,
// the no-overlap rule, the limit, and its label.

import { describe, expect, it } from "vitest";
import type { Category } from "@shared/types";
import { indexCategories } from "@/lib/categories";
import { chooserItems, chooserLabel, tickDraft, tickedAbove } from "./chooser";
import type { TrendTicks } from "./trend-filter";

const cat = (id: number, name: string, parentId: number | null, kind: Category["kind"] = "expense"): Category =>
  ({ id, name, parentId, kind, emoji: null, color: null, archived: false }) as Category;

// Groceries & Shop (1) › Groceries (2) › Weekly shop (3), Top-up (4); Clothes (5) under 1;
// Transport (6); Salary (7) is income.
const index = indexCategories([
  cat(1, "Groceries & Shop", null),
  cat(2, "Groceries", 1),
  cat(3, "Weekly shop", 2),
  cat(4, "Top-up", 2),
  cat(5, "Clothes", 1),
  cat(6, "Transport", null),
  cat(7, "Salary", null, "income"),
]);

describe("chooser lines", () => {
  it("browsing: the spending tree in order, indented, Uncategorized last", () => {
    const items = chooserItems(index, "");
    expect(items.map((x) => [x.id, x.depth])).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 3],
      [5, 2],
      [6, 1],
      [null, 1],
    ]);
  });

  it("searching: full paths that hold the text, any case, Uncategorized too", () => {
    expect(chooserItems(index, "weekly").map((x) => x.label)).toEqual(["Groceries & Shop › Groceries › Weekly shop"]);
    expect(chooserItems(index, " GROC ").map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
    expect(chooserItems(index, "uncat").map((x) => x.id)).toEqual([null]);
    expect(chooserItems(index, "salary")).toEqual([]);
  });
});

describe("chooser draft", () => {
  it("ticks change only the draft; Apply hands it over, clear is nothing ticked", () => {
    const applied: TrendTicks = [6];
    let draft = [...applied];
    draft = tickDraft(draft, 3, index);
    draft = tickDraft(draft, null, index);
    expect(draft).toEqual([6, 3, null]);
    expect(applied).toEqual([6]);
    expect(tickDraft(draft, 6, index)).toEqual([3, null]);
  });

  it("never overlaps: a tick unticks everything under and above it", () => {
    expect(tickDraft([3, 4, 6], 1, index)).toEqual([6, 1]);
    expect(tickDraft([1], 3, index)).toEqual([3]);
    expect(tickDraft([2, 5], 4, index)).toEqual([5, 4]);
  });

  it("no limit by default; with one, a tick past it changes nothing, unticking still works", () => {
    const many = tickDraft(tickDraft(tickDraft([], 3, index), 4, index), 5, index);
    expect(many).toEqual([3, 4, 5]);
    const full = [3, 4];
    expect(tickDraft(full, 6, index, 2)).toBe(full);
    expect(tickDraft(full, 4, index, 2)).toEqual([3]);
    // Ticking their parent replaces both, so it fits.
    expect(tickDraft(full, 2, index, 2)).toEqual([2]);
  });

  it("a line under a ticked category is counted already", () => {
    expect(tickedAbove([1], 3, index)).toBe(1);
    expect(tickedAbove([2], 4, index)).toBe(2);
    expect(tickedAbove([3], 2, index)).toBeNull();
    expect(tickedAbove([1], null, index)).toBeNull();
  });
});

describe("chooser label", () => {
  it("says Top 5 with nothing chosen, the name of one, else how many", () => {
    expect(chooserLabel([], index, "Top 5")).toBe("Top 5");
    expect(chooserLabel([3], index, "Top 5")).toBe("Weekly shop");
    expect(chooserLabel([null], index, "All spending")).toBe("Uncategorized");
    expect(chooserLabel([3, 4, 6], index, "Top 5")).toBe("3 categories");
  });
});
