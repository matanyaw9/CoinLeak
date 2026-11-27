// The money flow from the keyboard (spec 45 A): which name Up and Down reach,
// and what Enter does there.

import { describe, expect, it } from "vitest";
import type { MoneyFlowLink, MoneyFlowNode } from "@shared/types";
import type { Slice } from "@/lib/categories";
import { nextIndex } from "@/lib/roving";
import { keyOrder, pickOf, sidesOf, type FlowItem } from "./flow-sankey";

// Core's order need not be the drawn one: 0 is the hub, 2 and 4 are on the left.
const link = (source: number, target: number): MoneyFlowLink => ({ source, target, amount: 100 });
const links = [link(2, 0), link(4, 0), link(0, 1), link(0, 3)];
const order = keyOrder(sidesOf(5, links));
const reach = (key: string, from: number) => order[nextIndex(key, order.indexOf(from), order.length) ?? -1];

describe("Up and Down on the money flow", () => {
  it("walk the left column, the middle, then the right column", () => {
    expect(order).toEqual([2, 4, 0, 1, 3]);
    expect(reach("ArrowDown", 2)).toBe(4);
    expect(reach("ArrowDown", 4)).toBe(0);
    expect(reach("ArrowDown", 0)).toBe(1);
    expect(reach("ArrowUp", 1)).toBe(0);
  });

  it("stop at the first and last name", () => {
    expect(reach("ArrowUp", 2)).toBe(2);
    expect(reach("ArrowDown", 3)).toBe(3);
  });
});

describe("Enter on a name does what a click does", () => {
  const node: MoneyFlowNode = { kind: "spending", categoryId: 7, amount: 100 };
  const slice: Slice = { key: "7", categoryId: 7, name: "Food", emoji: null, color: "#000000", amount: 100 };
  const item: FlowItem = { node, name: "Food", color: "#000000" };

  it("opens a category that holds others one level down", () => {
    expect(pickOf({ ...item, slice, drill: true })).toEqual({ drill: 7 });
  });

  it("opens the transactions of any other category", () => {
    expect(pickOf({ ...item, slice, drill: false })).toEqual({ open: slice });
  });

  it("does nothing on the hub and the other totals", () => {
    expect(pickOf(item)).toBeNull();
  });
});
