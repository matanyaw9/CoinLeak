// How one rule's conditions read one row: text on description or memo, then
// account, amount range on the absolute amount, and direction. Text compares
// without case, without direction marks, and with whitespace runs collapsed.

import type { Agorot, RuleInput, RuleMatchField, RuleMatchMode } from "@shared/types";

export type Conditions = Pick<
  RuleInput,
  "matchField" | "matchMode" | "matchText" | "accountId" | "amountMin" | "amountMax" | "direction"
>;

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

/** Conditions must already be valid (see `validate.ts`). */
export function compileMatcher(c: Conditions): Matcher {
  const matchesText = textTest(c.matchMode, c.matchText);
  return (row) => {
    if (c.accountId !== null && row.accountId !== c.accountId) return false;
    if (c.direction !== null && directionOf(row.amount) !== c.direction) return false;
    const size = Math.abs(row.amount);
    if (c.amountMin !== null && size < c.amountMin) return false;
    if (c.amountMax !== null && size > c.amountMax) return false;
    const text = row.text[c.matchField];
    return text !== null && matchesText(text);
  };
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
