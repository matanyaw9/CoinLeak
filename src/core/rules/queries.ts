// The rules list the window edits: list, save (create or update), delete,
// reorder, Apply now, and a preview that saves nothing. Every change
// reapplies all rules to all rows in the same transaction, so stored rows
// always agree with the list. Saving also records the rows the user
// unticked in the editor as the rule's exceptions (spec 35).

import type { Rule, RuleInput, RulePreview, RulePreviewArgs, RuleSaved, RulesApplied } from "@shared/types";
import { transaction, type Db } from "../db";
import { listTransactions } from "../ledger/queries";
import { assertIds, check, isId } from "../ledger/validate";
import { decidedBy, runRules } from "./engine";
import { compileMatcher, prepareRow, type PreparedRow } from "./match";
import { decidedHigher, ruleOverlaps } from "./order";
import {
  addExceptions,
  exceptionsAmong,
  insertRule,
  loadRule,
  loadRules,
  nextPosition,
  removeExceptions,
  renumber,
  writeRule,
} from "./store";
import { cleanConditions, cleanRuleInput } from "./validate";

/** The editor lists at most this many matching rows, newest first (spec 35). */
export const PREVIEW_ROWS = 500;

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
  /**
   * spec 35: rows the editor showed that the user unticked. They become the
   * rule's exceptions; a row the rule sorted keeps what it has, as the user's.
   * An id here wins over the same id in `ticked` or `alsoChange`.
   */
  unticked?: unknown;
  /**
   * spec 35: rows the editor showed ticked. Any exception they had ends, and
   * that is all: a row the user set stays theirs (review of wave 14).
   */
  ticked?: unknown;
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
  const unticked = req.unticked ?? [];
  const ticked = req.ticked ?? [];
  assertIds(alsoChange);
  assertIds(unticked);
  assertIds(ticked);
  const at = now.toISOString();
  return transaction(db, () => {
    let id: number;
    if (req.id === null) id = insertRule(db, rule, nextPosition(db), at);
    else {
      // Before the rule changes: what it sorts now is what unticked rows keep.
      keepForUser(db, req.id, unticked, at);
      check(writeRule(db, req.id, rule, at));
      id = req.id;
    }
    removeExceptions(db, id, ticked);
    addExceptions(db, id, unticked);
    handOver(db, id, rule, alsoChange);
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
 * For a saved rule, `exceptions` names the shown rows it skips (spec 35).
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
  const inside = setCategoryId === null ? new Set<number>() : categoryAndBelow(db, setCategoryId);
  const handSet =
    setCategoryId === null
      ? []
      : rows.filter((t) => t.categorySource === "user" && (t.categoryId === null || !inside.has(t.categoryId)));
  const higher = rulesAbove(db, raw.ruleId);
  const shown = rows.slice(0, PREVIEW_ROWS);
  const shownIds = shown.map((t) => t.id);
  const exceptions = raw.ruleId === undefined ? [] : exceptionsAmong(db, raw.ruleId, shownIds);
  return {
    matches: rows.length,
    sample: shown,
    more: rows.length - shown.length,
    exceptions,
    handSet,
    decidedHigher: decidedHigher(db, { ...conditions, setCategoryId, setExcluded }, higher, raw.ruleId),
  };
}

/** The rules checked before rule `id`; every rule when `id` is absent (a new rule goes last). */
function rulesAbove(db: Db, id: number | undefined): Rule[] {
  const rules = loadRules(db);
  const at = rules.findIndex((r) => r.id === id);
  return id === undefined || at === -1 ? rules : rules.slice(0, at);
}

/**
 * spec 35: of the unticked rows, those rule `ruleId` sorts now keep what it
 * set, as the user's, so no later run changes them. Rows it does not sort
 * are left as they are (other rules still apply to them).
 */
function keepForUser(db: Db, ruleId: number, ids: number[], at: string): void {
  if (ids.length === 0) return;
  const { category, excluded } = decidedBy(db, ruleId, ids);
  const keepCategory = db.prepare("UPDATE transactions SET category_source = 'user', updated_at = ? WHERE id = ?");
  const keepExcluded = db.prepare("UPDATE transactions SET excluded_source = 'user', updated_at = ? WHERE id = ?");
  for (const id of category) keepCategory.run(at, id);
  for (const id of excluded) keepExcluded.run(at, id);
}

/**
 * Releases the named hand-sorted rows the rule matches to the rules, so the
 * run that follows sets them (they become `category_source = 'rule'`). The
 * rule's exceptions are never released: they keep their category.
 */
function handOver(db: Db, ruleId: number, rule: RuleInput, ids: number[]): void {
  if (ids.length === 0 || !rule.enabled || rule.setCategoryId === null) return;
  const matches = compileMatcher(rule);
  const rows = db
    .prepare(
      `SELECT id, account_id, amount, description, memo, category_id FROM transactions
       WHERE trashed_at IS NULL AND category_source = 'user' AND id IN (SELECT value FROM json_each(?))
         AND id NOT IN (SELECT transaction_id FROM rule_exceptions WHERE rule_id = ?)`,
    )
    .all(JSON.stringify(ids), ruleId) as unknown as MatchRow[];
  // The rule changes the category, so a pay-back link (spec 33) ends too.
  const release = db.prepare(
    "UPDATE transactions SET category_id = NULL, category_source = 'rule', paid_back_for = NULL WHERE id = ?",
  );
  const inside = categoryAndBelow(db, rule.setCategoryId);
  for (const r of rows) {
    if ((r.category_id === null || !inside.has(r.category_id)) && matches(factsOf(r))) release.run(r.id);
  }
}

/**
 * The category and everything under it (three levels at most, spec 34). A
 * row the user sorted into a subcategory of the rule's own category already
 * agrees with the rule, more precisely: the rule never takes it back up.
 */
function categoryAndBelow(db: Db, id: number): Set<number> {
  const rows = db
    .prepare(
      `SELECT id FROM categories WHERE id = ? OR parent_id = ?
         OR parent_id IN (SELECT id FROM categories WHERE parent_id = ?)`,
    )
    .all(id, id, id) as { id: number }[];
  return new Set(rows.map((r) => r.id));
}

/** What the conditions read from a stored row, and its category. */
interface MatchRow {
  id: number;
  account_id: number;
  amount: number;
  description: string;
  memo: string | null;
  category_id: number | null;
}

function factsOf(r: MatchRow): PreparedRow {
  return prepareRow({ accountId: r.account_id, amount: r.amount, description: r.description, memo: r.memo });
}
