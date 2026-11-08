// Known places (spec 13, F29): a category's list rules seen as its list of
// shops. A list rule is an enabled rule with one text condition on the
// description (not a pattern) and one action, set a category. Adding a place
// appends to the category's first list rule, or makes one.

import type { KnownPlaceAdded, KnownPlaces, Rule, RuleInput } from "@shared/types";
import { transaction, type Db } from "../db";
import { check, isId } from "../ledger/validate";
import { runRules } from "./engine";
import { normalizeText } from "./match";
import { insertRule, loadRules, nextPosition, writeRule } from "./store";
import { cleanValue, MAX_NAME, MAX_VALUES } from "./validate";

/** A list rule with its one text condition, values and category at hand. */
export interface ListRule {
  rule: Rule;
  categoryId: number;
  values: string[];
}

export function asListRule(rule: Rule): ListRule | null {
  const [c] = rule.conditions;
  if (!rule.enabled || rule.conditions.length !== 1 || c?.kind !== "text") return null;
  if (c.field !== "description" || c.mode === "regex") return null;
  if (rule.setCategoryId === null || rule.setExcluded !== null) return null;
  return { rule, categoryId: rule.setCategoryId, values: c.values };
}

export function loadListRules(db: Db): ListRule[] {
  return loadRules(db).flatMap((r) => asListRule(r) ?? []);
}

/** Per category, the names in its list rules, in category id order. */
export function knownPlaces(db: Db): KnownPlaces[] {
  const byCategory = new Map<number, KnownPlaces>();
  for (const list of loadListRules(db)) {
    const entry = byCategory.get(list.categoryId) ?? { categoryId: list.categoryId, names: [], ruleIds: [] };
    const seen = new Set(entry.names.map(normalizeText));
    for (const v of list.values) {
      if (seen.has(normalizeText(v))) continue;
      seen.add(normalizeText(v));
      entry.names.push(v);
    }
    entry.ruleIds.push(list.rule.id);
    byCategory.set(list.categoryId, entry);
  }
  return [...byCategory.values()].sort((a, b) => a.categoryId - b.categoryId);
}

/** Appends `names` to the category's first list rule, or makes one. Inside a transaction; no reapplying. */
export function appendPlaces(
  db: Db,
  categoryId: number,
  names: string[],
  at: string,
): { ruleId: number; created: boolean; added: number } {
  const lists = loadListRules(db).filter((l) => l.categoryId === categoryId);
  const known = new Set(lists.flatMap((l) => l.values).map(normalizeText));
  const fresh: string[] = [];
  for (const n of names) {
    if (known.has(normalizeText(n))) continue;
    known.add(normalizeText(n));
    fresh.push(n);
  }
  const first = lists[0];
  if (first) {
    if (fresh.length > 0) {
      const values = [...first.values, ...fresh];
      check(values.length <= MAX_VALUES);
      const [c] = first.rule.conditions;
      const conditions = c?.kind === "text" ? [{ ...c, values }] : first.rule.conditions;
      writeRule(db, first.rule.id, { ...toInput(first.rule), conditions }, at);
    }
    return { ruleId: first.rule.id, created: false, added: fresh.length };
  }
  check(fresh.length > 0 && fresh.length <= MAX_VALUES);
  const name = (db.prepare("SELECT name FROM categories WHERE id = ?").get(categoryId) as { name: string }).name;
  const rule: RuleInput = {
    name: name.slice(0, MAX_NAME),
    enabled: true,
    join: "all",
    conditions: [{ kind: "text", field: "description", mode: "contains", values: fresh }],
    setCategoryId: categoryId,
    setExcluded: null,
  };
  return { ruleId: insertRule(db, rule, nextPosition(db), at), created: true, added: fresh.length };
}

/** "Add <business> to the known places of <category>", then reapplies all rules. */
export function addKnownPlace(db: Db, args: { categoryId: unknown; name: unknown }, now = new Date()): KnownPlaceAdded {
  check(typeof args === "object" && args !== null);
  const { categoryId } = args;
  check(isId(categoryId) && db.prepare("SELECT 1 FROM categories WHERE id = ?").get(categoryId) !== undefined);
  const name = cleanValue(args.name);
  return transaction(db, () => {
    const { ruleId, created, added } = appendPlaces(db, categoryId, [name], now.toISOString());
    const { changed } = runRules(db, "all", now);
    return { ruleId, created, added: added > 0, changed };
  });
}

function toInput(rule: Rule): RuleInput {
  const { id, position, ...input } = rule;
  void id;
  void position;
  return input;
}
