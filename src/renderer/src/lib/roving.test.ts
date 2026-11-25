import { describe, expect, it } from "vitest";
import { nextIndex } from "./roving";

describe("arrow keys in a list", () => {
  it("Down and Up move one item", () => {
    expect(nextIndex("ArrowDown", 2, 5)).toBe(3);
    expect(nextIndex("ArrowUp", 2, 5)).toBe(1);
  });

  it("stops at the first and last item instead of wrapping", () => {
    expect(nextIndex("ArrowUp", 0, 5)).toBe(0);
    expect(nextIndex("ArrowDown", 4, 5)).toBe(4);
  });

  it("Home and End jump to the first and last item", () => {
    expect(nextIndex("Home", 3, 5)).toBe(0);
    expect(nextIndex("End", 1, 5)).toBe(4);
  });

  it("leaves Left, Right and every other key to the page", () => {
    for (const key of ["ArrowLeft", "ArrowRight", "Tab", "Enter", " ", "a"]) expect(nextIndex(key, 2, 5)).toBeNull();
  });

  it("an empty list has nowhere to go", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) expect(nextIndex(key, 0, 0)).toBeNull();
  });

  it("starts from the nearest item when the list got shorter", () => {
    expect(nextIndex("ArrowUp", 9, 5)).toBe(3);
    expect(nextIndex("ArrowDown", -1, 5)).toBe(1);
  });
});

describe("arrow keys in a grid", () => {
  // 8 items in 3 columns:  0 1 2 / 3 4 5 / 6 7
  const move = (key: string, from: number) => nextIndex(key, from, 8, 3);

  it("Left and Right move one item, Up and Down one line", () => {
    expect(move("ArrowRight", 4)).toBe(5);
    expect(move("ArrowLeft", 4)).toBe(3);
    expect(move("ArrowDown", 4)).toBe(7);
    expect(move("ArrowUp", 4)).toBe(1);
  });

  it("Right at the end of a line goes on to the next line, Left back to the one above", () => {
    expect(move("ArrowRight", 2)).toBe(3);
    expect(move("ArrowLeft", 3)).toBe(2);
  });

  it("stops at the edges instead of wrapping", () => {
    expect(move("ArrowLeft", 0)).toBe(0);
    expect(move("ArrowUp", 1)).toBe(1);
    expect(move("ArrowRight", 7)).toBe(7);
    expect(move("ArrowDown", 6)).toBe(6);
    // Nothing below 5 on the short last line: stay.
    expect(move("ArrowDown", 5)).toBe(5);
  });

  it("Home and End jump to the first and last item", () => {
    expect(move("Home", 5)).toBe(0);
    expect(move("End", 1)).toBe(7);
  });
});
