import { describe, expect, it } from "vitest";
import { budgetText, readBudget } from "./budget-box";

describe("readBudget", () => {
  it("reads shekels as agorot", () => {
    expect(readBudget("1500")).toEqual({ kind: "set", agorot: 150000 });
    expect(readBudget("₪1,500.5")).toEqual({ kind: "set", agorot: 150050 });
  });

  it("an empty field clears the budget", () => {
    expect(readBudget("  ")).toEqual({ kind: "clear" });
  });

  it("refuses zero, negative and malformed amounts", () => {
    for (const text of ["0", "-100", "12.345", "abc", "1e3"]) expect(readBudget(text)).toEqual({ kind: "invalid" });
  });
});

describe("budgetText", () => {
  it("shows a saved amount as typed, and none as an empty box", () => {
    expect(budgetText(120000)).toBe("1200");
    expect(budgetText(1250)).toBe("12.50");
    expect(budgetText(null)).toBe("");
  });
});
