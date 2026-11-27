import { describe, expect, it } from "vitest";
import type { ManualTransactionInput } from "@shared/types";
import type { Db } from "../db";
import { NOW, bank, categoryId, idOf, newDb, snapshot, stored, txn } from "../testing/ledger";
import { setInternalByUser } from "./card-bills";
import { addManualTransaction, editManualTransaction, getCashWallet } from "./cash";
import { ingest } from "./ingest";
import { listAccounts } from "./accounts";
import { updateTransactions } from "./edits";
import { listTransactions, monthSummary } from "./queries";
import { emptyTrash, restoreTransactions, trashTransactions } from "./trash";

const coffee = (over: Partial<ManualTransactionInput> = {}): ManualTransactionInput => ({
  date: "2026-03-12",
  amount: -1800,
  description: "בית קפה",
  categoryId: null,
  note: null,
  ...over,
});

function row(db: Db, id: number) {
  const found = listTransactions(db, { flows: ["spending", "income", "refund", "internal", "excluded", "trashed", "transfer"] }).find(
    (t) => t.id === id,
  );
  if (!found) throw new Error(`row ${id} not listed`);
  return found;
}

const ATM = "משיכת מזומן";

describe("cash wallet", () => {
  it("is made on the first manual row, once, and stays out of the accounts list", () => {
    const db = newDb();
    ingest(db, [bank([])], { now: NOW });
    expect(getCashWallet(db)).toBeNull();
    const { id } = addManualTransaction(db, coffee(), NOW);
    addManualTransaction(db, coffee({ amount: -900 }), NOW);
    const wallet = getCashWallet(db);
    expect(wallet).toEqual({ id: stored(db, id).account_id, rowCount: 2 });
    expect(listAccounts(db).map((a) => a.kind)).toEqual(["bank"]);
    const account = db.prepare("SELECT kind, sync_enabled FROM accounts WHERE id = ?").get(wallet?.id ?? 0);
    expect(account).toEqual({ kind: "cash", sync_enabled: 0 });
  });

  it("adds a manual row as typed, with the user's category", () => {
    const db = newDb();
    const food = categoryId(db, "Coffee & Cafes");
    const { id } = addManualTransaction(db, coffee({ categoryId: food, note: "  with Dana  ", description: "  קפה   הפינה " }), NOW);
    const r = row(db, id);
    expect(r).toMatchObject({
      date: "2026-03-12",
      amount: -1800,
      description: "קפה הפינה",
      categoryId: food,
      categorySource: "user",
      note: "with Dana",
      status: "completed",
      flow: "spending",
      source: "manual",
    });
  });

  it("money in with no category is income", () => {
    const db = newDb();
    const { id } = addManualTransaction(db, coffee({ amount: 20000, description: "מזומן מההורים" }), NOW);
    expect(row(db, id).flow).toBe("income");
  });

  it("refuses bad input", () => {
    const db = newDb();
    const bad: Partial<ManualTransactionInput>[] = [
      { amount: 0 },
      { amount: 1.5 },
      { date: "2026-02-30" },
      { date: "12/03/2026" },
      { description: "   " },
      { description: "x".repeat(201) },
      { categoryId: 99999 },
      { note: "n".repeat(501) },
    ];
    for (const over of bad) expect(() => addManualTransaction(db, coffee(over), NOW)).toThrow("BAD_REQUEST");
    expect(getCashWallet(db)).toBeNull();
    addManualTransaction(db, coffee({ description: "x".repeat(200), note: "n".repeat(500) }), NOW);
  });

  it("edits every field of a manual row, and refuses synced rows", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-03-01", amount: -5000, description: "סופר" })])], { now: NOW });
    const { id } = addManualTransaction(db, coffee(), NOW);
    const market = categoryId(db, "Groceries");
    const next = { date: "2026-03-14", amount: 3000, description: "שוק", categoryId: market, note: "found" };
    expect(editManualTransaction(db, id, next, NOW)).toEqual({ updated: 1 });
    expect(row(db, id)).toMatchObject({ ...next, categorySource: "user", source: "manual", flow: "refund" });
    expect(() => editManualTransaction(db, idOf(db, "סופר"), next, NOW)).toThrow("BAD_REQUEST");
    expect(() => editManualTransaction(db, 9999, next, NOW)).toThrow("BAD_REQUEST");
    expect(() => editManualTransaction(db, id, { ...next, amount: 0 }, NOW)).toThrow("BAD_REQUEST");
  });

  it("trashes and restores a manual row like any row", () => {
    const db = newDb();
    const { id } = addManualTransaction(db, coffee(), NOW);
    trashTransactions(db, [id], NOW);
    expect(getCashWallet(db)?.rowCount).toBe(0);
    expect(listTransactions(db).map((r) => r.id)).toEqual([]);
    restoreTransactions(db, [id], NOW);
    expect(row(db, id).flow).toBe("spending");
    trashTransactions(db, [id], NOW);
    expect(emptyTrash(db, NOW)).toEqual({ deleted: 1 });
  });

  it("a sync after manual rows adds its rows and leaves the manual ones untouched", () => {
    const db = newDb();
    // Same date, amount and text as a bank row: still two different rows.
    addManualTransaction(db, coffee({ date: "2026-03-01", amount: -5000, description: "סופר" }), NOW);
    addManualTransaction(db, coffee({ date: "2026-03-02" }), NOW);
    const manual = snapshot(db);
    const download = [txn({ date: "2026-03-01", amount: -5000, description: "סופר", status: "pending" })];
    const first = ingest(db, [bank(download)], { now: NOW });
    expect(first.newRows).toBe(1);
    // The pending row is not in the next download: only it goes gone.
    ingest(db, [bank([])], { now: NOW, since: "2026-02-01" });
    expect(snapshot(db).filter((r) => r.source === "manual")).toEqual(manual);
    expect(listTransactions(db, { flows: ["gone"] }).map((r) => r.source)).toEqual(["sync"]);
  });
});

describe("ATM withdrawals and the cash wallet", () => {
  function setup(): Db {
    const db = newDb();
    ingest(
      db,
      [
        bank([
          txn({ date: "2026-03-05", amount: -20000, description: ATM }),
          txn({ date: "2026-02-20", amount: -10000, description: "משיכה מכספומט" }),
          txn({ date: "2026-03-01", amount: -350000, description: "חיוב זמני למפתח מזומן" }),
        ]),
      ],
      { now: NOW },
    );
    return db;
  }

  it("counts as spending without a wallet", () => {
    const db = setup();
    expect(row(db, idOf(db, ATM))).toMatchObject({ flow: "spending", movedToCash: false });
  });

  it("is internal with a wallet, from the wallet's first month on, and the money counts once", () => {
    const db = setup();
    addManualTransaction(db, coffee({ date: "2026-03-06", amount: -5000 }), NOW);
    addManualTransaction(db, coffee({ date: "2026-03-07", amount: -3000, description: "שוק" }), NOW);
    expect(row(db, idOf(db, ATM))).toMatchObject({ flow: "internal", movedToCash: true });
    // February is before the wallet started; the aggregate is no withdrawal.
    expect(row(db, idOf(db, "משיכה מכספומט"))).toMatchObject({ flow: "spending", movedToCash: false });
    expect(row(db, idOf(db, "חיוב זמני למפתח מזומן")).movedToCash).toBe(false);
    // 3,500 aggregate + 50 + 30 from the wallet; the 200 withdrawal is not counted again.
    expect(monthSummary(db, "2026-03", { now: NOW }).spending).toBe(350000 + 5000 + 3000);
  });

  it("a backdated wallet row moves the start back to its month", () => {
    const db = setup();
    addManualTransaction(db, coffee({ date: "2026-02-21" }), NOW);
    expect(row(db, idOf(db, "משיכה מכספומט")).flow).toBe("internal");
  });

  it("the user's word wins and stays", () => {
    const db = setup();
    addManualTransaction(db, coffee(), NOW);
    const id = idOf(db, ATM);
    setInternalByUser(db, [id], false, NOW);
    expect(row(db, id)).toMatchObject({ flow: "spending", movedToCash: false });
    addManualTransaction(db, coffee(), NOW); // rematches; the user's answer holds
    ingest(db, [bank([txn({ date: "2026-03-05", amount: -20000, description: ATM })])], { now: NOW });
    expect(row(db, id).flow).toBe("spending");
    // Marked internal by hand again (Undo): still reads as moved to the wallet.
    setInternalByUser(db, [id], true, NOW);
    expect(row(db, id)).toMatchObject({ flow: "internal", movedToCash: true });
    setInternalByUser(db, [id], null, NOW);
    expect(row(db, id)).toMatchObject({ flow: "internal", movedToCash: true });
  });

  it("never changes a row the user decided before the wallet existed", () => {
    const db = setup();
    const id = idOf(db, ATM);
    setInternalByUser(db, [id], false, NOW);
    addManualTransaction(db, coffee(), NOW);
    expect(stored(db, id)).toMatchObject({ internal: 0, internal_by_user: 1 });
  });
});

describe("notes", () => {
  it("saves trimmed, clears on empty, refuses over 500 characters", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-03-01", amount: -5000, description: "סופר" })])], { now: NOW });
    const id = idOf(db, "סופר");
    updateTransactions(db, [id], { note: "  for the party  " }, NOW);
    expect(stored(db, id).note).toBe("for the party");
    expect(listTransactions(db, { search: "party" }).map((r) => r.id)).toEqual([id]);
    expect(() => updateTransactions(db, [id], { note: "x".repeat(501) }, NOW)).toThrow("BAD_REQUEST");
    expect(stored(db, id).note).toBe("for the party");
    updateTransactions(db, [id], { note: "   " }, NOW);
    expect(stored(db, id).note).toBeNull();
    updateTransactions(db, [id], { note: "again" }, NOW);
    updateTransactions(db, [id], { note: null }, NOW);
    expect(stored(db, id).note).toBeNull();
  });

  it("a sync never changes a note", () => {
    const db = newDb();
    const download = [txn({ date: "2026-03-01", amount: -5000, description: "סופר", status: "pending" })];
    ingest(db, [bank(download)], { now: NOW });
    const id = idOf(db, "סופר");
    updateTransactions(db, [id], { note: "keep me" }, NOW);
    // Settles in place, then a plain repeat download.
    const settled = [txn({ date: "2026-03-01", amount: -5000, description: "סופר", status: "completed" })];
    ingest(db, [bank(settled)], { now: NOW });
    ingest(db, [bank(settled)], { now: NOW });
    expect(stored(db, id)).toMatchObject({ note: "keep me", status: "completed" });
  });
});
