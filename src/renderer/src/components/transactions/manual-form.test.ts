import { describe, expect, it } from "vitest";
import type { TransactionRow } from "@shared/types";
import { emptyForm, formOf, inputOf, parseShekels, shekelsText } from "./manual-form";

describe("parseShekels", () => {
  it.each([
    ["45", 4500],
    ["12.5", 1250],
    ["12.50", 1250],
    ["0.07", 7],
    ["1,200.90", 120090],
    [" ₪ 30 ", 3000],
    ["19.99", 1999],
  ])("%s is %i agorot", (text, agorot) => {
    expect(parseShekels(text)).toBe(agorot);
  });

  it.each(["", "0", "0.00", "-5", "1.234", "abc", "1.2.3", "1e3"])("refuses %s", (text) => {
    expect(parseShekels(text)).toBeNull();
  });

  it("goes back to text", () => {
    expect(shekelsText(-4500)).toBe("45");
    expect(shekelsText(1250)).toBe("12.50");
    expect(shekelsText(7)).toBe("0.07");
  });
});

describe("inputOf", () => {
  const form = { ...emptyForm("2026-11-09"), amount: "18", description: " קפה " };

  it("money out is negative, money in positive, text trimmed, empty note is none", () => {
    expect(inputOf(form)).toEqual({ date: "2026-11-09", amount: -1800, description: "קפה", categoryId: null, note: null });
    expect(inputOf({ ...form, direction: "in", note: " hi " })).toMatchObject({ amount: 1800, note: "hi" });
  });

  it("is null while something is missing or too long", () => {
    expect(inputOf({ ...form, amount: "" })).toBeNull();
    expect(inputOf({ ...form, description: "  " })).toBeNull();
    expect(inputOf({ ...form, description: "x".repeat(201) })).toBeNull();
    expect(inputOf({ ...form, note: "x".repeat(501) })).toBeNull();
    expect(inputOf({ ...form, date: "" })).toBeNull();
  });

  it("an edited row comes back as it was", () => {
    const row = { date: "2026-11-02", amount: 20000, description: "מזומן מסבתא", categoryId: null, note: "Birthday" } as TransactionRow;
    expect(inputOf(formOf(row))).toEqual({ date: "2026-11-02", amount: 20000, description: "מזומן מסבתא", categoryId: null, note: "Birthday" });
  });
});
