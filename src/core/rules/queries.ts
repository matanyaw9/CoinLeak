// The rules list the window edits: list, create, update, delete, reorder, and
// a preview that saves nothing. Every change reapplies all rules to all rows
// in the same transaction, so stored rows always agree with the list.

import type { Rule, RulePreview } from "@shared/types";
import { transaction, type Db } from "../db";
import { listTransactions } from "../ledger/queries";
import { assertIds, check, isId } from "../ledger/validate";
import { applyRulesInTransaction } from "./engine";
import { compileMatcher, prepareRow } from "./match";
import { insertRule, loadRule, loadRules, renumber, writeRule } from "./store";
import { cleanConditions, cleanRuleInput } from "./validate";

export const PREVIEW_SAMPLE = 20;

export function listRules(db: Db): Rule[] {
  return loadRules(db);
}

/** Adds the rule last in the order. */
export function createRule(db: Db, input: unknown, now = new Date()): Rule {
  const rule = cleanRuleInput(db, input);
  const at = now.toISOString();
  return transaction(db, () => {
    const { last } = db.prepare("SELECT COALESCE(MAX(position), 0) AS last FROM rules").get() as { last: number };
    const id = insertRule(db, rule, last + 1, at);
    applyRulesInTransaction(db, "all", now);
    return loadRule(db, id) as Rule;
  });
}

/** Replaces the rule's fields; its place in the order stays. */
export function updateRule(db: Db, id: number, input: unknown, now = new Date()): Rule {
  check(isId(id));
  const rule = cleanRuleInput(db, input);
  return transaction(db, () => {
    check(writeRule(db, id, rule, now.toISOString()));
    applyRulesInTransaction(db, "all", now);
    return loadRule(db, id) as Rule;
  });
}

/** Rows keep nothing the rule set, unless another rule sets it now. */
export function deleteRule(db: Db, id: number, now = new Date()): void {
  check(isId(id));
  transaction(db, () => {
    check(Number(db.prepare("DELETE FROM rules WHERE id = ?").run(id).changes) === 1);
    renumber(db, loadRules(db).map((r) => r.id));
    applyRulesInTransaction(db, "all", now);
  });
}

/** `ids` must hold every rule exactly once, in the new order. */
export function reorderRules(db: Db, ids: number[], now = new Date()): void {
  assertIds(ids);
  transaction(db, () => {
    const current = new Set(loadRules(db).map((r) => r.id));
    check(ids.length === current.size && new Set(ids).size === ids.length && ids.every((id) => current.has(id)));
    renumber(db, ids);
    applyRulesInTransaction(db, "all", now);
  });
}

/**
 * Every row the conditions match, whoever set its fields and whatever other
 * rules say, so the user sees what the rule reads. Name and actions are not
 * needed yet, so a half-written rule can be previewed while it is edited.
 */
export function previewRule(db: Db, input: unknown): RulePreview {
  const matches = compileMatcher(cleanConditions(db, input));
  const rows = listTransactions(db).filter((t) => matches(prepareRow(t)));
  return { matches: rows.length, sample: rows.slice(0, PREVIEW_SAMPLE) };
}
