// Checks a rule from the window and returns it cleaned up. Anything malformed,
// an unknown account or category, or a regex that is too long or does not
// compile is BAD_REQUEST, thrown before anything is saved.

import { CodedError } from "@shared/errors";
import { MAX_CONDITIONS, MAX_NAME, MAX_TEXT, MAX_VALUES } from "@shared/limits";
import type { RuleCondition, RuleDirection, RuleInput, RuleJoin, RuleMatchField, RuleMatchMode } from "@shared/types";
import type { Db } from "../db";
import { check, isId } from "../ledger/validate";
import { cleanText, compileRegex, normalizeText, type Conditions } from "./match";

const FIELDS: readonly RuleMatchField[] = ["description", "memo"];
const MODES: readonly RuleMatchMode[] = ["contains", "starts_with", "equals", "regex"];
const DIRECTIONS: readonly RuleDirection[] = ["out", "in"];
const JOINS: readonly RuleJoin[] = ["all", "any"];

// places.ts reads these from here.
export { MAX_NAME, MAX_VALUES };

type Raw = Partial<Record<keyof RuleInput, unknown>>;

/** The conditions only, which is all a preview needs. */
export function cleanConditions(db: Db, input: unknown): Conditions {
  check(typeof input === "object" && input !== null);
  const r = input as Raw;
  check(JOINS.includes(r.join as RuleJoin));
  check(Array.isArray(r.conditions) && r.conditions.length >= 1 && r.conditions.length <= MAX_CONDITIONS);
  return { join: r.join as RuleJoin, conditions: (r.conditions as unknown[]).map((c) => cleanCondition(db, c)) };
}

/** A whole rule, ready to save: a name and at least one action. */
export function cleanRuleInput(db: Db, input: unknown): RuleInput {
  const conditions = cleanConditions(db, input);
  const r = input as Raw;
  check(typeof r.name === "string");
  const name = r.name.trim();
  check(name !== "" && name.length <= MAX_NAME);
  check(typeof r.enabled === "boolean");
  const setCategoryId = optionalId(r.setCategoryId);
  if (setCategoryId !== null) check(exists(db, "categories", setCategoryId));
  check(r.setExcluded === null || typeof r.setExcluded === "boolean");
  check(setCategoryId !== null || r.setExcluded !== null);
  return { name, enabled: r.enabled, ...conditions, setCategoryId, setExcluded: r.setExcluded as boolean | null };
}

/** A name for a list: cleaned, 1 to 200 characters. */
export function cleanValue(value: unknown): string {
  check(typeof value === "string");
  const text = cleanText(value);
  check(text !== "" && text.length <= MAX_TEXT);
  return text;
}

function cleanCondition(db: Db, input: unknown): RuleCondition {
  check(typeof input === "object" && input !== null);
  const c = input as Record<string, unknown>;
  switch (c.kind) {
    case "text":
      return cleanTextCondition(c);
    case "account": {
      check(isId(c.accountId) && exists(db, "accounts", c.accountId));
      return { kind: "account", accountId: c.accountId };
    }
    case "amount": {
      const min = optionalAmount(c.min);
      const max = optionalAmount(c.max);
      check(min !== null || max !== null);
      check(min === null || max === null || min <= max);
      return { kind: "amount", min, max };
    }
    case "direction":
      check(DIRECTIONS.includes(c.direction as RuleDirection));
      return { kind: "direction", direction: c.direction as RuleDirection };
    default:
      throw new CodedError("BAD_REQUEST");
  }
}

function cleanTextCondition(c: Record<string, unknown>): RuleCondition {
  check(FIELDS.includes(c.field as RuleMatchField));
  check(MODES.includes(c.mode as RuleMatchMode));
  check(Array.isArray(c.values) && c.values.length >= 1 && c.values.length <= MAX_VALUES);
  const mode = c.mode as RuleMatchMode;
  const values: string[] = [];
  const seen = new Set<string>();
  for (const raw of c.values as unknown[]) {
    check(typeof raw === "string");
    // A regex is kept as typed: its spaces and escapes are the user's syntax.
    const value = mode === "regex" ? raw : cleanText(raw);
    check(value.trim() !== "" && value.length <= MAX_TEXT);
    if (mode === "regex") check(compileRegex(value) !== null);
    // The same name twice adds nothing, so it is kept once.
    const key = mode === "regex" ? value : normalizeText(value);
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  return { kind: "text", field: c.field as RuleMatchField, mode, values };
}

function optionalId(value: unknown): number | null {
  check(value === null || isId(value));
  return value as number | null;
}

function optionalAmount(value: unknown): number | null {
  check(value === null || (typeof value === "number" && Number.isSafeInteger(value) && value >= 0));
  return value as number | null;
}

function exists(db: Db, table: "accounts" | "categories", id: number): boolean {
  return db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(id) !== undefined;
}
