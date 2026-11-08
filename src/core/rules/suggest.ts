// A draft rule from rows the user selected: `starts_with` on their longest
// common description prefix (the full text for one row), plus the account
// and amount span they share as further conditions, and their shared
// category. The window shows the account and amount off until opted in.

import type { RuleCondition, RuleInput } from "@shared/types";
import type { Db } from "../db";
import { assertIds, check } from "../ledger/validate";
import { cleanText } from "./match";

interface PickedRow {
  account_id: number;
  amount: number;
  description: string;
  category_id: number | null;
}

/** Unknown ids are skipped; at least one must exist. */
export function suggestRule(db: Db, ids: number[]): RuleInput {
  assertIds(ids);
  const rows = db
    .prepare(
      `SELECT account_id, amount, description, category_id FROM transactions
       WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id`,
    )
    .all(JSON.stringify(ids)) as unknown as PickedRow[];
  check(rows.length > 0);

  const text = commonPrefix(rows.map((r) => cleanText(r.description)));
  const sizes = rows.map((r) => Math.abs(r.amount));
  const accountId = shared(rows.map((r) => r.account_id));
  // No direction condition, so the merchant's refunds get the same category.
  const conditions: RuleCondition[] = [{ kind: "text", field: "description", mode: "starts_with", values: [text] }];
  if (accountId !== null) conditions.push({ kind: "account", accountId });
  conditions.push({ kind: "amount", min: Math.min(...sizes), max: Math.max(...sizes) });
  return {
    name: text,
    enabled: true,
    join: "all",
    conditions,
    setCategoryId: shared(rows.map((r) => r.category_id)),
    setExcluded: null,
  };
}

/**
 * Longest common prefix, ignoring case. When it stops inside a word (a letter
 * or digit on both sides) it is cut back to the last whole word ("שופרסל דיל ר"
 * becomes "שופרסל דיל"), unless it is a single partial word. Empty when the
 * texts share nothing.
 */
export function commonPrefix(texts: string[]): string {
  const chars = texts.map((t) => Array.from(t));
  const first = chars[0] ?? [];
  const same = (a: string | undefined, b: string | undefined): boolean =>
    a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();
  let n = 0;
  while (n < first.length && chars.every((c) => same(c[n], first[n]))) n++;

  let prefix = first.slice(0, n).join("");
  const midWord = isWordChar(first[n - 1]) && chars.some((c) => isWordChar(c[n]));
  const lastSpace = prefix.lastIndexOf(" ");
  if (midWord && lastSpace > 0) prefix = prefix.slice(0, lastSpace);
  return prefix.trim();
}

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[\p{L}\p{N}]/u.test(c);
}

function shared<T>(values: T[]): T | null {
  const first = values[0];
  return first !== undefined && first !== null && values.every((v) => v === first) ? first : null;
}
