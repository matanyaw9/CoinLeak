import { describe, expect, it } from "vitest";
import { readBudget } from "./budget-field";

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
