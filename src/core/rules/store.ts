// Reading and writing the `rules` table, and its mapping to the shared `Rule`.
// No checks and no reapplying here: `queries.ts` does both.

import type { Rule, RuleDirection, RuleInput, RuleMatchField, RuleMatchMode } from "@shared/types";
import type { Db } from "../db";

interface RuleRow {
  id: number;
  name: string;
  position: number;
  enabled: number;
  match_field: RuleMatchField;
  match_mode: RuleMatchMode;
  match_text: string;
  account_id: number | null;
  amount_min: number | null;
  amount_max: number | null;
  direction: RuleDirection | null;
  set_category_id: number | null;
  set_excluded: number | null;
}

const COLUMNS = `id, name, position, enabled, match_field, match_mode, match_text, account_id, amount_min,
  amount_max, direction, set_category_id, set_excluded`;

/** Every rule, in evaluation order. */
export function loadRules(db: Db): Rule[] {
  return (db.prepare(`SELECT ${COLUMNS} FROM rules ORDER BY position, id`).all() as unknown as RuleRow[]).map(toRule);
}

export function loadRule(db: Db, id: number): Rule | undefined {
  const row = db.prepare(`SELECT ${COLUMNS} FROM rules WHERE id = ?`).get(id) as RuleRow | undefined;
  return row && toRule(row);
}

export function insertRule(db: Db, rule: RuleInput, position: number, at: string): number {
  const res = db
    .prepare(
      `INSERT INTO rules (name, position, enabled, match_field, match_mode, match_text, account_id, amount_min,
         amount_max, direction, set_category_id, set_excluded, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(rule.name, position, ...ruleValues(rule), at, at);
  return Number(res.lastInsertRowid);
}

/** Overwrites everything but the position. Returns whether the rule existed. */
export function writeRule(db: Db, id: number, rule: RuleInput, at: string): boolean {
  const res = db
    .prepare(
      `UPDATE rules SET name = ?, enabled = ?, match_field = ?, match_mode = ?, match_text = ?, account_id = ?,
         amount_min = ?, amount_max = ?, direction = ?, set_category_id = ?, set_excluded = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(rule.name, ...ruleValues(rule), at, id);
  return Number(res.changes) === 1;
}

/** Positions 1..n in the order given. */
export function renumber(db: Db, ids: number[]): void {
  const stmt = db.prepare("UPDATE rules SET position = ? WHERE id = ?");
  ids.forEach((id, i) => stmt.run(i + 1, id));
}

function ruleValues(r: RuleInput): (string | number | null)[] {
  return [
    r.enabled ? 1 : 0,
    r.matchField,
    r.matchMode,
    r.matchText,
    r.accountId,
    r.amountMin,
    r.amountMax,
    r.direction,
    r.setCategoryId,
    r.setExcluded === null ? null : r.setExcluded ? 1 : 0,
  ];
}

function toRule(r: RuleRow): Rule {
  return {
    id: r.id,
    position: r.position,
    name: r.name,
    enabled: r.enabled === 1,
    matchField: r.match_field,
    matchMode: r.match_mode,
    matchText: r.match_text,
    accountId: r.account_id,
    amountMin: r.amount_min,
    amountMax: r.amount_max,
    direction: r.direction,
    setCategoryId: r.set_category_id,
    setExcluded: r.set_excluded === null ? null : r.set_excluded === 1,
  };
}
