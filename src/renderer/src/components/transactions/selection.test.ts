import { describe, expect, it } from "vitest";
import { checkState, checkedProp, toggleAll } from "./selection";

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
