// The category chooser (spec 38, spec 40 B): what it lists, the tick box
// rules, the list the chart gets, the limit, Clear all and its label.

import { describe, expect, it } from "vitest";
import type { Category } from "@shared/types";
import { idsUnder, indexCategories } from "@/lib/categories";
import { chooserItems, chooserLabel, smallest, tickDraft, tickState, tickedAbove } from "./chooser";
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

const click = (draft: TrendTicks, ...ids: (number | null)[]) => ids.reduce<TrendTicks>((d, id) => tickDraft(d, id, index), draft);
const states = (draft: TrendTicks) => [1, 2, 3, 4, 5, 6].map((id) => tickState(draft, id, index));

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

describe("tick boxes", () => {
  it("ticking a parent ticks everything under it, sent as the parent alone", () => {
    const draft = click([], 1);
    expect(draft).toEqual([1]);
    expect(states(draft)).toEqual(["on", "on", "on", "on", "on", "off"]);
    // Ticks already under it are folded in.
    expect(click([3, 5, 6], 1)).toEqual([6, 1]);
  });

  it("unticking one child leaves its siblings ticked and the parent partly", () => {
    const draft = click([1], 5);
    expect(draft).toEqual([2]);
    expect(states(draft)).toEqual(["partly", "on", "on", "on", "off", "off"]);
  });

  it("clicking a ticked child unticks only it, however deep", () => {
    const draft = click([6, 1], 3);
    expect(draft).toEqual([6, 4, 5]);
    expect(states(draft)).toEqual(["partly", "partly", "off", "on", "on", "on"]);
  });

  it("unticking the parent unticks everything under it", () => {
    expect(click([6, 1], 1)).toEqual([6]);
    // A partly ticked parent is first filled; the next click empties it.
    expect(click([3, 6], 1)).toEqual([6, 1]);
    expect(click([3, 6], 1, 1)).toEqual([6]);
  });

  it("ticking the last unticked child ticks the parent again, all the way up", () => {
    expect(click([1], 3, 3)).toEqual([1]);
    expect(click([], 5, 4, 3)).toEqual([1]);
    expect(click([], 3, 4)).toEqual([2]);
  });

  it("Uncategorized stands alone", () => {
    expect(click([1], null)).toEqual([1, null]);
    expect(click([1, null], null)).toEqual([1]);
    expect(tickState([null], null, index)).toBe("on");
    expect(tickState([1], null, index)).toBe("off");
  });

  it("never overlaps, whatever is clicked", () => {
    const ids = [1, 2, 3, 4, 5, 6, null];
    let draft: TrendTicks = [];
    // A long fixed run of clicks.
    for (let i = 0; i < 200; i++) {
      draft = tickDraft(draft, ids[(i * 5 + Math.floor(i / 7)) % ids.length] ?? null, index);
      const covered = draft.flatMap((id) => (id === null ? [null] : idsUnder(index, id)));
      expect(new Set(covered).size).toBe(covered.length);
      expect(smallest(draft, index)).toEqual(draft);
    }
  });

  it("tidies a saved list: nothing under a ticked one, all children become the parent", () => {
    expect(smallest([3, 1, null], index)).toEqual([1, null]);
    expect(smallest([3, 6, 4, 5], index)).toEqual([6, 1]);
    expect(smallest([3, 6], index)).toEqual([3, 6]);
  });

  it("Clear all is nothing ticked: every box empty", () => {
    expect(states([])).toEqual(["off", "off", "off", "off", "off", "off"]);
    expect(tickState([], null, index)).toBe("off");
  });

  it("the limit counts the sent list: a click past it changes nothing", () => {
    const full: TrendTicks = [3, 6];
    expect(tickDraft(full, 5, index, 2)).toBe(full);
    expect(tickDraft(full, 3, index, 2)).toEqual([6]);
    // Filling a parent makes the list shorter, so it fits.
    expect(tickDraft(full, 4, index, 2)).toEqual([6, 2]);
    // Unticking one child of a ticked parent can make the list longer.
    const one: TrendTicks = [1];
    expect(tickDraft(one, 3, index, 1)).toBe(one);
    expect(tickDraft(one, 3, index, 2)).toEqual([4, 5]);
  });

  it("says which ticked category a line sits under", () => {
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
