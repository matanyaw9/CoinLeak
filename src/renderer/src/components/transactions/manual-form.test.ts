import { describe, expect, it } from "vitest";
import type { TransactionRow } from "@shared/types";
import { emptyForm, formOf, inputOf } from "./manual-form";

describe("inputOf", () => {
  const form = { ...emptyForm("2026-11-09"), amount: "18", description: " קפה " };

  it("reads the typed shekels as agorot", () => {
    expect(inputOf({ ...form, amount: "₪1,200.5" })).toMatchObject({ amount: -120050 });
    expect(inputOf({ ...form, amount: "0.07", direction: "in" })).toMatchObject({ amount: 7 });
  });

  it.each(["0", "0.00", "-5", "1.234", "abc", "1e3"])("refuses the amount %j", (amount) => {
    expect(inputOf({ ...form, amount })).toBeNull();
  });

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
