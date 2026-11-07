// Builders for rules in tests. Merchant names and amounts are made up.

import type { RuleInput } from "@shared/types";
import type { Db } from "../db";

/** A rule on the description, `contains` by default, named after its text. */
export function ruleInput(input: Partial<RuleInput> & Pick<RuleInput, "matchText">): RuleInput {
  return {
    name: input.matchText,
    enabled: true,
    matchField: "description",
    matchMode: "contains",
    accountId: null,
    amountMin: null,
    amountMax: null,
    direction: null,
    setCategoryId: null,
    setExcluded: null,
    ...input,
  };
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
