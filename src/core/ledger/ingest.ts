// Saves one provider's download: upserts its accounts, adds rows that are new,
// settles pending rows in place (exactly or with drift), marks pending rows the
// download no longer has as gone, then rematches card bills. One transaction.
// Rules: REQUIREMENTS section 5 and spec 04. User fields are never written.

import { CodedError } from "@shared/errors";
import type {
  AccountKind,
  IsoDate,
  ProviderId,
  ScrapedAccount,
  ScrapedTransaction,
  SyncResult,
} from "@shared/types";
import { transaction, type Db } from "../db";
import { applyCardBills } from "./card-bills";
import { isIsoDate } from "./dates";
import { SequenceCounter, dedupHash } from "./dedup";
import { planPending, type OpenRow } from "./pending";

export const PROVIDER_KIND: Record<ProviderId, AccountKind> = {
  discount: "bank",
  visaCal: "card",
};

export interface IngestOptions {
  now: Date;
  /** Needed only when `accounts` is empty. */
  provider?: ProviderId;
  /** First day the sync asked the bank for. Without it, each account's
   *  earliest downloaded day. Only pending rows from then on can be gone. */
  since?: IsoDate;
}

/** One downloaded row with its dedup key. */
interface Incoming {
  t: ScrapedTransaction;
  hash: string;
  seq: number;
}

interface Counts {
  newRows: number;
  updatedRows: number;
}

export function ingest(db: Db, accounts: ScrapedAccount[], opts: IngestOptions): SyncResult {
  const provider = opts.provider ?? accounts[0]?.provider;
  if (!provider || !Object.hasOwn(PROVIDER_KIND, provider)) throw new CodedError("BAD_REQUEST");
  for (const a of accounts) assertAccount(a, provider);
  if (opts.since !== undefined && !isIsoDate(opts.since)) throw new CodedError("BAD_REQUEST");
  const now = opts.now.toISOString();

  return transaction(db, () => {
    const runId = Number(
      db.prepare("INSERT INTO sync_runs (provider, synced_at) VALUES (?, ?)").run(provider, now).lastInsertRowid,
    );

    // Per account, so a card listed twice in one download still counts copies once.
    const downloads = new Map<number, { counter: SequenceCounter; rows: Incoming[] }>();
    for (const account of accounts) {
      const accountId = upsertAccount(db, provider, account, now);
      const download = downloads.get(accountId) ?? { counter: new SequenceCounter(), rows: [] };
      downloads.set(accountId, download);
      for (const t of account.transactions) {
        const hash = dedupHash(provider, account.accountNumber, t);
        download.rows.push({ t, hash, seq: download.counter.next(hash) });
      }
    }

    const counts: Counts = { newRows: 0, updatedRows: 0 };
    for (const [accountId, { rows }] of downloads) {
      const windowStart = opts.since ?? earliestDate(rows);
      saveAccount(db, { accountId, runId, now, windowStart }, rows, counts);
    }

    applyCardBills(db);
    db.prepare("UPDATE sync_runs SET accounts = ?, new_rows = ?, updated_rows = ? WHERE id = ?").run(
      accounts.length,
      counts.newRows,
      counts.updatedRows,
      runId,
    );
    return { provider, accounts: accounts.length, ...counts };
  });
}

interface SaveContext {
  accountId: number;
  runId: number;
  now: string;
  windowStart: IsoDate | null;
}

interface StoredPending {
  id: number;
  date: IsoDate;
  amount: number;
  description: string;
  installment_number: number | null;
  installment_total: number | null;
  gone_at: string | null;
}

/**
 * One account's rows, in three steps. Exact matches first: a pending or gone
 * row takes the download's status. Then the stored pending rows left over
 * settle with drift or become gone (see `planPending`). Then every downloaded
 * row nobody claimed is inserted. Completed rows never change.
 */
function saveAccount(db: Db, ctx: SaveContext, rows: Incoming[], counts: Counts): void {
  const { accountId, now } = ctx;
  const find = db.prepare(
    "SELECT id, status, gone_at FROM transactions WHERE account_id = ? AND dedup_hash = ? AND dedup_seq = ?",
  );
  const settle = db.prepare(
    `UPDATE transactions SET status = 'completed', processed_date = ?, identifier = ?, gone_at = NULL, updated_at = ?
     WHERE id = ?`,
  );
  const revive = db.prepare("UPDATE transactions SET gone_at = NULL, updated_at = ? WHERE id = ?");

  const matched = new Set<number>();
  const fresh: Incoming[] = [];
  for (const row of rows) {
    const existing = find.get(accountId, row.hash, row.seq) as
      | { id: number; status: string; gone_at: string | null }
      | undefined;
    if (!existing) {
      fresh.push(row);
      continue;
    }
    matched.add(existing.id);
    if (existing.status !== "pending") continue;
    if (row.t.status === "completed") {
      settle.run(row.t.processedDate, row.t.identifier, now, existing.id);
      counts.updatedRows++;
    } else if (existing.gone_at !== null) {
      revive.run(now, existing.id);
      counts.updatedRows++;
    }
  }

  const stored = db
    .prepare(
      `SELECT id, date, amount, description, installment_number, installment_total, gone_at FROM transactions
       WHERE account_id = ? AND status = 'pending' ORDER BY id`,
    )
    .all(accountId) as unknown as StoredPending[];
  const open = stored.filter((r) => !matched.has(r.id)).map(toOpenRow);
  const completed = fresh.filter((r) => r.t.status === "completed");
  const plan = planPending(open, completed.map((r) => r.t), ctx.windowStart);

  const drift = db.prepare(
    `UPDATE transactions SET amount = ?, date = ?, processed_date = ?, original_amount = ?, original_currency = ?,
       status = 'completed', identifier = ?, dedup_hash = ?, dedup_seq = ?, gone_at = NULL, updated_at = ?
     WHERE id = ?`,
  );
  const claimed = new Set<Incoming>();
  for (const [id, index] of plan.settle) {
    const row = completed[index] as Incoming;
    const { t, hash, seq } = row;
    drift.run(t.amount, t.date, t.processedDate, t.originalAmount, t.originalCurrency, t.identifier, hash, seq, now, id);
    claimed.add(row);
    counts.updatedRows++;
  }

  const markGone = db.prepare("UPDATE transactions SET gone_at = ?, updated_at = ? WHERE id = ? AND gone_at IS NULL");
  for (const id of plan.gone) counts.updatedRows += Number(markGone.run(now, now, id).changes);

  const insert = db.prepare(
    `INSERT INTO transactions (account_id, date, processed_date, amount, original_amount, original_currency,
       description, memo, status, installment_number, installment_total, identifier,
       dedup_hash, dedup_seq, sync_run_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const row of fresh) {
    if (claimed.has(row)) continue;
    const t = row.t;
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
      row.hash,
      row.seq,
      ctx.runId,
      now,
      now,
    );
    counts.newRows++;
  }
}

function toOpenRow(r: StoredPending): OpenRow {
  return {
    id: r.id,
    date: r.date,
    amount: r.amount,
    description: r.description,
    installment:
      r.installment_number !== null && r.installment_total !== null
        ? { number: r.installment_number, total: r.installment_total }
        : null,
    gone: r.gone_at !== null,
  };
}

function earliestDate(rows: Incoming[]): IsoDate | null {
  let earliest: IsoDate | null = null;
  for (const { t } of rows) if (earliest === null || t.date < earliest) earliest = t.date;
  return earliest;
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
