// Builders for rules in tests. Merchant names and amounts are made up.

import type { RuleCondition, RuleDirection, RuleInput, RuleJoin, RuleMatchField, RuleMatchMode } from "@shared/types";
import type { Db } from "../db";

/** The old one-condition rule (spec 07), the shorthand most tests use. */
export interface OneCondition {
  matchText: string;
  name?: string;
  enabled?: boolean;
  matchField?: RuleMatchField;
  matchMode?: RuleMatchMode;
  accountId?: number | null;
  amountMin?: number | null;
  amountMax?: number | null;
  direction?: RuleDirection | null;
  setCategoryId?: number | null;
  setExcluded?: boolean | null;
}

/**
 * A rule on the description, `contains` by default, named after its text:
 * the text, then account, direction and amount conditions, joined by all.
 */
export function ruleInput(r: OneCondition): RuleInput {
  const conditions: RuleCondition[] = [
    { kind: "text", field: r.matchField ?? "description", mode: r.matchMode ?? "contains", values: [r.matchText] },
  ];
  if (r.accountId != null) conditions.push({ kind: "account", accountId: r.accountId });
  if (r.direction != null) conditions.push({ kind: "direction", direction: r.direction });
  if (r.amountMin != null || r.amountMax != null) {
    conditions.push({ kind: "amount", min: r.amountMin ?? null, max: r.amountMax ?? null });
  }
  return {
    name: r.name ?? r.matchText,
    enabled: r.enabled ?? true,
    join: "all",
    conditions,
    setCategoryId: r.setCategoryId ?? null,
    setExcluded: r.setExcluded ?? null,
  };
}

/** A rule with these conditions, joined by `join`, setting a category. */
export function multiRule(
  join: RuleJoin,
  conditions: RuleCondition[],
  setCategoryId: number,
  name = "rule",
): RuleInput {
  return { name, enabled: true, join, conditions, setCategoryId, setExcluded: null };
}

/** The values of a rule's first text condition. */
export function textValues(rule: Pick<RuleInput, "conditions">): string[] {
  const c = rule.conditions.find((x) => x.kind === "text");
  return c?.kind === "text" ? c.values : [];
}

/** Id of the newest sync run. */
export function lastRunId(db: Db): number {
  return (db.prepare("SELECT MAX(id) AS id FROM sync_runs").get() as { id: number }).id;
}

/** The fields rules own, for one row. */
export function ruleFields(db: Db, id: number): Record<string, unknown> {
  return db
    .prepare("SELECT category_id, category_source, excluded, excluded_source, rule_id FROM transactions WHERE id = ?")
    .get(id) as Record<string, unknown>;
}
