import { describe, expect, it } from "vitest";
import type { RuleCondition, RuleJoin, RuleMatchMode } from "@shared/types";
import { ruleInput } from "../testing/rules";
import { compileMatcher, normalizeText, prepareRow, type MatchFacts } from "./match";

const row = (facts: Partial<MatchFacts> = {}): MatchFacts => ({
  accountId: 1,
  amount: -5000,
  description: "שופרסל דיל רמת גן",
  memo: null,
  ...facts,
});

function matches(rule: Parameters<typeof ruleInput>[0], facts: Partial<MatchFacts> = {}): boolean {
  return compileMatcher(ruleInput(rule))(prepareRow(row(facts)));
}

describe("match modes", () => {
  it("contains finds the text anywhere", () => {
    expect(matches({ matchText: "דיל" })).toBe(true);
    expect(matches({ matchText: "רמת גן" })).toBe(true);
    expect(matches({ matchText: "חולון" })).toBe(false);
  });

  it("starts_with needs the text at the start", () => {
    expect(matches({ matchMode: "starts_with", matchText: "שופרסל דיל" })).toBe(true);
    expect(matches({ matchMode: "starts_with", matchText: "דיל" })).toBe(false);
  });

  it("equals needs the whole text", () => {
    expect(matches({ matchMode: "equals", matchText: "שופרסל דיל רמת גן" })).toBe(true);
    expect(matches({ matchMode: "equals", matchText: "שופרסל דיל" })).toBe(false);
  });

  it("regex runs on the normalized text, ignoring case", () => {
    expect(matches({ matchMode: "regex", matchText: "^שופרסל (דיל|שלי) " })).toBe(true);
    expect(matches({ matchMode: "regex", matchText: "^שופרסל אקספרס" })).toBe(false);
    expect(matches({ matchMode: "regex", matchText: "^netflix\\.com$" }, { description: "NETFLIX.COM" })).toBe(true);
    // Whitespace is collapsed before the regex sees it.
    expect(matches({ matchMode: "regex", matchText: "דיל רמת" }, { description: "שופרסל  דיל \t רמת גן" })).toBe(true);
  });

  it("ignores case in every mode", () => {
    const facts = { description: "PayPal *Spotify" };
    expect(matches({ matchText: "paypal *SPOTIFY", matchMode: "equals" }, facts)).toBe(true);
    expect(matches({ matchText: "PAYPAL", matchMode: "starts_with" }, facts)).toBe(true);
    expect(matches({ matchText: "spotify" }, facts)).toBe(true);
  });

  it("reads the memo when asked, and a missing memo never matches", () => {
    const memo = { matchField: "memo" as const, matchText: "הוראת קבע" };
    expect(matches(memo, { memo: "הוראת קבע 12" })).toBe(true);
    expect(matches(memo, { memo: null, description: "הוראת קבע" })).toBe(false);
    expect(matches({ matchText: "הוראת קבע" }, { memo: "הוראת קבע", description: "ועד בית" })).toBe(false);
  });
});

describe("Hebrew text and whitespace", () => {
  it("matches across doubled, leading, trailing and non-breaking spaces and tabs", () => {
    const rule = { matchMode: "equals" as const, matchText: "שופרסל דיל רמת גן" };
    for (const description of [
      "שופרסל  דיל רמת גן",
      "  שופרסל דיל רמת גן ",
      "שופרסל\tדיל רמת   גן",
      "שופרסל\nדיל רמת גן",
    ]) {
      expect(matches(rule, { description }), description).toBe(true);
    }
    expect(matches({ matchText: "  שופרסל   דיל  " })).toBe(true);
  });

  it("ignores invisible direction marks around Hebrew and digits", () => {
    expect(matches({ matchMode: "equals", matchText: "סופר 24/7" }, { description: "‏סופר ‎24/7‎" })).toBe(
      true,
    );
  });

  it("normalizeText collapses, trims, drops marks and lowers case", () => {
    expect(normalizeText("  Cafe  קפה‏  ")).toBe("cafe קפה");
  });
});

describe("account, amount and direction conditions", () => {
  it("account must be the rule's account", () => {
    expect(matches({ matchText: "שופרסל", accountId: 1 })).toBe(true);
    expect(matches({ matchText: "שופרסל", accountId: 2 })).toBe(false);
  });

  it("amount range is inclusive and reads the absolute amount, in and out", () => {
    const range = { matchText: "שופרסל", amountMin: 5000, amountMax: 10000 };
    expect(matches(range, { amount: -5000 })).toBe(true);
    expect(matches(range, { amount: -10000 })).toBe(true);
    expect(matches(range, { amount: 7500 })).toBe(true);
    expect(matches(range, { amount: -4999 })).toBe(false);
    expect(matches(range, { amount: -10001 })).toBe(false);
    expect(matches({ matchText: "שופרסל", amountMin: 6000 }, { amount: -99999 })).toBe(true);
    expect(matches({ matchText: "שופרסל", amountMax: 6000 }, { amount: 100 })).toBe(true);
  });

  it("direction out is money out, in is money in, a zero row is out like its flow", () => {
    expect(matches({ matchText: "שופרסל", direction: "out" }, { amount: -100 })).toBe(true);
    expect(matches({ matchText: "שופרסל", direction: "out" }, { amount: 100 })).toBe(false);
    expect(matches({ matchText: "שופרסל", direction: "in" }, { amount: 100 })).toBe(true);
    expect(matches({ matchText: "שופרסל", direction: "in" }, { amount: -100 })).toBe(false);
    expect(matches({ matchText: "שופרסל", direction: "out" }, { amount: 0 })).toBe(true);
  });

  it("all conditions must hold together", () => {
    const rule = { matchText: "שופרסל", accountId: 1, amountMax: 6000, direction: "out" as const };
    expect(matches(rule)).toBe(true);
    expect(matches(rule, { description: "רמי לוי" })).toBe(false);
    expect(matches(rule, { accountId: 2 })).toBe(false);
    expect(matches(rule, { amount: -6001 })).toBe(false);
    expect(matches(rule, { amount: 5000 })).toBe(false);
  });
});

describe("several conditions (spec 13)", () => {
  const cafes: RuleCondition = {
    kind: "text",
    field: "description",
    mode: "contains",
    values: ["ארומה", "Aroma", "קופיקס"],
  };
  const fits = (join: RuleJoin, conditions: RuleCondition[], facts: Partial<MatchFacts>) =>
    compileMatcher({ join, conditions })(prepareRow(row(facts)));

  it("a text condition with several values fits when any value does", () => {
    expect(fits("all", [cafes], { description: "ארומה תל אביב" })).toBe(true);
    expect(fits("all", [cafes], { description: "AROMA TLV" })).toBe(true);
    expect(fits("all", [cafes], { description: "קופיקס  רמת גן" })).toBe(true);
    expect(fits("all", [cafes], { description: "לנדוור" })).toBe(false);
  });

  it("every mode reads every value", () => {
    const text = (mode: RuleMatchMode, values: string[]): RuleCondition => ({
      kind: "text",
      field: "description",
      mode,
      values,
    });
    const facts = { description: "Cofix Ramat Gan" };
    expect(fits("all", [text("starts_with", ["aroma", "cofix"])], facts)).toBe(true);
    expect(fits("all", [text("equals", ["aroma", "cofix ramat gan"])], facts)).toBe(true);
    expect(fits("all", [text("regex", ["^aroma", "gan$"])], facts)).toBe(true);
    expect(fits("all", [text("starts_with", ["aroma", "ramat"])], facts)).toBe(false);
  });

  it("all needs every condition, with account and amount", () => {
    const conditions: RuleCondition[] = [
      cafes,
      { kind: "account", accountId: 2 },
      { kind: "amount", min: 1000, max: 3000 },
    ];
    expect(fits("all", conditions, { description: "Aroma", accountId: 2, amount: -2400 })).toBe(true);
    expect(fits("all", conditions, { description: "Aroma", accountId: 1, amount: -2400 })).toBe(false);
    expect(fits("all", conditions, { description: "Aroma", accountId: 2, amount: -5000 })).toBe(false);
    expect(fits("all", conditions, { description: "לנדוור", accountId: 2, amount: -2400 })).toBe(false);
  });

  it("any needs one condition, with account and amount", () => {
    const conditions: RuleCondition[] = [
      cafes,
      { kind: "account", accountId: 2 },
      { kind: "amount", min: null, max: 1000 },
    ];
    expect(fits("any", conditions, { description: "Aroma", accountId: 1, amount: -5000 })).toBe(true);
    expect(fits("any", conditions, { description: "לנדוור", accountId: 2, amount: -5000 })).toBe(true);
    expect(fits("any", conditions, { description: "לנדוור", accountId: 1, amount: -900 })).toBe(true);
    expect(fits("any", conditions, { description: "לנדוור", accountId: 1, amount: -5000 })).toBe(false);
  });

  it("direction joins like any other condition", () => {
    const conditions: RuleCondition[] = [cafes, { kind: "direction", direction: "in" }];
    expect(fits("all", conditions, { description: "Aroma", amount: 2400 })).toBe(true);
    expect(fits("all", conditions, { description: "Aroma", amount: -2400 })).toBe(false);
    expect(fits("any", conditions, { description: "Wolt", amount: 2400 })).toBe(true);
  });
});
