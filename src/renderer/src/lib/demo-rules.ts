// The rules engine for demo builds only: checks, matching, applying and
// suggesting, written to behave like src/core/rules so screenshots show what
// the real app does. Real builds never load it; core owns the real logic.

import type { Agorot, CategorySource, Rule, RuleInput, RuleMatchField, RuleMatchMode } from "@shared/types";

type Conditions = Pick<RuleInput, "matchField" | "matchMode" | "matchText" | "accountId" | "amountMin" | "amountMax" | "direction">;

/** The fields of a demo row that rules read and write. */
export interface RuleTarget {
  id: number;
  accountId: number;
  amount: Agorot;
  description: string;
  memo: string | null;
  categoryId: number | null;
  categorySource: CategorySource | null;
  excluded: boolean;
  excludedSource: "user" | "rule" | null;
  ruleId: number | null;
}

const MAX_TEXT = 200;
const MAX_NAME = 100;
const FIELDS: readonly RuleMatchField[] = ["description", "memo"];
const MODES: readonly RuleMatchMode[] = ["contains", "starts_with", "equals", "regex"];
// Invisible marks banks put around Hebrew and digits, as in core.
const DIRECTION_MARKS = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

export const cleanText = (text: string) => text.replace(DIRECTION_MARKS, "").replace(/\s+/g, " ").trim();
const normalize = (text: string) => cleanText(text).toLowerCase();

function compileRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

const isId = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const isAmount = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

/** Same checks as core's `cleanConditions`; null means BAD_REQUEST. */
export function cleanConditions(input: unknown, accountIds: ReadonlySet<number>): Conditions | null {
  if (typeof input !== "object" || input === null) return null;
  const r = input as Partial<Record<keyof RuleInput, unknown>>;
  if (!FIELDS.includes(r.matchField as RuleMatchField) || !MODES.includes(r.matchMode as RuleMatchMode)) return null;
  if (typeof r.matchText !== "string") return null;
  const matchMode = r.matchMode as RuleMatchMode;
  const matchText = matchMode === "regex" ? r.matchText : cleanText(r.matchText);
  if (matchText.trim() === "" || matchText.length > MAX_TEXT) return null;
  if (matchMode === "regex" && !compileRegex(matchText)) return null;
  if (!(r.accountId === null || (isId(r.accountId) && accountIds.has(r.accountId)))) return null;
  if (!(r.amountMin === null || isAmount(r.amountMin)) || !(r.amountMax === null || isAmount(r.amountMax))) return null;
  if (r.amountMin !== null && r.amountMax !== null && (r.amountMin as number) > (r.amountMax as number)) return null;
  if (!(r.direction === null || r.direction === "in" || r.direction === "out")) return null;
  return {
    matchField: r.matchField as RuleMatchField,
    matchMode,
    matchText,
    accountId: r.accountId as number | null,
    amountMin: r.amountMin as number | null,
    amountMax: r.amountMax as number | null,
    direction: r.direction,
  };
}

/** Same checks as core's `cleanRuleInput`: a name and at least one action. */
export function cleanRule(input: unknown, accountIds: ReadonlySet<number>, categoryIds: ReadonlySet<number>): RuleInput | null {
  const conditions = cleanConditions(input, accountIds);
  if (!conditions) return null;
  const r = input as Partial<Record<keyof RuleInput, unknown>>;
  if (typeof r.name !== "string" || typeof r.enabled !== "boolean") return null;
  const name = r.name.trim();
  if (name === "" || name.length > MAX_NAME) return null;
  if (!(r.setCategoryId === null || (isId(r.setCategoryId) && categoryIds.has(r.setCategoryId)))) return null;
  if (!(r.setExcluded === null || typeof r.setExcluded === "boolean")) return null;
  if (r.setCategoryId === null && r.setExcluded === null) return null;
  return {
    name,
    enabled: r.enabled,
    ...conditions,
    setCategoryId: r.setCategoryId as number | null,
    setExcluded: r.setExcluded as boolean | null,
  };
}

export function matcher(c: Conditions): (row: Pick<RuleTarget, "accountId" | "amount" | "description" | "memo">) => boolean {
  const pattern = c.matchMode === "regex" ? compileRegex(c.matchText) : null;
  const p = normalize(c.matchText);
  return (row) => {
    if (c.accountId !== null && row.accountId !== c.accountId) return false;
    if (c.direction !== null && (row.amount > 0 ? "in" : "out") !== c.direction) return false;
    const size = Math.abs(row.amount);
    if (c.amountMin !== null && size < c.amountMin) return false;
    if (c.amountMax !== null && size > c.amountMax) return false;
    const raw = c.matchField === "description" ? row.description : row.memo;
    if (raw === null) return false;
    const text = normalize(raw);
    if (c.matchMode === "regex") return pattern !== null && pattern.test(text);
    if (c.matchMode === "contains") return text.includes(p);
    if (c.matchMode === "starts_with") return text.startsWith(p);
    return text === p;
  };
}

/**
 * For each field, the first enabled matching rule in order sets it. Fields
 * the user set stay; a field a rule set earlier is cleared when no rule
 * matches any more. Returns the ids of rows that changed.
 */
export function applyRules(rows: RuleTarget[], rules: Rule[]): number[] {
  const live = rules.filter((r) => r.enabled).map((r) => ({ rule: r, matches: matcher(r) }));
  const changed: number[] = [];
  for (const row of rows) {
    const before = JSON.stringify([row.categoryId, row.categorySource, row.excluded, row.excludedSource, row.ruleId]);
    decide(row, live);
    if (JSON.stringify([row.categoryId, row.categorySource, row.excluded, row.excludedSource, row.ruleId]) !== before) {
      changed.push(row.id);
    }
  }
  return changed;
}

function decide(row: RuleTarget, rules: { rule: Rule; matches: ReturnType<typeof matcher> }[]): void {
  const userCategory = row.categorySource === "user";
  const userExcluded = row.excludedSource === "user" || (row.excluded && row.excludedSource === null);
  row.ruleId = null;
  if (userCategory && userExcluded) return;
  let categoryRule: Rule | undefined;
  let excludedRule: Rule | undefined;
  for (const { rule, matches } of rules) {
    const wantsCategory = !userCategory && !categoryRule && rule.setCategoryId !== null;
    const wantsExcluded = !userExcluded && !excludedRule && rule.setExcluded !== null;
    if (!(wantsCategory || wantsExcluded) || !matches(row)) continue;
    if (wantsCategory) categoryRule = rule;
    if (wantsExcluded) excludedRule = rule;
  }
  if (!userCategory) {
    if (categoryRule) {
      row.categoryId = categoryRule.setCategoryId;
      row.categorySource = "rule";
    } else if (row.categorySource === "rule") {
      row.categoryId = null;
      row.categorySource = null;
    }
  }
  if (!userExcluded) {
    if (excludedRule) {
      row.excluded = excludedRule.setExcluded === true;
      row.excludedSource = "rule";
    } else if (row.excludedSource === "rule") {
      row.excluded = false;
      row.excludedSource = null;
    }
  }
  const applied = rules.filter(({ rule }) => rule === categoryRule || rule === excludedRule);
  row.ruleId = applied.at(-1)?.rule.id ?? null;
}

/** Same draft as core's `suggestRule`, from rows in id order. */
export function suggest(rows: Pick<RuleTarget, "accountId" | "amount" | "description" | "categoryId">[]): RuleInput | null {
  if (rows.length === 0) return null;
  const matchText = commonPrefix(rows.map((r) => cleanText(r.description)));
  const sizes = rows.map((r) => Math.abs(r.amount));
  return {
    name: matchText,
    enabled: true,
    matchField: "description",
    matchMode: "starts_with",
    matchText,
    accountId: shared(rows.map((r) => r.accountId)),
    amountMin: Math.min(...sizes),
    amountMax: Math.max(...sizes),
    direction: null,
    setCategoryId: shared(rows.map((r) => r.categoryId)),
    setExcluded: null,
  };
}

function commonPrefix(texts: string[]): string {
  const chars = texts.map((t) => Array.from(t));
  const first = chars[0] ?? [];
  const same = (a: string | undefined, b: string | undefined) =>
    a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();
  let n = 0;
  while (n < first.length && chars.every((c) => same(c[n], first[n]))) n++;
  let prefix = first.slice(0, n).join("");
  const word = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
  const lastSpace = prefix.lastIndexOf(" ");
  if (word(first[n - 1]) && chars.some((c) => word(c[n])) && lastSpace > 0) prefix = prefix.slice(0, lastSpace);
  return prefix.trim();
}

function shared<T>(values: T[]): T | null {
  const first = values[0];
  return first !== undefined && first !== null && values.every((v) => v === first) ? first : null;
}
