// Display helpers: grouping amounts under top-level categories for charts,
// day groups with subtotals, and money text without bidi marks.

import { describe, expect, it } from "vitest";
import type { Category, TransactionRow } from "@shared/types";
import { groupByRoot, indexCategories, topSlices } from "./categories";
import { groupByDay } from "./day-groups";
import { ils } from "./format";

const cat = (id: number, parentId: number | null): Category => ({
  id, parentId, name: `c${id}`, kind: "expense", emoji: null, color: "#888888", archived: false,
});

describe("display helpers", () => {
  it("rolls subcategories into their parent and keeps uncategorized apart", () => {
    const index = indexCategories([cat(1, null), cat(11, 1), cat(12, 1), cat(2, null)]);
    const slices = groupByRoot(index, [
      { categoryId: 11, amount: 300 },
      { categoryId: 12, amount: 200 },
      { categoryId: 2, amount: 100 },
      { categoryId: null, amount: 50 },
    ]);
    expect(slices.map((x) => [x.key, x.amount])).toEqual([["1", 500], ["2", 100], ["none", 50]]);
    expect(topSlices(slices, 2).map((x) => [x.key, x.amount])).toEqual([["1", 500], ["other", 150]]);
  });

  it("groups rows by day with spending after refunds and income apart", () => {
    const row = (id: number, date: string, amount: number, flow: TransactionRow["flow"]) => ({ id, date, amount, flow }) as TransactionRow;
    const days = groupByDay([
      row(1, "2026-11-07", -1000, "spending"),
      row(2, "2026-11-07", 300, "refund"),
      row(3, "2026-11-07", -5000, "internal"),
      row(4, "2026-11-06", 900000, "income"),
    ]);
    expect(days.map((d) => [d.date, d.spent, d.income, d.rows.length])).toEqual([
      ["2026-11-07", 700, 0, 3],
      ["2026-11-06", 0, 900000, 1],
    ]);
  });

  it("formats shekels with formatIls minus the bidi marks", () => {
    expect(ils(123456)).not.toMatch(/[‎‏]/);
    expect(ils(123456)).toContain("1,234.56");
    expect(ils(-5000, { decimals: false })).toContain("-50");
  });
});
