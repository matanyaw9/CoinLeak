// How a rule's conditions read one row: text on description or memo (any of
// its values), account, amount range on the absolute amount, and direction,
// joined by all or any. Text compares without case, without direction marks,
// and with whitespace runs collapsed.

import type { Agorot, RuleCondition, RuleInput, RuleMatchField, RuleMatchMode } from "@shared/types";

export type Conditions = Pick<RuleInput, "join" | "conditions">;

/** What the conditions read from a row. */
export interface MatchFacts {
  accountId: number;
  amount: Agorot;
  description: string;
  memo: string | null;
}

/** A row with its texts normalized once, so many rules can read it cheaply. */
export interface PreparedRow {
  accountId: number;
  amount: Agorot;
  text: Record<RuleMatchField, string | null>;
}

export type Matcher = (row: PreparedRow) => boolean;

// Invisible marks banks put around Hebrew and digits: ALM, LRM, RLM,
// embeddings and overrides, isolates.
const DIRECTION_MARKS = /[؜‎‏‪-‮⁦-⁩]/g;

/** Text as stored and shown: direction marks dropped, whitespace collapsed. */
export function cleanText(text: string): string {
  return text.replace(DIRECTION_MARKS, "").replace(/\s+/g, " ").trim();
}

/** Text as compared: `cleanText`, lower case. */
export function normalizeText(text: string): string {
  return cleanText(text).toLowerCase();
}

export function prepareRow(row: MatchFacts): PreparedRow {
  return {
    accountId: row.accountId,
    amount: row.amount,
    text: {
      description: normalizeText(row.description),
      memo: row.memo === null ? null : normalizeText(row.memo),
    },
  };
}

/** Case-insensitive, like the other modes. `null` when it does not compile. */
export function compileRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

export { hasNestedRepeat } from "@shared/pattern-guard";

/** Conditions must already be valid (see `validate.ts`). */
export function compileMatcher(c: Conditions): Matcher {
  const tests = c.conditions.map(compileCondition);
  if (c.join === "any") return (row) => tests.some((t) => t(row));
  return (row) => tests.every((t) => t(row));
}

function compileCondition(c: RuleCondition): Matcher {
  switch (c.kind) {
    case "account":
      return (row) => row.accountId === c.accountId;
    case "direction":
      return (row) => directionOf(row.amount) === c.direction;
    case "amount":
      return (row) => {
        const size = Math.abs(row.amount);
        return (c.min === null || size >= c.min) && (c.max === null || size <= c.max);
      };
    case "text": {
      const fits = c.values.map((v) => textTest(c.mode, v));
      return (row) => {
        const text = row.text[c.field];
        return text !== null && fits.some((f) => f(text));
      };
    }
  }
}

/** Same split as the flow: money in is above zero, everything else is out. */
function directionOf(amount: Agorot): "in" | "out" {
  return amount > 0 ? "in" : "out";
}

function textTest(mode: RuleMatchMode, pattern: string): (text: string) => boolean {
  if (mode === "regex") {
    const re = compileRegex(pattern);
    return (text) => re !== null && re.test(text);
  }
  const p = normalizeText(pattern);
  if (mode === "contains") return (text) => text.includes(p);
  if (mode === "starts_with") return (text) => text.startsWith(p);
  return (text) => text === p;
}
