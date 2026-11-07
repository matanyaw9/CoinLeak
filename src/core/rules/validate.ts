// Checks a rule from the window and returns it cleaned up. Anything malformed,
// an unknown account or category, or a regex that is too long or does not
// compile is BAD_REQUEST, thrown before anything is saved.

import type { RuleDirection, RuleInput, RuleMatchField, RuleMatchMode } from "@shared/types";
import type { Db } from "../db";
import { check, isId } from "../ledger/validate";
import { cleanText, compileRegex, type Conditions } from "./match";

export const MAX_TEXT = 200;
export const MAX_NAME = 100;

const FIELDS: readonly RuleMatchField[] = ["description", "memo"];
const MODES: readonly RuleMatchMode[] = ["contains", "starts_with", "equals", "regex"];
const DIRECTIONS: readonly RuleDirection[] = ["out", "in"];

type Raw = Partial<Record<keyof RuleInput, unknown>>;

/** The conditions only, which is all a preview needs. */
export function cleanConditions(db: Db, input: unknown): Conditions {
  check(typeof input === "object" && input !== null);
  const r = input as Raw;
  check(FIELDS.includes(r.matchField as RuleMatchField));
  check(MODES.includes(r.matchMode as RuleMatchMode));
  check(typeof r.matchText === "string");
  const matchMode = r.matchMode as RuleMatchMode;
  // A regex is kept as typed: its spaces and escapes are the user's syntax.
  const matchText = matchMode === "regex" ? r.matchText : cleanText(r.matchText);
  check(matchText.trim() !== "" && matchText.length <= MAX_TEXT);
  if (matchMode === "regex") check(compileRegex(matchText) !== null);

  const accountId = optionalId(r.accountId);
  if (accountId !== null) check(exists(db, "accounts", accountId));
  const amountMin = optionalAmount(r.amountMin);
  const amountMax = optionalAmount(r.amountMax);
  check(amountMin === null || amountMax === null || amountMin <= amountMax);
  check(r.direction === null || DIRECTIONS.includes(r.direction as RuleDirection));

  return {
    matchField: r.matchField as RuleMatchField,
    matchMode,
    matchText,
    accountId,
    amountMin,
    amountMax,
    direction: r.direction as RuleDirection | null,
  };
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
  return {
    name,
    enabled: r.enabled,
    ...conditions,
    setCategoryId,
    setExcluded: r.setExcluded as boolean | null,
  };
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
