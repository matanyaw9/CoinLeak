import { describe, expect, it } from "vitest";
import { findTarget } from "./find-box";
import { foldText, hasText, splitHits } from "./find-text";

describe("page search text", () => {
  it("ignores case, extra spaces and the direction marks banks add", () => {
    expect(foldText("  Super‏  PHARM ")).toBe("super pharm");
    expect(hasText("SUPER PHARM", "pharm")).toBe(true);
    expect(hasText("‏שופרסל דיל‎", "שופרסל  דיל")).toBe(true);
    expect(hasText("רמי לוי", "שופרסל")).toBe(false);
    expect(hasText(null, "x")).toBe(false);
    expect(hasText("anything", "  ")).toBe(true);
  });

  it("cuts text around every hit for highlighting, Hebrew too", () => {
    expect(splitHits("Coffee & cafes", "CAF")).toEqual([
      { text: "Coffee & ", hit: false },
      { text: "caf", hit: true },
      { text: "es", hit: false },
    ]);
    expect(splitHits("קפה קפה", "קפה")).toEqual([
      { text: "קפה", hit: true },
      { text: " ", hit: false },
      { text: "קפה", hit: true },
    ]);
    expect(splitHits("Bars", "")).toEqual([{ text: "Bars", hit: false }]);
  });
});

describe("Ctrl+F", () => {
  it("focuses the page's own box on Transactions, Categories and Rules, and goes to Transactions elsewhere", () => {
    expect(findTarget("/transactions")).toBe("here");
    expect(findTarget("/categories")).toBe("here");
    expect(findTarget("/rules")).toBe("here");
    expect(findTarget("/")).toBe("transactions");
    expect(findTarget("/accounts")).toBe("transactions");
    expect(findTarget("/settings")).toBe("transactions");
  });
});
