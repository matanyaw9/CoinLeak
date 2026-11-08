import { describe, expect, it } from "vitest";
import { parseKnownPlaces } from "./known-places";

describe("parseKnownPlaces", () => {
  it("reads spec 13's shape, one entry per category", () => {
    const map = parseKnownPlaces([
      { categoryId: 13, ruleId: 4, names: ["ארומה", "Aroma"] },
      { categoryId: 11, ruleId: 3, names: ["שופרסל"] },
    ]);
    expect(map.get(13)).toEqual({ categoryId: 13, ruleId: 4, names: ["ארומה", "Aroma"] });
    expect(map.get(11)?.names).toEqual(["שופרסל"]);
  });

  it("merges two lists of one category, keeping the first rule to edit", () => {
    const map = parseKnownPlaces([
      { categoryId: 13, ruleId: 4, names: ["Aroma", "Cofix"] },
      { categoryId: 13, ruleId: 9, names: ["Cofix", "Landwer"] },
    ]);
    expect(map.get(13)).toEqual({ categoryId: 13, ruleId: 4, names: ["Aroma", "Cofix", "Landwer"] });
  });

  it("shows nothing for anything else", () => {
    expect(parseKnownPlaces(undefined).size).toBe(0);
    expect(parseKnownPlaces({ 13: ["Aroma"] }).size).toBe(0);
    expect(parseKnownPlaces([null, { categoryId: "13", names: ["x"] }, { categoryId: 5, names: [""] }]).size).toBe(0);
    expect(parseKnownPlaces([{ categoryId: 5, names: ["x"] }]).get(5)?.ruleId).toBeNull();
  });
});
