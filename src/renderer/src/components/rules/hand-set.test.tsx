// F45: the rule editor lists hand-set rows the rule matches, and saving
// sends every one of them. With none, nothing extra shows. That the save
// really takes them over is tested in core (rules/save.test.ts).

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Category, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { indexCategories } from "@/lib/categories";
import { HandSetList, handSetIds } from "./hand-set";

const gifts: Category = {
  id: 7,
  parentId: null,
  name: "Gifts",
  kind: "expense",
  emoji: "🎁",
  color: "#E3A6B4",
  archived: false,
};

function row(id: number, description: string): TransactionRow {
  return {
    id,
    accountId: 1,
    date: "2026-10-05",
    processedDate: "2026-10-05",
    amount: -12000,
    originalAmount: null,
    originalCurrency: null,
    description,
    memo: null,
    status: "completed",
    installment: null,
    categoryId: gifts.id,
    categorySource: "user",
    note: null,
    excluded: false,
    flow: "spending",
    flags: [],
    ruleId: null,
  };
}

describe("hand-set rows in the rule editor", () => {
  it("lists them, and saving sends every id so all of them change", () => {
    const rows = [row(3, "העברה ב-BIT"), row(9, "העברה ב-BIT"), row(14, "PAYBOX")];
    const html = renderToStaticMarkup(<HandSetList rows={rows} index={indexCategories([gifts])} />);
    expect(html).toContain(s.rulesV2.handSet.willChange(3));
    expect(html).toContain("Gifts");
    expect(html).not.toContain("checkbox");
    expect(handSetIds(rows)).toEqual([3, 9, 14]);
  });

  it("shows nothing when the rule matches no hand-set rows", () => {
    expect(renderToStaticMarkup(<HandSetList rows={[]} index={indexCategories([])} />)).toBe("");
    expect(handSetIds([])).toEqual([]);
  });
});
