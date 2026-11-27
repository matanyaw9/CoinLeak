// Money accounts: listing them, and removing them from syncing and adding them
// back (spec 15). Only the `sync_enabled` flag changes: rows stay, keep counting,
// and keep every user edit. Deleting an account's rows is not done here.

import type { Account } from "@shared/types";
import { transaction, type Db } from "../db";
import { assertIds, check } from "./validate";

/** Bank accounts and cards. The cash wallet has its own call (cash.ts, spec 20). */
export function listAccounts(db: Db): Account[] {
  const rows = db
    .prepare(
      `SELECT id, provider, kind, account_number, name, card_mode, last_synced_at, sync_enabled FROM accounts
       WHERE kind <> 'cash' ORDER BY kind = 'card', provider, account_number`,
    )
    .all() as {
    id: number;
    provider: Account["provider"];
    kind: Account["kind"];
    account_number: string;
    name: string | null;
    card_mode: Account["cardMode"];
    last_synced_at: string | null;
    sync_enabled: number;
  }[];
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider,
    kind: r.kind,
    accountNumber: r.account_number,
    name: r.name,
    cardMode: r.card_mode,
    lastSyncedAt: r.last_synced_at,
    syncEnabled: r.sync_enabled === 1,
  }));
}

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
