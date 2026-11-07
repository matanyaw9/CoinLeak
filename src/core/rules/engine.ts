// Runs the rules over rows. For each action field (category, excluded) the
// first enabled rule in order whose conditions match sets it. A field the
// user set is never touched; a field a rule set earlier is recomputed, and
// cleared when no rule matches any more, so editing a rule fixes old rows.

import type { CategorySource } from "@shared/types";
import { transaction, type Db } from "../db";
import { applyCardBills } from "../ledger/card-bills";
import { assertIds, check, isId } from "../ledger/validate";
import { compileMatcher, prepareRow, type Matcher } from "./match";
import { loadRules } from "./store";

/** Rows from one sync run, chosen rows, or every row. */
export type RuleScope = "all" | { runId: number } | { ids: number[] };

export interface RuleRunStats {
  /** Rows whose category, exclusion or rule changed. */
  changed: number;
}

type Bit = 0 | 1;
type ExcludedSource = "user" | "rule";

interface CompiledRule {
  id: number;
  matches: Matcher;
  setCategoryId: number | null;
  setExcluded: Bit | null;
}

/** The fields rules own on a row. */
interface RuleFields {
  category_id: number | null;
  category_source: CategorySource | null;
  excluded: Bit;
  excluded_source: ExcludedSource | null;
  rule_id: number | null;
}

interface StoredRow extends RuleFields {
  id: number;
  account_id: number;
  amount: number;
  description: string;
  memo: string | null;
}

const FIELD_KEYS: (keyof RuleFields)[] = ["category_id", "category_source", "excluded", "excluded_source", "rule_id"];

export function applyRules(db: Db, scope: RuleScope, now = new Date()): RuleRunStats {
  assertScope(scope);
  return transaction(db, () => applyRulesInTransaction(db, scope, now));
}

/** Same as `applyRules`, for callers already inside a transaction (ingest). */
export function applyRulesInTransaction(db: Db, scope: RuleScope, now = new Date()): RuleRunStats {
  assertScope(scope);
  const rules: CompiledRule[] = loadRules(db)
    .filter((r) => r.enabled)
    .map((r) => ({
      id: r.id,
      matches: compileMatcher(r),
      setCategoryId: r.setCategoryId,
      setExcluded: r.setExcluded === null ? null : r.setExcluded ? 1 : 0,
    }));
  const update = db.prepare(
    `UPDATE transactions SET category_id = ?, category_source = ?, excluded = ?, excluded_source = ?, rule_id = ?,
       updated_at = ? WHERE id = ?`,
  );
  const at = now.toISOString();
  let changed = 0;
  let exclusionChanged = false;
  for (const row of loadRows(db, scope)) {
    const next = decide(row, rules);
    if (FIELD_KEYS.every((k) => row[k] === next[k])) continue;
    update.run(...FIELD_KEYS.map((k) => next[k]), at, row.id);
    changed++;
    if (row.excluded !== next.excluded) exclusionChanged = true;
  }
  // Excluded bank lines are frozen for the card-bill matcher, so rematch.
  if (exclusionChanged) applyCardBills(db);
  return { changed };
}

function decide(row: StoredRow, rules: CompiledRule[]): RuleFields {
  const userCategory = row.category_source === "user";
  // An exclusion with no source predates rules, so it is the user's.
  const userExcluded = row.excluded_source === "user" || (row.excluded === 1 && row.excluded_source === null);
  const next: RuleFields = { ...pickFields(row), rule_id: null };
  if (userCategory && userExcluded) return next;

  const { account_id: accountId, amount, description, memo } = row;
  const facts = prepareRow({ accountId, amount, description, memo });
  let categoryRule: CompiledRule | undefined;
  let excludedRule: CompiledRule | undefined;
  for (const rule of rules) {
    const wantsCategory = !userCategory && !categoryRule && rule.setCategoryId !== null;
    const wantsExcluded = !userExcluded && !excludedRule && rule.setExcluded !== null;
    if (!(wantsCategory || wantsExcluded) || !rule.matches(facts)) continue;
    if (wantsCategory) categoryRule = rule;
    if (wantsExcluded) excludedRule = rule;
  }

  if (!userCategory) {
    if (categoryRule) {
      next.category_id = categoryRule.setCategoryId;
      next.category_source = "rule";
    } else if (row.category_source === "rule") {
      next.category_id = null;
      next.category_source = null;
    }
  }
  if (!userExcluded) {
    if (excludedRule) {
      next.excluded = excludedRule.setExcluded as Bit;
      next.excluded_source = "rule";
    } else if (row.excluded_source === "rule") {
      next.excluded = 0;
      next.excluded_source = null;
    }
  }
  // The last rule in order that set something here.
  const applied = rules.filter((r) => r === categoryRule || r === excludedRule);
  next.rule_id = applied.at(-1)?.id ?? null;
  return next;
}

function pickFields(row: StoredRow): RuleFields {
  return {
    category_id: row.category_id,
    category_source: row.category_source,
    excluded: row.excluded,
    excluded_source: row.excluded_source,
    rule_id: row.rule_id,
  };
}

function loadRows(db: Db, scope: RuleScope): StoredRow[] {
  const select = `SELECT id, account_id, amount, description, memo, category_id, category_source, excluded,
    excluded_source, rule_id FROM transactions`;
  if (scope === "all") return db.prepare(`${select} ORDER BY id`).all() as unknown as StoredRow[];
  if ("runId" in scope) {
    return db.prepare(`${select} WHERE sync_run_id = ? ORDER BY id`).all(scope.runId) as unknown as StoredRow[];
  }
  return db
    .prepare(`${select} WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id`)
    .all(JSON.stringify(scope.ids)) as unknown as StoredRow[];
}

function assertScope(scope: unknown): asserts scope is RuleScope {
  if (scope === "all") return;
  check(typeof scope === "object" && scope !== null);
  if ("runId" in scope) check(isId(scope.runId));
  else if ("ids" in scope) assertIds(scope.ids);
  else check(false);
}
