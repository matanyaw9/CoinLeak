// Undo of "Ignore" and "Count again" (spec 25): puts back each row's
// exclusion and who set it, exactly as `updateTransactions` reported them,
// in one database transaction.

import type { ExclusionState } from "@shared/types";
import { transaction, type Db } from "../db";
import { applyRulesInTransaction } from "../rules/engine";
import { applyCardBills } from "./card-bills";
import { check, isId } from "./validate";

const SOURCES: readonly unknown[] = ["user", "rule", null];

function isState(value: unknown): value is ExclusionState {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<ExclusionState>;
  return isId(s.id) && typeof s.excluded === "boolean" && SOURCES.includes(s.excludedSource);
}

/**
 * Rows the rules owned (`rule` or null) go back to the rules, which run on
 * them at once, so a rule that would exclude them now does. Card bills
 * rematch, since excluded bank lines take no part.
 */
export function restoreExclusions(db: Db, states: ExclusionState[], now = new Date()): { updated: number } {
  check(Array.isArray(states) && states.every(isState));
  check(new Set(states.map((s) => s.id)).size === states.length);
  if (states.length === 0) return { updated: 0 };

  return transaction(db, () => {
    const stmt = db.prepare("UPDATE transactions SET excluded = ?, excluded_source = ?, updated_at = ? WHERE id = ?");
    let updated = 0;
    for (const s of states) updated += Number(stmt.run(s.excluded ? 1 : 0, s.excludedSource, now.toISOString(), s.id).changes);
    const toRules = states.filter((s) => s.excludedSource !== "user").map((s) => s.id);
    if (toRules.length > 0) applyRulesInTransaction(db, { ids: toRules }, now);
    applyCardBills(db);
    return { updated };
  });
}
