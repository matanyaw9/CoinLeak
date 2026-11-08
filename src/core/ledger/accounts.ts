// Removing money accounts from syncing and adding them back (spec 15). Only
// the `sync_enabled` flag changes: rows stay, keep counting, and keep every
// user edit. Deleting an account's rows is not something this module does.

import { transaction, type Db } from "../db";
import { assertIds, check } from "./validate";

export function setAccountsSyncing(db: Db, ids: number[], enabled: boolean): { updated: number } {
  assertIds(ids);
  check(ids.length > 0 && typeof enabled === "boolean");
  return transaction(db, () => {
    const known = db.prepare("SELECT 1 FROM accounts WHERE id = ?");
    for (const id of ids) check(known.get(id) !== undefined);
    const update = db.prepare("UPDATE accounts SET sync_enabled = ? WHERE id = ? AND sync_enabled <> ?");
    const flag = enabled ? 1 : 0;
    let updated = 0;
    for (const id of new Set(ids)) updated += Number(update.run(flag, id, flag).changes);
    return { updated };
  });
}
