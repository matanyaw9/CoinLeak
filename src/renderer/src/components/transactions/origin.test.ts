import { describe, expect, it } from "vitest";
import type { Rule, TransactionRow } from "@shared/types";
import { categoryOrigin, originText } from "./origin";

const row = (patch: Partial<TransactionRow>): TransactionRow => ({
  id: 1,
  accountId: 1,
  date: "2026-11-01",
  processedDate: null,
  amount: -1000,
  originalAmount: null,
  originalCurrency: null,
  description: "Shop",
  memo: null,
  status: "completed",
  installment: null,
  categoryId: null,
  categorySource: null,
  note: null,
  excluded: false,
  flow: "spending",
  flags: [],
  ruleId: null,
  ...patch,
});
const rule = (id: number, name: string, setCategoryId: number | null, setExcluded: boolean | null = null) =>
  ({ id, name, setCategoryId, setExcluded, position: id }) as Rule;
const rules = [rule(5, "Supermarkets", 9), rule(6, "Hide transfers", null, true)];
const text = (r: TransactionRow) => originText(categoryOrigin(r, rules));

describe("category hover text", () => {
  it("names the rule that set the category, with the rule to edit", () => {
    const r = row({ categoryId: 9, categorySource: "rule", ruleId: 5 });
    expect(text(r)).toBe("Set by rule: Supermarkets");
    expect(categoryOrigin(r, rules)).toEqual({ kind: "rule", rule: rules[0] });
  });

  it("says a rule without naming the wrong one when another rule touched the row last", () => {
    const r = row({ categoryId: 9, categorySource: "rule", ruleId: 6, excluded: true });
    expect(text(r)).toBe("Set by a rule");
    expect(originText(categoryOrigin(row({ categoryId: 9, categorySource: "rule", ruleId: 5 }), undefined))).toBe("Set by a rule");
  });

  it("says the user set it, even if a rule excluded the row", () => {
    expect(text(row({ categoryId: 9, categorySource: "user" }))).toBe("Set by you");
    expect(text(row({ categoryId: 9, categorySource: "user", ruleId: 6, excluded: true }))).toBe("Set by you");
  });

  it("says there is no category yet on uncategorized rows", () => {
    expect(text(row({}))).toBe("No category yet");
    expect(categoryOrigin(row({}), rules)).toEqual({ kind: "none" });
  });
});
