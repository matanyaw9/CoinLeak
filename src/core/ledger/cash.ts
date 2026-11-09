// The cash wallet (spec 20): one money account of kind 'cash' per profile,
// made on first use, holding rows the user types in (`source = 'manual'`).
// It never syncs, so ingest, gone and card-bill matching never see its rows.
// Bank ATM withdrawals count as money moved into it (card-bills.ts).

import { randomUUID } from "node:crypto";
import type { CashWallet, ManualTransactionInput } from "@shared/types";
import { transaction, type Db } from "../db";
import { applyRulesInTransaction } from "../rules/engine";
import { applyCardBills } from "./card-bills";
import { isIsoDate } from "./dates";
import { check, cleanNote, isId } from "./validate";

export const DESCRIPTION_MAX = 200;

export function getCashWallet(db: Db): CashWallet | null {
  const row = db
    .prepare(
      `SELECT a.id, (SELECT COUNT(*) FROM transactions t WHERE t.account_id = a.id AND t.trashed_at IS NULL) AS n
       FROM accounts a WHERE a.kind = 'cash'`,
    )
    .get() as { id: number; n: number } | undefined;
  return row ? { id: row.id, rowCount: row.n } : null;
}

/** Adds a row to the wallet, making the wallet first if there is none. */
export function addManualTransaction(db: Db, input: ManualTransactionInput, now = new Date()): { id: number } {
  const row = checkInput(db, input);
  const at = now.toISOString();
  return transaction(db, () => {
    const wallet = getCashWallet(db)?.id ?? createWallet(db, at);
    const id = Number(
      db
        .prepare(
          `INSERT INTO transactions (account_id, date, amount, description, status, category_id, category_source, note,
             source, dedup_hash, dedup_seq, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, 'manual', ?, 0, ?, ?)`,
        )
        .run(
          wallet,
          row.date,
          row.amount,
          row.description,
          row.categoryId,
          row.categoryId === null ? null : "user",
          row.note,
          `manual:${randomUUID()}`,
          at,
          at,
        ).lastInsertRowid,
    );
    // A row with no category may fit a rule; the wallet's start may move.
    applyRulesInTransaction(db, { ids: [id] }, now);
    applyCardBills(db);
    return { id };
  });
}

/**
 * Changes every field of a row typed by hand. A new category is the user's;
 * the same category keeps whoever set it. Synced rows are refused.
 */
export function editManualTransaction(
  db: Db,
  id: number,
  input: ManualTransactionInput,
  now = new Date(),
): { updated: number } {
  check(isId(id));
  const row = checkInput(db, input);
  return transaction(db, () => {
    const current = db.prepare("SELECT source, category_id FROM transactions WHERE id = ?").get(id) as
      | { source: string; category_id: number | null }
      | undefined;
    check(current !== undefined && current.source === "manual");
    const sameCategory = current.category_id === row.categoryId;
    const res = db
      .prepare(
        `UPDATE transactions SET date = ?, amount = ?, description = ?, note = ?, updated_at = ?
           ${sameCategory ? "" : ", category_id = ?, category_source = 'user'"}
         WHERE id = ?`,
      )
      .run(
        row.date,
        row.amount,
        row.description,
        row.note,
        now.toISOString(),
        ...(sameCategory ? [] : [row.categoryId]),
        id,
      );
    applyRulesInTransaction(db, { ids: [id] }, now);
    applyCardBills(db);
    return { updated: Number(res.changes) };
  });
}

function createWallet(db: Db, at: string): number {
  return Number(
    db
      .prepare(
        `INSERT INTO accounts (provider, kind, account_number, name, created_at, sync_enabled)
         VALUES ('cash', 'cash', 'cash', NULL, ?, 0)`,
      )
      .run(at).lastInsertRowid,
  );
}

function checkInput(db: Db, input: ManualTransactionInput): ManualTransactionInput {
  check(typeof input === "object" && input !== null);
  check(isIsoDate(input.date));
  check(Number.isSafeInteger(input.amount) && input.amount !== 0);
  check(typeof input.description === "string");
  const description = input.description.replace(/\s+/g, " ").trim();
  check(description.length >= 1 && description.length <= DESCRIPTION_MAX);
  check(input.categoryId === null || isId(input.categoryId));
  if (input.categoryId !== null) {
    check(db.prepare("SELECT 1 FROM categories WHERE id = ?").get(input.categoryId) !== undefined);
  }
  return { date: input.date, amount: input.amount, description, categoryId: input.categoryId, note: cleanNote(input.note) };
}
