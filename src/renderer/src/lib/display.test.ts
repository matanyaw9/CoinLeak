// Display helpers: grouping amounts under top-level categories for charts,
// day groups with subtotals, and money text without bidi marks.

import { describe, expect, it } from "vitest";
import type { Category, TransactionRow } from "@shared/types";
import { indexCategories, OTHER_COLOR, otherSlice, parentSlices } from "./categories";
import { groupByDay } from "./day-groups";
import { awaitingShekels, formatForeign, ils } from "./format";

const cat = (id: number, parentId: number | null): Category => ({
  id, parentId, name: `c${id}`, kind: "expense", emoji: null, color: "#888888", archived: false,
});

describe("display helpers", () => {
  it("the Other bucket is keyed apart from every category and uncategorized", () => {
    expect(otherSlice(150)).toMatchObject({ key: "other", categoryId: undefined, color: OTHER_COLOR, amount: 150 });
  });

  it("draws core's per-parent totals as they are, largest first", () => {
    const index = indexCategories([cat(1, null), cat(11, 1), cat(2, null)]);
    const slices = parentSlices(index, [
      { categoryId: 2, amount: 100 },
      { categoryId: 1, amount: 500 },
      { categoryId: null, amount: 50 },
      { categoryId: 3, amount: -20 },
    ]);
    expect(slices.map((x) => [x.key, x.categoryId, x.amount])).toEqual([["1", 1, 500], ["2", 2, 100], ["none", null, 50]]);
  });

  it("groups rows by day and shows core's day totals as they are", () => {
    const row = (id: number, date: string) => ({ id, date }) as TransactionRow;
    const days = groupByDay(
      [row(1, "2026-11-07"), row(2, "2026-11-07"), row(3, "2026-11-07"), row(4, "2026-11-06")],
      [
        { date: "2026-11-07", spent: 700, income: 0 },
        { date: "2026-11-06", spent: 0, income: 900000 },
      ],
    );
    expect(days.map((d) => [d.date, d.spent, d.income, d.rows.length])).toEqual([
      ["2026-11-07", 700, 0, 3],
      ["2026-11-06", 0, 900000, 1],
    ]);
  });

  it("shows a pending purchase abroad in its own currency until the bank prices it", () => {
    const base = { status: "pending", amount: 0, originalAmount: -5000, originalCurrency: "USD" } as TransactionRow;
    expect(awaitingShekels(base)).toBe(true);
    expect(awaitingShekels({ ...base, status: "completed" })).toBe(false);
    expect(awaitingShekels({ ...base, amount: -18600 })).toBe(false);
    expect(awaitingShekels({ ...base, originalCurrency: "ILS" })).toBe(false);
    expect(awaitingShekels({ ...base, originalCurrency: null })).toBe(false);
    expect(formatForeign(-5000, "USD")).toBe("$50.00");
  });

  it("formats shekels with formatIls minus the bidi marks", () => {
    expect(ils(123456)).not.toMatch(/[‎‏]/);
    expect(ils(123456)).toContain("1,234.56");
    expect(ils(-5000, { decimals: false })).toBe("-₪50");
  });
});
