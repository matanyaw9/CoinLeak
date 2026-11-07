// Saves one provider's download: upserts its accounts, adds rows that are new,
// settles pending rows in place, then rematches card bills. One transaction.
// Dedup and pending rules: REQUIREMENTS section 5. User fields are never written.

import { CodedError } from "@shared/errors";
import type { AccountKind, ProviderId, ScrapedAccount, ScrapedTransaction, SyncResult } from "@shared/types";
import { transaction, type Db } from "../db";
import { applyCardBills } from "./card-bills";
import { isIsoDate } from "./dates";
import { SequenceCounter, dedupHash } from "./dedup";

export const PROVIDER_KIND: Record<ProviderId, AccountKind> = {
  discount: "bank",
  visaCal: "card",
};

export interface IngestOptions {
  now: Date;
  /** Needed only when `accounts` is empty. */
  provider?: ProviderId;
}

export function ingest(db: Db, accounts: ScrapedAccount[], opts: IngestOptions): SyncResult {
  const provider = opts.provider ?? accounts[0]?.provider;
  if (!provider || !Object.hasOwn(PROVIDER_KIND, provider)) throw new CodedError("BAD_REQUEST");
  for (const a of accounts) assertAccount(a, provider);
  const now = opts.now.toISOString();

  return transaction(db, () => {
    const runId = Number(
      db.prepare("INSERT INTO sync_runs (provider, synced_at) VALUES (?, ?)").run(provider, now).lastInsertRowid,
    );
    const find = db.prepare(
      "SELECT id, status FROM transactions WHERE account_id = ? AND dedup_hash = ? AND dedup_seq = ?",
    );
    const insert = db.prepare(
      `INSERT INTO transactions (account_id, date, processed_date, amount, original_amount, original_currency,
         description, memo, status, installment_number, installment_total, identifier,
         dedup_hash, dedup_seq, sync_run_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const settle = db.prepare(
      `UPDATE transactions SET status = 'completed', processed_date = ?, identifier = ?, updated_at = ?
       WHERE id = ?`,
    );

    let newRows = 0;
    let updatedRows = 0;
    // Per account, so a card listed twice in one download still counts copies once.
    const counters = new Map<number, SequenceCounter>();

    for (const account of accounts) {
      const accountId = upsertAccount(db, provider, account, now);
      const counter = counters.get(accountId) ?? new SequenceCounter();
      counters.set(accountId, counter);
      for (const t of account.transactions) {
        const hash = dedupHash(provider, account.accountNumber, t);
        const seq = counter.next(hash);
        const existing = find.get(accountId, hash, seq) as { id: number; status: string } | undefined;
        if (!existing) {
          insert.run(
            accountId,
            t.date,
            t.processedDate,
            t.amount,
            t.originalAmount,
            t.originalCurrency,
            t.description,
            t.memo,
            t.status,
            t.installment?.number ?? null,
            t.installment?.total ?? null,
            t.identifier,
            hash,
            seq,
            runId,
            now,
            now,
          );
          newRows++;
        } else if (existing.status === "pending" && t.status === "completed") {
          settle.run(t.processedDate, t.identifier, now, existing.id);
          updatedRows++;
        }
      }
    }

    applyCardBills(db);
    db.prepare("UPDATE sync_runs SET accounts = ?, new_rows = ?, updated_rows = ? WHERE id = ?").run(
      accounts.length,
      newRows,
      updatedRows,
      runId,
    );
    return { provider, accounts: accounts.length, newRows, updatedRows };
  });
}

/** Creates the account on first sight. Later syncs only refresh balance and
 *  sync time; name and card mode belong to the user. */
function upsertAccount(db: Db, provider: ProviderId, a: ScrapedAccount, now: string): number {
  const kind = PROVIDER_KIND[provider];
  const row = db
    .prepare(
      `INSERT INTO accounts (provider, kind, account_number, card_mode, balance, last_synced_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (provider, account_number) DO UPDATE SET
         balance = COALESCE(excluded.balance, accounts.balance),
         last_synced_at = excluded.last_synced_at
       RETURNING id`,
    )
    .get(provider, kind, a.accountNumber, kind === "card" ? "credit" : null, a.balance, now, now) as { id: number };
  return row.id;
}

// The download comes from our own sync module, but a bad row must stop the
// save (nothing written) rather than be skipped or stored as a float.
function assertAccount(a: ScrapedAccount, provider: ProviderId): void {
  const ok =
    a.provider === provider &&
    typeof a.accountNumber === "string" &&
    a.accountNumber.trim() !== "" &&
    (a.balance === null || Number.isSafeInteger(a.balance)) &&
    Array.isArray(a.transactions) &&
    a.transactions.every(isValidTransaction);
  if (!ok) throw new CodedError("BAD_REQUEST");
}

function isValidTransaction(t: ScrapedTransaction): boolean {
  const optionalText = (v: unknown): boolean => v === null || typeof v === "string";
  const inst = t.installment;
  return (
    isIsoDate(t.date) &&
    (t.processedDate === null || isIsoDate(t.processedDate)) &&
    Number.isSafeInteger(t.amount) &&
    (t.originalAmount === null || Number.isSafeInteger(t.originalAmount)) &&
    optionalText(t.originalCurrency) &&
    typeof t.description === "string" &&
    optionalText(t.memo) &&
    optionalText(t.identifier) &&
    (t.status === "pending" || t.status === "completed") &&
    (inst === null || (Number.isSafeInteger(inst.number) && Number.isSafeInteger(inst.total)))
  );
}
