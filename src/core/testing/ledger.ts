// Builders for synthetic ledgers in tests. Every merchant, account number,
// card number and amount here is made up; no real data belongs in this folder.

import type { ProviderId, ScrapedAccount, ScrapedTransaction } from "@shared/types";
import type { Db } from "../db";
import { dbWithFirstCategories } from "./migrations";

export const NOW = new Date("2026-03-31T09:00:00Z");
export const BANK_NUMBER = "100-200300";

/** Full schema, with the first default categories (Food holds Groceries); see ./migrations. */
export function newDb(): Db {
  return dbWithFirstCategories();
}

type TxnInput = Pick<ScrapedTransaction, "date" | "amount" | "description"> & Partial<ScrapedTransaction>;

export function txn(input: TxnInput): ScrapedTransaction {
  return {
    processedDate: null,
    originalAmount: null,
    originalCurrency: null,
    memo: null,
    status: "completed",
    installment: null,
    identifier: null,
    ...input,
  };
}

/** A card row billed to the bank on `processedDate`. */
export function charge(date: string, amount: number, description: string, processedDate: string): ScrapedTransaction {
  return txn({ date, amount, description, processedDate });
}

export function bank(transactions: ScrapedTransaction[], accountNumber = BANK_NUMBER): ScrapedAccount {
  return { provider: "discount", accountNumber, balance: 1_000_000, transactions };
}

export function card(last4: string, transactions: ScrapedTransaction[]): ScrapedAccount {
  return { provider: "visaCal", accountNumber: last4, balance: null, transactions };
}

export function categoryId(db: Db, name: string): number {
  const row = db.prepare("SELECT id FROM categories WHERE name = ?").get(name) as { id: number } | undefined;
  if (!row) throw new Error(`no category named ${name}`);
  return row.id;
}

export function accountId(db: Db, provider: ProviderId, accountNumber: string): number {
  const row = db
    .prepare("SELECT id FROM accounts WHERE provider = ? AND account_number = ?")
    .get(provider, accountNumber) as { id: number } | undefined;
  if (!row) throw new Error(`no account ${provider} ${accountNumber}`);
  return row.id;
}

/** Ids of rows with this exact description, oldest id first. */
export function idsOf(db: Db, description: string): number[] {
  return (
    db.prepare("SELECT id FROM transactions WHERE description = ? ORDER BY id").all(description) as { id: number }[]
  ).map((r) => r.id);
}

export function idOf(db: Db, description: string): number {
  const ids = idsOf(db, description);
  if (ids.length !== 1) throw new Error(`expected one row for ${description}, found ${ids.length}`);
  return ids[0] as number;
}

/** Raw stored columns of one row. */
export function stored(db: Db, id: number): Record<string, unknown> {
  return db.prepare("SELECT * FROM transactions WHERE id = ?").get(id) as Record<string, unknown>;
}

/** Every stored column of every row, for before/after comparisons. */
export function snapshot(db: Db): Record<string, unknown>[] {
  return db.prepare("SELECT * FROM transactions ORDER BY id").all() as Record<string, unknown>[];
}

export function countRows(db: Db): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM transactions").get() as { n: number }).n;
}
