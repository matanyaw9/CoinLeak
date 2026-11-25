import { describe, expect, it } from "vitest";
import type { Account, Category, Rule } from "@shared/types";
import type { SentenceContext } from "@/lib/rule-sentence";
import { ruleHits, valueHits } from "./rule-search";

const groceries: Category = {
  id: 11,
  parentId: null,
  name: "Groceries",
  kind: "expense",
  emoji: null,
  color: null,
  archived: false,
};
const account = { id: 2, provider: "visaCal", name: "Everyday card", accountNumber: "4821" } as Account;
const ctx: SentenceContext = {
  category: (id) => (id === groceries.id ? groceries : undefined),
  account: (id) => (id === account.id ? account : undefined),
};

const rule: Rule = {
  id: 1,
  position: 1,
  name: "Supermarkets",
  enabled: true,
  join: "all",
  conditions: [
    { kind: "text", field: "description", mode: "contains", values: ["שופרסל", "RAMI LEVY"] },
    { kind: "account", accountId: 2 },
  ],
  setCategoryId: groceries.id,
  setExcluded: null,
};

describe("the Rules search", () => {
  it("finds a rule by its name", () => {
    expect(ruleHits(rule, "market", ctx)).toBe(true);
  });

  it("finds a rule by a condition value, Hebrew or English, and says which", () => {
    expect(ruleHits(rule, "שופר", ctx)).toBe(true);
    expect(valueHits(rule, "שופר", ctx)).toEqual(["שופרסל"]);
    expect(valueHits(rule, "rami", ctx)).toEqual(["RAMI LEVY"]);
    expect(valueHits(rule, "everyday", ctx)).toEqual(["Everyday card ··4821"]);
  });

  it("finds a rule by the category it sets", () => {
    expect(ruleHits(rule, "grocer", ctx)).toBe(true);
  });

  it("does not find what is not there", () => {
    expect(ruleHits(rule, "pharm", ctx)).toBe(false);
    expect(valueHits(rule, "market", ctx)).toEqual([]);
  });
});
