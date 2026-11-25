// The rules list the window edits: list, save (create or update), delete,
// reorder, Apply now, and a preview that saves nothing. Every change
// reapplies all rules to all rows in the same transaction, so stored rows
// always agree with the list.

import type { Rule, RuleInput, RulePreview, RulePreviewArgs, RuleSaved, RulesApplied } from "@shared/types";
import { transaction, type Db } from "../db";
import { listTransactions } from "../ledger/queries";
import { assertIds, check, isId } from "../ledger/validate";
import { runRules } from "./engine";
import { compileMatcher, prepareRow } from "./match";
import { decidedHigher, ruleOverlaps } from "./order";
import { insertRule, loadRule, loadRules, nextPosition, renumber, writeRule } from "./store";
import { cleanConditions, cleanRuleInput } from "./validate";

export const PREVIEW_SAMPLE = 20;

export interface SaveRequest {
  /** null creates the rule, last in the order. */
  id: number | null;
  rule: unknown;
  /**
   * Rows the user sorted by hand that this rule may take over, once. Only
   * rows the rule matches and the user put in another category are touched;
   * every other row the user set stays as it is.
   */
  alsoChange?: unknown;
}

/** Every rule in order, each with what higher rules decide among the rows it fits (spec 21). */
export function listRules(db: Db): Rule[] {
  const rules = loadRules(db);
  const overlaps = ruleOverlaps(db, rules);
  return rules.map((r) => {
    const found = overlaps.get(r.id);
    return found ? { ...r, overlaps: found } : r;
  });
}

/** Creates or updates a rule, reapplies all rules, and says what that did. */
export function saveRule(db: Db, req: SaveRequest, now = new Date()): RuleSaved {
  check(req.id === null || isId(req.id));
  const rule = cleanRuleInput(db, req.rule);
  const alsoChange = req.alsoChange ?? [];
  assertIds(alsoChange);
  const at = now.toISOString();
  return transaction(db, () => {
    let id: number;
    if (req.id === null) id = insertRule(db, rule, nextPosition(db), at);
    else {
      check(writeRule(db, req.id, rule, at));
      id = req.id;
    }
    handOver(db, rule, alsoChange);
    const run = runRules(db, "all", now);
    return { rule: loadRule(db, id) as Rule, applied: run.applied.get(id) ?? 0, changed: run.changed };
  });
}

/** Adds the rule last in the order. */
export function createRule(db: Db, input: unknown, now = new Date()): Rule {
  return saveRule(db, { id: null, rule: input }, now).rule;
}

/** Replaces the rule's fields; its place in the order stays. */
export function updateRule(db: Db, id: number, input: unknown, now = new Date()): Rule {
  check(isId(id));
  return saveRule(db, { id, rule: input }, now).rule;
}

/** Rows keep nothing the rule set, unless another rule sets it now. */
export function deleteRule(db: Db, id: number, now = new Date()): void {
  check(isId(id));
  transaction(db, () => {
    check(Number(db.prepare("DELETE FROM rules WHERE id = ?").run(id).changes) === 1);
    renumber(
      db,
      loadRules(db).map((r) => r.id),
    );
    runRules(db, "all", now);
  });
}

/** `ids` must hold every rule exactly once, in the new order. */
export function reorderRules(db: Db, ids: number[], now = new Date()): void {
  assertIds(ids);
  transaction(db, () => {
    const current = new Set(loadRules(db).map((r) => r.id));
    check(ids.length === current.size && new Set(ids).size === ids.length && ids.every((id) => current.has(id)));
    renumber(db, ids);
    runRules(db, "all", now);
  });
}

/** "Apply now": every rule over every row, and what that changed. */
export function applyAllRules(db: Db, now = new Date()): RulesApplied {
  return transaction(db, () => {
    const { changed, sorted } = runRules(db, "all", now);
    return { changed, sorted };
  });
}

/**
 * Every row the conditions match, whoever set its fields and whatever other
 * rules say, so the user sees what the rule reads. Name and actions are not
 * needed, so a half-written rule can be previewed while it is edited; with a
 * category, `handSet` lists the matching rows the user sorted elsewhere.
 */
export function previewRule(db: Db, input: unknown): RulePreview {
  const conditions = cleanConditions(db, input);
  const matches = compileMatcher(conditions);
  const raw = input as Partial<RulePreviewArgs>;
  const setCategoryId = raw.setCategoryId ?? null;
  check(setCategoryId === null || isId(setCategoryId));
  const setExcluded = typeof raw.setExcluded === "boolean" ? raw.setExcluded : null;
  check(raw.ruleId === undefined || isId(raw.ruleId));
  const rows = listTransactions(db).filter((t) => matches(prepareRow(t)));
  const handSet =
    setCategoryId === null ? [] : rows.filter((t) => t.categorySource === "user" && t.categoryId !== setCategoryId);
  const higher = rulesAbove(db, raw.ruleId);
  return {
    matches: rows.length,
    sample: rows.slice(0, PREVIEW_SAMPLE),
    handSet,
    decidedHigher: decidedHigher(db, { ...conditions, setCategoryId, setExcluded }, higher),
  };
}

/** The rules checked before rule `id`; every rule when `id` is absent (a new rule goes last). */
function rulesAbove(db: Db, id: number | undefined): Rule[] {
  const rules = loadRules(db);
  const at = rules.findIndex((r) => r.id === id);
  return id === undefined || at === -1 ? rules : rules.slice(0, at);
}

/**
 * Releases the named hand-sorted rows the rule matches to the rules, so the
 * run that follows sets them (they become `category_source = 'rule'`).
 */
function handOver(db: Db, rule: RuleInput, ids: number[]): void {
  if (ids.length === 0 || !rule.enabled || rule.setCategoryId === null) return;
  const matches = compileMatcher(rule);
  const rows = db
    .prepare(
      `SELECT id, account_id, amount, description, memo, category_id FROM transactions
       WHERE trashed_at IS NULL AND category_source = 'user' AND id IN (SELECT value FROM json_each(?))`,
    )
    .all(JSON.stringify(ids)) as unknown as {
    id: number;
    account_id: number;
    amount: number;
    description: string;
    memo: string | null;
    category_id: number | null;
  }[];
  // The rule changes the category, so a pay-back link (spec 33) ends too.
  const release = db.prepare(
    "UPDATE transactions SET category_id = NULL, category_source = 'rule', paid_back_for = NULL WHERE id = ?",
  );
  for (const r of rows) {
    if (r.category_id === rule.setCategoryId) continue;
    const facts = prepareRow({ accountId: r.account_id, amount: r.amount, description: r.description, memo: r.memo });
    if (matches(facts)) release.run(r.id);
  }
}
