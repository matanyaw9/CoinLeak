// The rules list the window edits: list, save (create or update), delete and its
// exact undo (spec 43), reorder, Apply now, and a preview that saves nothing.
// Every change reapplies all rules to all rows in the same transaction, so
// stored rows always agree with the list. Saving also records the rows the
// user unticked in the editor as the rule's exceptions (spec 35).

import type { DeletedRule, Rule, RuleInput, RulePreview, RulePreviewArgs, RuleSaved, RulesApplied } from "@shared/types";
import { transaction, type Db } from "../db";
import { listTransactions } from "../ledger/queries";
import { assertIds, check, isId } from "../ledger/validate";
import { decidedBy, runRules } from "./engine";
import { compileMatcher, prepareRow, type PreparedRow } from "./match";
import { draftReach, ruleOverlaps } from "./order";
import {
  addExceptions,
  exceptionsAmong,
  exceptionsOf,
  heldLinks,
  insertRule,
  insertRuleOnTop,
  loadRule,
  loadRules,
  nextPosition,
  removeExceptions,
  renumber,
  restoreExceptions,
  restoreLinks,
  writeRule,
} from "./store";
import { checkNewPatterns, cleanConditions, cleanRuleInput } from "./validate";

/** The editor lists at most this many matching rows, newest first (spec 35). */
export const PREVIEW_ROWS = 500;

export interface SaveRequest {
  /** null creates the rule, first in the order (spec 41: the newest rule wins). */
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

/** Every rule in order, each with its hints about other rules (spec 21, spec 41). */
export function listRules(db: Db): Rule[] {
  const rules = loadRules(db);
  const hints = ruleOverlaps(db, rules);
  return rules.map((r) => ({ ...r, ...hints.get(r.id) }));
}

/** Creates or updates a rule, reapplies all rules, and says what that did. */
export function saveRule(db: Db, req: SaveRequest, now = new Date()): RuleSaved {
  check(req.id === null || isId(req.id));
  const rule = cleanRuleInput(db, req.rule);
  checkNewPatterns(rule.conditions, req.id === null ? undefined : loadRule(db, req.id)?.conditions);
  const alsoChange = req.alsoChange ?? [];
  const unticked = req.unticked ?? [];
  const ticked = req.ticked ?? [];
  assertIds(alsoChange);
  assertIds(unticked);
  assertIds(ticked);
  const at = now.toISOString();
  return transaction(db, () => {
    let id: number;
    if (req.id === null) id = insertRuleOnTop(db, rule, at);
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

/**
 * Adds the rule last in the order, for the Demo's rules. The editor saves
 * with `saveRule`.
 */
export function createRule(db: Db, input: unknown, now = new Date()): Rule {
  const rule = cleanRuleInput(db, input);
  return transaction(db, () => {
    const id = insertRule(db, rule, nextPosition(db), now.toISOString());
    runRules(db, "all", now);
    return loadRule(db, id) as Rule;
  });
}

/** Replaces the rule's fields; its place in the order stays. */
export function updateRule(db: Db, id: number, input: unknown, now = new Date()): Rule {
  check(isId(id));
  return saveRule(db, { id, rule: input }, now).rule;
}

/**
 * Rows keep nothing the rule set, unless another rule sets it now. Answers
 * with what `restoreRule` needs to undo this.
 */
export function deleteRule(db: Db, id: number, now = new Date()): DeletedRule {
  check(isId(id));
  return transaction(db, () => {
    const rule = loadRule(db, id);
    check(rule !== undefined);
    const deleted = { rule, exceptions: exceptionsOf(db, id), links: heldLinks(db) };
    db.prepare("DELETE FROM rules WHERE id = ?").run(id);
    renumber(
      db,
      loadRules(db).map((r) => r.id),
    );
    runRules(db, "all", now);
    return deleted;
  });
}

/**
 * Undo of a delete (spec 43): the rule comes back under its old id, at its old
 * position (last, if the list is shorter now), with its exceptions. The run
 * then leaves every row as it was. BAD_REQUEST when the payload is malformed
 * or stale: the id is in use again, or its category or account is gone.
 */
export function restoreRule(db: Db, input: unknown, now = new Date()): void {
  check(typeof input === "object" && input !== null);
  const { rule: old, exceptions, links } = input as Partial<DeletedRule>;
  const rule = cleanRuleInput(db, old);
  const { id, position } = old as Rule;
  check(isId(id) && isId(position));
  assertIds(exceptions);
  check(Array.isArray(links) && links.every((l) => isId(l?.transactionId) && isId(l?.ruleId)));
  transaction(db, () => {
    const ids = loadRules(db).map((r) => r.id);
    check(!ids.includes(id));
    insertRule(db, rule, position, now.toISOString(), id);
    ids.splice(position - 1, 0, id);
    renumber(db, ids);
    restoreExceptions(db, id, exceptions);
    runRules(db, "all", now);
    restoreLinks(db, links);
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
 * For a saved rule, `exceptions` names the shown rows it skips (spec 35);
 * `alreadyHere`, `higherRule` and `setByYou` the shown rows it would not
 * change. A new rule is previewed on top of every other (spec 41).
 */
export function previewRule(db: Db, input: unknown): RulePreview {
  const conditions = cleanConditions(db, input);
  const matches = compileMatcher(conditions);
  const raw = input as Partial<RulePreviewArgs>;
  const setCategoryId = raw.setCategoryId ?? null;
  check(setCategoryId === null || isId(setCategoryId));
  const setExcluded = typeof raw.setExcluded === "boolean" ? raw.setExcluded : null;
  check(raw.ruleId === undefined || isId(raw.ruleId));
  checkNewPatterns(conditions.conditions, raw.ruleId === undefined ? undefined : loadRule(db, raw.ruleId)?.conditions);
  const rows = listTransactions(db).filter((t) => matches(prepareRow(t)));
  const inside = setCategoryId === null ? new Set<number>() : categoryAndBelow(db, setCategoryId);
  const handSet =
    setCategoryId === null
      ? []
      : rows.filter((t) => t.categorySource === "user" && (t.categoryId === null || !inside.has(t.categoryId)));
  const others = rulesAround(db, raw.ruleId);
  const shown = rows.slice(0, PREVIEW_ROWS);
  const shownIds = shown.map((t) => t.id);
  const exceptions = raw.ruleId === undefined ? [] : exceptionsAmong(db, raw.ruleId, shownIds);
  const reach = draftReach(db, { ...conditions, setCategoryId, setExcluded }, others, inside, raw.ruleId);
  return {
    matches: rows.length,
    sample: shown,
    more: rows.length - shown.length,
    exceptions,
    handSet,
    decidedHigher: reach.decidedHigher,
    higherNames: reach.higherNames,
    overrides: reach.overrides,
    alreadyHere: shownIds.filter((id) => reach.alreadyHere.has(id)),
    higherRule: shownIds.filter((id) => reach.higherRule.has(id)),
    setByYou: shownIds.filter((id) => reach.setByYou.has(id)),
  };
}

/** The rules checked before and after rule `id`. Without one the draft is new, so all come after. */
function rulesAround(db: Db, id: number | undefined): { higher: Rule[]; lower: Rule[] } {
  const rules = loadRules(db);
  const at = rules.findIndex((r) => r.id === id);
  return at === -1 ? { higher: [], lower: rules } : { higher: rules.slice(0, at), lower: rules.slice(at + 1) };
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
