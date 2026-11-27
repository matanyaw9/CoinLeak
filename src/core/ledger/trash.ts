// Trash: moving rows there, bringing them back, and deleting them for good.
// Trashed rows count nowhere, so card bills rematch after every change.

import { transaction, type Db } from "../db";
import { applyRulesInTransaction } from "../rules/engine";
import { applyCardBills } from "./card-bills";
import { assertIds } from "./validate";

/**
 * Moves rows to Trash: they count nowhere until restored. Card bills
 * rematch, since trashed rows take no part on either side.
 */
export function trashTransactions(db: Db, ids: number[], now = new Date()): { updated: number } {
  assertIds(ids);
  if (ids.length === 0) return { updated: 0 };
  const at = now.toISOString();
  return transaction(db, () => {
    const stmt = db.prepare("UPDATE transactions SET trashed_at = ?, updated_at = ? WHERE id = ? AND trashed_at IS NULL");
    let updated = 0;
    for (const id of new Set(ids)) updated += Number(stmt.run(at, at, id).changes);
    if (updated > 0) applyCardBills(db);
    return { updated };
  });
}

/**
 * Brings trashed rows back as they were. Rules catch up on them (they skip
 * trashed rows) and card bills rematch.
 */
export function restoreTransactions(db: Db, ids: number[], now = new Date()): { updated: number } {
  assertIds(ids);
  if (ids.length === 0) return { updated: 0 };
  const at = now.toISOString();
  return transaction(db, () => {
    const stmt = db.prepare("UPDATE transactions SET trashed_at = NULL, updated_at = ? WHERE id = ? AND trashed_at IS NOT NULL");
    const restored: number[] = [];
    for (const id of new Set(ids)) if (Number(stmt.run(at, id).changes) > 0) restored.push(id);
    if (restored.length > 0) {
      applyRulesInTransaction(db, { ids: restored }, now);
      applyCardBills(db);
    }
    return { updated: restored.length };
  });
}

/**
 * Deletes trashed rows for good: the ones in `ids`, or every one when `ids`
 * is null. A bank line that still points at one (a card bill decided by
 * hand) lets go of it first. Each row leaves a tombstone (its dedup key and
 * copy number) so a later sync never adds it back (spec 14).
 */
function deleteTrashed(db: Db, ids: number[] | null, now: Date): { deleted: number } {
  const trashed = ids === null ? "trashed_at IS NOT NULL" : "trashed_at IS NOT NULL AND id IN (SELECT value FROM json_each(?))";
  const args = ids === null ? [] : [JSON.stringify(ids)];
  return transaction(db, () => {
    db.prepare(
      `INSERT OR IGNORE INTO trash_tombstones (account_id, dedup_hash, dedup_seq, emptied_at)
       SELECT account_id, dedup_hash, dedup_seq, ? FROM transactions WHERE ${trashed}`,
    ).run(now.toISOString(), ...args);
    db.prepare(
      `UPDATE transactions SET card_bill_txn_id = NULL
       WHERE card_bill_txn_id IN (SELECT id FROM transactions WHERE ${trashed})`,
    ).run(...args);
    const deleted = Number(db.prepare(`DELETE FROM transactions WHERE ${trashed}`).run(...args).changes);
    if (deleted > 0) applyCardBills(db);
    return { deleted };
  });
}

/** "Empty trash": deletes every trashed row for good. The window asks first. */
export function emptyTrash(db: Db, now = new Date()): { deleted: number } {
  return deleteTrashed(db, null, now);
}

/**
 * Spec 36: deletes only the given trashed rows for good, the same way as
 * `emptyTrash`. Ids of rows that are not in Trash are skipped.
 */
export function deleteForGood(db: Db, ids: number[], now = new Date()): { deleted: number } {
  assertIds(ids);
  if (ids.length === 0) return { deleted: 0 };
  return deleteTrashed(db, ids, now);
}
