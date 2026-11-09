// Balance check (spec 24): do the rows add up to what the bank says? For each
// bank account, the two newest balances the bank sent are compared with the
// rows booked between them. Read only: a gap is reported, never fixed.
//
// Which rows count, between an older balance A and a newer one B:
// - Completed rows only. Pending rows are the bank's future entries (Discount
//   sends them as "future transactions"), not yet in its balance. Gone rows are
//   pending too.
// - By `date`, the day the bank booked the row. For a bank account the
//   library's `processed_date` is the value date (interest date), which can be
//   before or after the booking and is not when the balance moved.
// - Booked after A's day and up to B's day (Israel time). A row booked on A's
//   own day counts only if CoinLeak first saved it after A: it came after A's
//   balance was taken. A row saved after B is left for the next check.
// - Every row of the account, excluded, internal and trashed included: the
//   bank's money moved either way.

import type { Agorot, BalanceCheck, IsoDate } from "@shared/types";
import type { Db } from "../db";
import { israelToday } from "./period";

interface Snapshot {
  balance: Agorot;
  taken_at: string;
}

interface AccountRow {
  id: number;
  kind: "bank" | "card";
}

/** One check per bank and card account, in `listAccounts` order. */
export function balanceChecks(db: Db): BalanceCheck[] {
  const accounts = db
    .prepare(`SELECT id, kind FROM accounts WHERE kind <> 'cash' ORDER BY kind = 'card', provider, account_number`)
    .all() as unknown as AccountRow[];
  return accounts.map((a) => checkAccount(db, a));
}

function checkAccount(db: Db, account: AccountRow): BalanceCheck {
  const newest = db
    .prepare("SELECT balance, taken_at FROM balance_snapshots WHERE account_id = ? ORDER BY taken_at DESC, id DESC LIMIT 2")
    .all(account.id) as unknown as Snapshot[];
  const [b, a] = newest;
  const unknown = (reason: BalanceCheck["unknownReason"]): BalanceCheck => ({
    accountId: account.id,
    balance: b?.balance ?? null,
    asOf: b?.taken_at ?? null,
    status: "unknown",
    unknownReason: reason,
    window: null,
    rowCount: 0,
    gap: 0,
  });
  if (account.kind === "card") return unknown("card");
  if (!b) return unknown("no_balance");
  if (!a) return unknown("one_balance");

  const from = israelToday(new Date(a.taken_at));
  const to = israelToday(new Date(b.taken_at));
  const rows = rowsBetween(db, account.id, { from, fromAt: a.taken_at, to, toAt: b.taken_at });
  const gap = b.balance - a.balance - rows.total;
  return {
    accountId: account.id,
    balance: b.balance,
    asOf: b.taken_at,
    status: gap === 0 ? "matches" : "gap",
    unknownReason: null,
    window: { from, to },
    rowCount: rows.count,
    gap,
  };
}

interface Between {
  /** A's day and the time A was taken. */
  from: IsoDate;
  fromAt: string;
  /** B's day and the time B was taken. */
  to: IsoDate;
  toAt: string;
}

function rowsBetween(db: Db, accountId: number, w: Between): { count: number; total: Agorot } {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE account_id = ? AND status = 'completed'
         AND date <= ? AND created_at <= ?
         AND (date > ? OR (date = ? AND created_at > ?))`,
    )
    .get(accountId, w.to, w.toAt, w.from, w.from, w.fromAt) as { count: number; total: number };
  return { count: row.count, total: row.total };
}
