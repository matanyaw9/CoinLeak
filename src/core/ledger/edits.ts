// What the user changes by hand on rows: category, note and exclusion. Setting
// one marks it as the user's, so rules and syncs leave it alone.

import type { SQLInputValue } from "node:sqlite";
import type { ExcludedSource, ExclusionState, TransactionPatch } from "@shared/types";
import { transaction, type Db } from "../db";
import { applyRulesInTransaction } from "../rules/engine";
import { applyCardBills } from "./card-bills";
import { assertIds, check, cleanNote, isId } from "./validate";

/**
 * The user's edits. Setting a category (even to none) or excluding or
 * including a row marks that field as the user's, so rules and syncs leave
 * it alone. Excluding or including a row rematches card bills, since
 * excluded bank lines are frozen, and returns each row's exclusion as it was.
 * Undo passes that back with `excludedSource`: `rule` or null hands the row
 * back to the rules, which run on it at once (spec 13).
 */
export function updateTransactions(
  db: Db,
  ids: number[],
  patch: TransactionPatch,
  now = new Date(),
): { updated: number; before?: ExclusionState[] } {
  assertIds(ids);
  check(typeof patch === "object" && patch !== null);
  const sets: string[] = [];
  const params: SQLInputValue[] = [];

  if (patch.categoryId !== undefined) {
    check(patch.categoryId === null || isId(patch.categoryId));
    if (patch.categoryId !== null) {
      check(db.prepare("SELECT 1 FROM categories WHERE id = ?").get(patch.categoryId) !== undefined);
    }
    // A pay-back link (spec 33) explains the category it copied: a different
    // category ends it. SET reads the row as it was before this update.
    sets.push(
      "category_id = ?",
      "category_source = 'user'",
      "paid_back_for = CASE WHEN category_id IS ? THEN paid_back_for ELSE NULL END",
    );
    params.push(patch.categoryId, patch.categoryId);
  }
  if (patch.note !== undefined) {
    sets.push("note = ?");
    params.push(cleanNote(patch.note));
  }
  const source = patch.excludedSource === undefined ? "user" : patch.excludedSource;
  check(patch.excludedSource === undefined || patch.excluded !== undefined);
  check(source === null || source === "user" || source === "rule");
  if (patch.excluded !== undefined) {
    check(typeof patch.excluded === "boolean");
    sets.push("excluded = ?", "excluded_source = ?");
    params.push(patch.excluded ? 1 : 0, source);
  }
  if (sets.length === 0 || ids.length === 0) return { updated: 0 };

  return transaction(db, () => {
    const unique = [...new Set(ids)];
    const before = patch.excluded === undefined ? undefined : exclusionsOf(db, unique);
    const stmt = db.prepare(`UPDATE transactions SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`);
    let updated = 0;
    for (const id of unique) updated += Number(stmt.run(...params, now.toISOString(), id).changes);
    if (patch.excluded === false && source === "user") forgetPaysCard(db, unique);
    if (patch.excluded !== undefined && source !== "user") applyRulesInTransaction(db, { ids: unique }, now);
    if (patch.excluded !== undefined) applyCardBills(db);
    return before ? { updated, before } : { updated };
  });
}

/**
 * Spec 28: "Count again" asks for the row to count. A line the user had
 * marked "This pays a card I track" would still not count, so the mark is
 * dropped and the matcher decides again (flagged if no tracked card fits).
 * "Count it as spending" (internal 0 by the user) already counts and stays.
 */
function forgetPaysCard(db: Db, ids: number[]): void {
  db.prepare(
    `UPDATE transactions SET internal = 0, internal_by_user = 0
     WHERE id IN (SELECT value FROM json_each(?)) AND internal_by_user = 1 AND internal = 1`,
  ).run(JSON.stringify(ids));
}

function exclusionsOf(db: Db, ids: number[]): ExclusionState[] {
  const rows = db
    .prepare(
      `SELECT id, excluded, excluded_source FROM transactions WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id`,
    )
    .all(JSON.stringify(ids)) as unknown as { id: number; excluded: number; excluded_source: ExcludedSource | null }[];
  return rows.map((r) => ({ id: r.id, excluded: r.excluded === 1, excludedSource: r.excluded_source }));
}
