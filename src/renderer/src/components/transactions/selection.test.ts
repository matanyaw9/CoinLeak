import { describe, expect, it } from "vitest";
import { checkState, checkedProp, extendTo, keyTargets, pickRow, rowClickKind, selectAll, toggleAll, toggleRow } from "./selection";

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

describe("clicks with Ctrl and Shift, and Ctrl+A (spec 31)", () => {
  const order = [10, 20, 30, 40, 50];
  const ids = (s: ReadonlySet<number>) => [...s].sort((a, b) => a - b);
  const mods = (m: Partial<Record<"shiftKey" | "ctrlKey" | "metaKey" | "altKey", boolean>>) => ({
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...m,
  });

  it("Ctrl+click adds one row, or removes it when selected, and moves the anchor to it", () => {
    const added = pickRow(order, { selected: new Set([10]), anchor: 10 }, 40, false);
    expect(ids(added.selected)).toEqual([10, 40]);
    expect(added.anchor).toBe(40);
    const removed = pickRow(order, added, 10, false);
    expect(ids(removed.selected)).toEqual([40]);
    expect(removed.anchor).toBe(10);
  });

  it("a shift range after a Ctrl+click starts from the row Ctrl+clicked", () => {
    let pick = pickRow(order, { selected: new Set(), anchor: null }, 10, false);
    pick = pickRow(order, pick, 40, false);
    pick = pickRow(order, pick, 50, true);
    expect(ids(pick.selected)).toEqual([10, 40, 50]);
    expect(pick.anchor).toBe(50);
  });

  it("reads Shift as a range and Ctrl (Cmd on a Mac) as one row", () => {
    expect(rowClickKind(mods({ shiftKey: true }), false)).toBe("range");
    expect(rowClickKind(mods({ ctrlKey: true }), false)).toBe("toggle");
    expect(rowClickKind(mods({ metaKey: true }), true)).toBe("toggle");
    expect(rowClickKind(mods({ metaKey: true }), false)).toBeNull();
    expect(rowClickKind(mods({ ctrlKey: true }), true)).toBeNull();
    expect(rowClickKind(mods({}), false)).toBeNull();
    expect(rowClickKind(mods({ altKey: true, shiftKey: true }), false)).toBeNull();
  });

  it("Ctrl+A selects the same rows as the box above the list", () => {
    const shown = [1, 2, 3];
    for (const before of [new Set<number>(), new Set([2])]) {
      expect(ids(selectAll(shown, before))).toEqual(ids(toggleAll(shown, before)));
    }
    // Unlike the box, a second Ctrl+A keeps them selected.
    expect(ids(selectAll(shown, new Set(shown)))).toEqual(shown);
  });
});

describe("Shift+arrows and the keys' rows (spec 36)", () => {
  const order = [10, 20, 30, 40, 50];
  const ids = (s: ReadonlySet<number>) => [...s].sort((a, b) => a - b);

  it("Shift+Down from a row with no anchor selects it and the next one", () => {
    const pick = extendTo(order, { selected: new Set(), anchor: null }, 20, 30);
    expect(ids(pick.selected)).toEqual([20, 30]);
    expect(pick.anchor).toBe(20);
  });

  it("extends from the anchor, the last row clicked, wherever focus started", () => {
    // Clicked 40, moved up to 10 with plain arrows, then Shift+Down to 20.
    const clicked = pickRow(order, { selected: new Set(), anchor: null }, 40, false);
    const pick = extendTo(order, clicked, 10, 20);
    expect(ids(pick.selected)).toEqual([20, 30, 40]);
    expect(pick.anchor).toBe(40);
  });

  it("keeps extending the same way, and going back toward the anchor shrinks it", () => {
    let pick = extendTo(order, { selected: new Set(), anchor: null }, 20, 30);
    pick = extendTo(order, pick, 30, 40);
    expect(ids(pick.selected)).toEqual([20, 30, 40]);
    pick = extendTo(order, pick, 40, 30);
    expect(ids(pick.selected)).toEqual([20, 30]);
    // Past the anchor, the other way.
    pick = extendTo(order, pick, 30, 20);
    pick = extendTo(order, pick, 20, 10);
    expect(ids(pick.selected)).toEqual([10, 20]);
    expect(pick.anchor).toBe(20);
  });

  it("leaves rows outside the range alone", () => {
    const pick = extendTo(order, { selected: new Set([50]), anchor: null }, 10, 20);
    expect(ids(pick.selected)).toEqual([10, 20, 50]);
  });

  it("at the edge of the list, or for a row no longer listed, changes nothing", () => {
    const start = { selected: new Set([10]), anchor: 10 };
    expect(ids(extendTo(order, start, 10, 10).selected)).toEqual([10]);
    expect(extendTo(order, start, 10, 99)).toBe(start);
    // An anchor no longer listed: the range starts where focus was.
    expect(ids(extendTo(order, { selected: new Set(), anchor: 99 }, 30, 40).selected)).toEqual([30, 40]);
  });

  it("Delete and I act on the selection, or else on the row focus is on", () => {
    const rows = order.map((id) => ({ id }));
    expect(keyTargets(rows, new Set([20, 40]), 10).map((r) => r.id)).toEqual([20, 40]);
    expect(keyTargets(rows, new Set(), 30).map((r) => r.id)).toEqual([30]);
    expect(keyTargets(rows, new Set(), null)).toEqual([]);
    expect(keyTargets(rows, new Set(), 99)).toEqual([]);
  });

  it("Trash selects with these same functions: boxes, Shift+click, Ctrl+A and Shift+arrows", () => {
    // Trash lists newest first; the rules do not care about the order's meaning.
    const trash = [7, 5, 3];
    let pick = pickRow(trash, { selected: new Set(), anchor: null }, 7, false);
    pick = pickRow(trash, pick, 3, true);
    expect(ids(pick.selected)).toEqual([3, 5, 7]);
    expect(ids(selectAll(trash, new Set()))).toEqual([3, 5, 7]);
    expect(ids(extendTo(trash, { selected: new Set(), anchor: null }, 5, 3).selected)).toEqual([3, 5]);
    expect(checkState(trash, new Set([5]))).toBe("some");
  });
});
