// The plain sentence for every match mode, field, condition and action.

import { describe, expect, it } from "vitest";
import type { Account, Category, RuleInput } from "@shared/types";
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

const base: RuleInput = {
  name: "x",
  enabled: true,
  matchField: "description",
  matchMode: "starts_with",
  matchText: "שופרסל",
  accountId: null,
  amountMin: null,
  amountMax: null,
  direction: null,
  setCategoryId: 11,
  setExcluded: null,
};
const say = (patch: Partial<RuleInput>) => sentenceText(ruleSentence({ ...base, ...patch }, ctx));

describe("rule sentence", () => {
  it("reads the spec's example", () => {
    expect(say({})).toBe("When the description starts with שופרסל, set Groceries.");
  });

  it.each([
    ["contains", "When the description contains שופרסל, set Groceries."],
    ["starts_with", "When the description starts with שופרסל, set Groceries."],
    ["equals", "When the description is exactly שופרסל, set Groceries."],
    ["regex", "When the description matches the pattern שופרסל, set Groceries."],
  ] as const)("mode %s", (matchMode, expected) => {
    expect(say({ matchMode })).toBe(expected);
  });

  it("reads the memo, trims plain text, keeps a pattern as typed, and holds a place while empty", () => {
    expect(say({ matchField: "memo", matchMode: "contains", matchText: "  הוראת קבע " })).toBe(
      "When the memo contains הוראת קבע, set Groceries.",
    );
    expect(say({ matchMode: "regex", matchText: "netflix|spotify " })).toBe(
      "When the description matches the pattern netflix|spotify , set Groceries.",
    );
    expect(say({ matchText: "  " })).toBe("When the description starts with …, set Groceries.");
  });

  it("names the account, or says it is gone", () => {
    expect(say({ accountId: 2 })).toBe("When the description starts with שופרסל and it's on Everyday card ··4821, set Groceries.");
    expect(say({ accountId: 3 })).toBe("When the description starts with שופרסל and it's on Cal ··7390, set Groceries.");
    expect(say({ accountId: 99 })).toBe("When the description starts with שופרסל and it's on a removed account, set Groceries.");
  });

  it("reads each direction", () => {
    expect(say({ direction: "out" })).toBe("When the description starts with שופרסל and it's money going out, set Groceries.");
    expect(say({ direction: "in" })).toBe("When the description starts with שופרסל and it's money coming in, set Groceries.");
  });

  it("reads each amount range in whole shekels unless agorot matter", () => {
    expect(say({ amountMin: 5800, amountMax: 64000 })).toBe(
      "When the description starts with שופרסל and the amount is between ₪58 and ₪640, set Groceries.",
    );
    expect(say({ amountMin: 10000 })).toBe("When the description starts with שופרסל and the amount is at least ₪100, set Groceries.");
    expect(say({ amountMax: 5990 })).toBe("When the description starts with שופרסל and the amount is at most ₪59.90, set Groceries.");
    expect(say({ amountMin: 5000, amountMax: 5000 })).toBe(
      "When the description starts with שופרסל and the amount is exactly ₪50, set Groceries.",
    );
  });

  it("lists several conditions with commas and a final and", () => {
    expect(say({ accountId: 2, direction: "out", amountMax: 6000 })).toBe(
      "When the description starts with שופרסל, it's on Everyday card ··4821, it's money going out and the amount is at most ₪60, set Groceries.",
    );
  });

  it("reads each action, both together, a removed category and none yet", () => {
    expect(say({ setCategoryId: null, setExcluded: true })).toBe("When the description starts with שופרסל, don't count it.");
    expect(say({ setCategoryId: null, setExcluded: false })).toBe("When the description starts with שופרסל, always count it.");
    expect(say({ setExcluded: true })).toBe("When the description starts with שופרסל, set Groceries and don't count it.");
    expect(say({ setCategoryId: 42 })).toBe("When the description starts with שופרסל, set a removed category.");
    expect(say({ setCategoryId: null })).toBe("When the description starts with שופרסל, choose what happens.");
  });

  it("marks what the user typed and chose, so screens can style it", () => {
    const parts = ruleSentence({ ...base, accountId: 2, amountMin: 100 }, ctx);
    expect(parts.filter((p) => p.kind !== "text").map((p) => [p.kind, p.text])).toEqual([
      ["value", "שופרסל"],
      ["account", "Everyday card ··4821"],
      ["money", "₪1"],
      ["category", "Groceries"],
    ]);
  });
});
