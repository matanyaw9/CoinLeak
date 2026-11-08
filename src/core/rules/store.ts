// Reading and writing the `rules` and `rule_conditions` tables, and their
// mapping to the shared `Rule`. No checks and no reapplying here:
// `queries.ts` does both.

import type {
  Rule,
  RuleCondition,
  RuleDirection,
  RuleInput,
  RuleJoin,
  RuleMatchField,
  RuleMatchMode,
} from "@shared/types";
import type { Db } from "../db";

interface RuleRow {
  id: number;
  name: string;
  position: number;
  enabled: number;
  join_mode: RuleJoin;
  set_category_id: number | null;
  set_excluded: number | null;
}

interface ConditionRow {
  rule_id: number;
  kind: RuleCondition["kind"];
  match_field: RuleMatchField | null;
  match_mode: RuleMatchMode | null;
  match_values: string | null;
  account_id: number | null;
  amount_min: number | null;
  amount_max: number | null;
  direction: RuleDirection | null;
}

const COLUMNS = "id, name, position, enabled, join_mode, set_category_id, set_excluded";
const CONDITION_COLUMNS =
  "rule_id, kind, match_field, match_mode, match_values, account_id, amount_min, amount_max, direction";

/** Every rule, in evaluation order. */
export function loadRules(db: Db): Rule[] {
  const rows = db.prepare(`SELECT ${COLUMNS} FROM rules ORDER BY position, id`).all() as unknown as RuleRow[];
  const conditions = db
    .prepare(`SELECT ${CONDITION_COLUMNS} FROM rule_conditions ORDER BY rule_id, position, id`)
    .all() as unknown as ConditionRow[];
  const byRule = new Map<number, RuleCondition[]>();
  for (const c of conditions) byRule.set(c.rule_id, [...(byRule.get(c.rule_id) ?? []), toCondition(c)]);
  return rows.map((r) => toRule(r, byRule.get(r.id) ?? []));
}

export function loadRule(db: Db, id: number): Rule | undefined {
  const row = db.prepare(`SELECT ${COLUMNS} FROM rules WHERE id = ?`).get(id) as RuleRow | undefined;
  if (!row) return undefined;
  const conditions = db
    .prepare(`SELECT ${CONDITION_COLUMNS} FROM rule_conditions WHERE rule_id = ? ORDER BY position, id`)
    .all(id) as unknown as ConditionRow[];
  return toRule(row, conditions.map(toCondition));
}

export function insertRule(db: Db, rule: RuleInput, position: number, at: string): number {
  const res = db
    .prepare(
      `INSERT INTO rules (name, position, enabled, join_mode, set_category_id, set_excluded, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(rule.name, position, ...ruleValues(rule), at, at);
  const id = Number(res.lastInsertRowid);
  writeConditions(db, id, rule.conditions);
  return id;
}

/** Overwrites everything but the position. Returns whether the rule existed. */
export function writeRule(db: Db, id: number, rule: RuleInput, at: string): boolean {
  const res = db
    .prepare(
      `UPDATE rules SET name = ?, enabled = ?, join_mode = ?, set_category_id = ?, set_excluded = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(rule.name, ...ruleValues(rule), at, id);
  if (Number(res.changes) !== 1) return false;
  writeConditions(db, id, rule.conditions);
  return true;
}

/** Positions 1..n in the order given. */
export function renumber(db: Db, ids: number[]): void {
  const stmt = db.prepare("UPDATE rules SET position = ? WHERE id = ?");
  ids.forEach((id, i) => stmt.run(i + 1, id));
}

/** The next free position, last in the order. */
export function nextPosition(db: Db): number {
  const { last } = db.prepare("SELECT COALESCE(MAX(position), 0) AS last FROM rules").get() as { last: number };
  return last + 1;
}

function writeConditions(db: Db, ruleId: number, conditions: RuleCondition[]): void {
  db.prepare("DELETE FROM rule_conditions WHERE rule_id = ?").run(ruleId);
  const insert = db.prepare(
    `INSERT INTO rule_conditions (rule_id, position, kind, match_field, match_mode, match_values, account_id,
       amount_min, amount_max, direction) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  conditions.forEach((c, i) => {
    const text = c.kind === "text" ? c : null;
    insert.run(
      ruleId,
      i + 1,
      c.kind,
      text?.field ?? null,
      text?.mode ?? null,
      text ? JSON.stringify(text.values) : null,
      c.kind === "account" ? c.accountId : null,
      c.kind === "amount" ? c.min : null,
      c.kind === "amount" ? c.max : null,
      c.kind === "direction" ? c.direction : null,
    );
  });
}

function ruleValues(r: RuleInput): (string | number | null)[] {
  return [r.enabled ? 1 : 0, r.join, r.setCategoryId, r.setExcluded === null ? null : r.setExcluded ? 1 : 0];
}

function toCondition(c: ConditionRow): RuleCondition {
  switch (c.kind) {
    case "text":
      return {
        kind: "text",
        field: c.match_field as RuleMatchField,
        mode: c.match_mode as RuleMatchMode,
        values: JSON.parse(c.match_values ?? "[]") as string[],
      };
    case "account":
      return { kind: "account", accountId: c.account_id as number };
    case "amount":
      return { kind: "amount", min: c.amount_min, max: c.amount_max };
    case "direction":
      return { kind: "direction", direction: c.direction as RuleDirection };
  }
}

function toRule(r: RuleRow, conditions: RuleCondition[]): Rule {
  return {
    id: r.id,
    position: r.position,
    name: r.name,
    enabled: r.enabled === 1,
    join: r.join_mode,
    conditions,
    setCategoryId: r.set_category_id,
    setExcluded: r.set_excluded === null ? null : r.set_excluded === 1,
  };
}
