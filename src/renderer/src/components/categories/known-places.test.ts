import { describe, expect, it } from "vitest";
import { byCategory } from "./known-places";

describe("byCategory", () => {
  it("keys the channel's lists by category, editing the first rule", () => {
    const map = byCategory([
      { categoryId: 11, names: ["שופרסל"], ruleIds: [3] },
      { categoryId: 13, names: ["ארומה", "Aroma", "Cofix"], ruleIds: [4, 9] },
    ]);
    expect(map.get(13)).toEqual({ categoryId: 13, ruleId: 4, names: ["ארומה", "Aroma", "Cofix"] });
    expect(map.get(11)?.names).toEqual(["שופרסל"]);
  });

  it("skips a category with no names", () => {
    expect(byCategory([{ categoryId: 5, names: [], ruleIds: [2] }]).size).toBe(0);
  });
});
