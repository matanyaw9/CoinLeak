import { describe, expect, it } from "vitest";
import { checkState, checkedProp, toggleAll, toggleRow } from "./selection";

describe("one row's box", () => {
  const order = [10, 20, 30, 40, 50];
  const ids = (s: Set<number>) => [...s].sort((a, b) => a - b);

  it("a click selects or clears that row only", () => {
    expect(ids(toggleRow(order, new Set([10]), 30, false, 10))).toEqual([10, 30]);
    expect(ids(toggleRow(order, new Set([10, 30]), 30, false, 10))).toEqual([10]);
  });

  it("shift-click selects every row from the last one clicked, down or up the list", () => {
    expect(ids(toggleRow(order, new Set([20]), 40, true, 20))).toEqual([20, 30, 40]);
    expect(ids(toggleRow(order, new Set([40]), 20, true, 40))).toEqual([20, 30, 40]);
  });

  it("shift-click on a selected row clears the span, leaving rows outside it", () => {
    expect(ids(toggleRow(order, new Set([10, 20, 30, 40]), 30, true, 20))).toEqual([10, 40]);
  });

  it("shift-click with nothing clicked before, or a last row no longer listed, is a plain click", () => {
    expect(ids(toggleRow(order, new Set(), 40, true, null))).toEqual([40]);
    expect(ids(toggleRow(order, new Set(), 40, true, 99))).toEqual([40]);
  });

  it("does not change the selection it was given", () => {
    const before = new Set([10]);
    toggleRow(order, before, 30, true, 10);
    expect([...before]).toEqual([10]);
  });
});

describe("select all", () => {
  const shown = [1, 2, 3];

  it("reads none, some or all of the shown rows", () => {
    expect(checkState(shown, new Set())).toBe("none");
    expect(checkState(shown, new Set([9]))).toBe("none");
    expect(checkState(shown, new Set([2]))).toBe("some");
    expect(checkState(shown, new Set([1, 2, 3, 9]))).toBe("all");
    expect(checkState([], new Set([1]))).toBe("none");
  });

  it("selects every shown row from none or some, and clears them from all", () => {
    expect([...toggleAll(shown, new Set())]).toEqual([1, 2, 3]);
    expect([...toggleAll(shown, new Set([2]))].sort()).toEqual([1, 2, 3]);
    expect([...toggleAll(shown, new Set([1, 2, 3]))]).toEqual([]);
  });

  it("a day's box leaves other days alone", () => {
    const otherDay = new Set([7, 8]);
    expect([...toggleAll([1, 2], otherDay)].sort()).toEqual([1, 2, 7, 8]);
    expect([...toggleAll([7, 8], new Set([1, 7, 8]))]).toEqual([1]);
  });

  it("does not change the selection it was given", () => {
    const before = new Set([1]);
    toggleAll(shown, before);
    expect([...before]).toEqual([1]);
  });

  it("maps to the checkbox's checked prop", () => {
    expect(checkedProp("all")).toBe(true);
    expect(checkedProp("none")).toBe(false);
    expect(checkedProp("some")).toBe("indeterminate");
  });
});
