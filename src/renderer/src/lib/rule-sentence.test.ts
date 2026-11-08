// The plain sentence for every match mode, field, condition, join and action.

import { describe, expect, it } from "vitest";
import type { Account, Category, RuleCondition, RuleInput } from "@shared/types";
import { ruleSentence, sentenceText, type SentenceContext } from "./rule-sentence";

const groceries: Category = { id: 11, parentId: 1, name: "Groceries", kind: "expense", emoji: "🛒", color: "#81B482", archived: false };
const card: Account = {
  id: 2, provider: "visaCal", kind: "card", accountNumber: "4821", name: "Everyday card", cardMode: "credit", lastSyncedAt: null,
};
const unnamed: Account = { ...card, id: 3, accountNumber: "1234567390", name: null };
const ctx: SentenceContext = {
  category: (id) => (id === groceries.id ? groceries : undefined),
  account: (id) => [card, unnamed].find((a) => a.id === id),
};

const shufersal: RuleCondition = { kind: "text", field: "description", mode: "starts_with", values: ["שופרסל"] };
const base: RuleInput = { name: "x", enabled: true, join: "all", conditions: [shufersal], setCategoryId: 11, setExcluded: null };
const say = (patch: Partial<RuleInput>, maxValues?: number) => sentenceText(ruleSentence({ ...base, ...patch }, ctx, { maxValues }));
const textIs = (patch: Partial<Extract<RuleCondition, { kind: "text" }>>): RuleCondition => ({ ...shufersal, ...patch }) as RuleCondition;
const plus = (...more: RuleCondition[]) => ({ conditions: [shufersal, ...more] });

describe("rule sentence", () => {
  it("reads the spec's example, with If", () => {
    expect(say({})).toBe("If the description starts with שופרסל, set Groceries.");
    expect(say({ conditions: [textIs({ mode: "contains", values: ["Aroma", "Cofix", "Landwer"] })] })).toBe(
      "If the description contains Aroma, Cofix or Landwer, set Groceries.",
    );
  });

  it.each([
    ["contains", "If the description contains שופרסל, set Groceries."],
    ["starts_with", "If the description starts with שופרסל, set Groceries."],
    ["equals", "If the description is exactly שופרסל, set Groceries."],
    ["regex", "If the description matches the pattern שופרסל, set Groceries."],
  ] as const)("mode %s", (mode, expected) => {
    expect(say({ conditions: [textIs({ mode })] })).toBe(expected);
  });

  it("reads two names with or, and cuts a long list short when asked", () => {
    expect(say({ conditions: [textIs({ values: ["a", "b"] })] })).toBe("If the description starts with a or b, set Groceries.");
    const many = textIs({ mode: "contains", values: ["a", "b", "c", "d", "e"] });
    expect(say({ conditions: [many] }, 3)).toBe("If the description contains a, b, c or 2 more, set Groceries.");
  });

  it("reads the memo, trims plain text, keeps a pattern as typed, and holds a place while empty", () => {
    expect(say({ conditions: [textIs({ field: "memo", mode: "contains", values: ["  הוראת קבע "] })] })).toBe(
      "If the memo contains הוראת קבע, set Groceries.",
    );
    expect(say({ conditions: [textIs({ mode: "regex", values: ["netflix|spotify "] })] })).toBe(
      "If the description matches the pattern netflix|spotify , set Groceries.",
    );
    expect(say({ conditions: [textIs({ values: ["  "] })] })).toBe("If the description starts with …, set Groceries.");
  });

  it("names the account, or says it is gone", () => {
    expect(say(plus({ kind: "account", accountId: 2 }))).toBe(
      "If the description starts with שופרסל and it's on Everyday card ··4821, set Groceries.",
    );
    expect(say(plus({ kind: "account", accountId: 3 }))).toBe("If the description starts with שופרסל and it's on Cal ··7390, set Groceries.");
    expect(say(plus({ kind: "account", accountId: 99 }))).toBe(
      "If the description starts with שופרסל and it's on a removed account, set Groceries.",
    );
  });

  it("reads each direction", () => {
    expect(say(plus({ kind: "direction", direction: "out" }))).toBe(
      "If the description starts with שופרסל and it's money going out, set Groceries.",
    );
    expect(say(plus({ kind: "direction", direction: "in" }))).toBe(
      "If the description starts with שופרסל and it's money coming in, set Groceries.",
    );
  });

  it("reads each amount range in whole shekels unless agorot matter", () => {
    const amount = (min: number | null, max: number | null) => say(plus({ kind: "amount", min, max }));
    expect(amount(5800, 64000)).toBe("If the description starts with שופרסל and the amount is between ₪58 and ₪640, set Groceries.");
    expect(amount(10000, null)).toBe("If the description starts with שופרסל and the amount is at least ₪100, set Groceries.");
    expect(amount(null, 5990)).toBe("If the description starts with שופרסל and the amount is at most ₪59.90, set Groceries.");
    expect(amount(5000, 5000)).toBe("If the description starts with שופרסל and the amount is exactly ₪50, set Groceries.");
  });

  it("joins several conditions with and for all, or for any", () => {
    const more = plus({ kind: "account", accountId: 2 }, { kind: "direction", direction: "out" }, { kind: "amount", min: null, max: 6000 });
    expect(say(more)).toBe(
      "If the description starts with שופרסל, it's on Everyday card ··4821, it's money going out and the amount is at most ₪60, set Groceries.",
    );
    expect(say({ ...plus(textIs({ field: "memo", values: ["ארומה"] })), join: "any" })).toBe(
      "If the description starts with שופרסל or the memo starts with ארומה, set Groceries.",
    );
  });

  it("reads each action, both together, a removed category and none yet", () => {
    expect(say({ setCategoryId: null, setExcluded: true })).toBe("If the description starts with שופרסל, don't count it.");
    expect(say({ setCategoryId: null, setExcluded: false })).toBe("If the description starts with שופרסל, always count it.");
    expect(say({ setExcluded: true })).toBe("If the description starts with שופרסל, set Groceries and don't count it.");
    expect(say({ setCategoryId: 42 })).toBe("If the description starts with שופרסל, set a removed category.");
    expect(say({ setCategoryId: null })).toBe("If the description starts with שופרסל, choose what happens.");
  });

  it("marks what the user typed and chose, so screens can style it", () => {
    const parts = ruleSentence({ ...base, ...plus({ kind: "account", accountId: 2 }, { kind: "amount", min: 100, max: null }) }, ctx);
    expect(parts.filter((p) => p.kind !== "text").map((p) => [p.kind, p.text])).toEqual([
      ["value", "שופרסל"],
      ["account", "Everyday card ··4821"],
      ["money", "₪1"],
      ["category", "Groceries"],
    ]);
  });
});
