import { describe, expect, it } from "vitest";
import { isCashWithdrawal } from "./cash-patterns";

describe("isCashWithdrawal", () => {
  it.each([
    "משיכת מזומן",
    "משיכת מזומנים",
    "משיכה מכספומט",
    "כספומט דיזנגוף",
    "משיכה מבנקט",
    "בנקט 123",
    "ATM WITHDRAWAL",
    "atm tel aviv",
    "Cash  withdrawal",
  ])("reads %s as a withdrawal", (text) => {
    expect(isCashWithdrawal(text, -10000)).toBe(true);
  });

  it.each([
    "חיוב זמני למפתח מזומן",
    "הפקדת מזומן",
    "משיכה מפיקדון",
    "בנקטים", // inside another word
    "BATMAN",
    "שופרסל דיל",
  ])("does not read %s as a withdrawal", (text) => {
    expect(isCashWithdrawal(text, -10000)).toBe(false);
  });

  it("only counts money out", () => {
    expect(isCashWithdrawal("כספומט", 10000)).toBe(false);
    expect(isCashWithdrawal("כספומט", 0)).toBe(false);
  });
});
