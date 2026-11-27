import { describe, expect, it } from "vitest";
import { CodedError } from "@shared/errors";
import { PROVIDER_IDS, PROVIDERS } from "@shared/providers";
import {
  BANK_NUMBER,
  NOW,
  accountId,
  bank,
  card,
  categoryId,
  countRows,
  idOf,
  idsOf,
  newDb,
  snapshot,
  stored,
  txn,
} from "../testing/ledger";
import { setCardMode } from "./card-bills";
import { ingest, PROVIDER_KIND } from "./ingest";
import { listAccounts } from "./accounts";
import { updateTransactions } from "./edits";
import { listTransactions, monthSummary } from "./queries";

const day = (d: number, amount: number, description = `קנייה ${d}`) =>
  txn({ date: `2026-03-${String(d).padStart(2, "0")}`, amount, description });
const coffee = () => txn({ date: "2026-03-02", amount: -1800, description: "קפה השכונה" });

describe("dedup", () => {
  it("two overlapping downloads give no duplicates", () => {
    const db = newDb();
    const first = ingest(db, [card("4321", [day(1, -100), day(2, -200), day(3, -300), day(4, -400)])], { now: NOW });
    const second = ingest(db, [card("4321", [day(3, -300), day(4, -400), day(5, -500), day(6, -600)])], { now: NOW });
    expect(first.newRows).toBe(4);
    expect(second.newRows).toBe(2);
    expect(countRows(db)).toBe(6);
  });

  it("two identical coffees on the same day are two rows", () => {
    const db = newDb();
    const result = ingest(db, [card("4321", [coffee(), coffee()])], { now: NOW });
    expect(result.newRows).toBe(2);
    expect(idsOf(db, "קפה השכונה")).toHaveLength(2);
    const seqs = idsOf(db, "קפה השכונה").map((id) => stored(db, id).dedup_seq);
    expect(seqs).toEqual([0, 1]);
  });

  it("a third identical coffee in a later download is added, overlap is not", () => {
    const db = newDb();
    ingest(db, [card("4321", [coffee(), coffee()])], { now: NOW });
    expect(ingest(db, [card("4321", [coffee(), coffee()])], { now: NOW }).newRows).toBe(0);
    expect(ingest(db, [card("4321", [coffee(), coffee(), coffee()])], { now: NOW }).newRows).toBe(1);
    expect(idsOf(db, "קפה השכונה")).toHaveLength(3);
  });

  it("the same row on two accounts is two rows", () => {
    const db = newDb();
    ingest(db, [card("4321", [coffee()]), card("8765", [coffee()])], { now: NOW });
    expect(countRows(db)).toBe(2);
  });

  it("counts copies across a card listed twice in one download", () => {
    const db = newDb();
    ingest(db, [card("4321", [coffee()]), card("4321", [coffee()])], { now: NOW });
    expect(countRows(db)).toBe(2);
    expect(ingest(db, [card("4321", [coffee(), coffee()])], { now: NOW }).newRows).toBe(0);
  });

  it("installments of the same purchase are separate rows", () => {
    const db = newDb();
    const base = { date: "2026-03-01", amount: -10000, description: "חנות רהיטים" };
    ingest(db, [card("4321", [txn({ ...base, installment: { number: 1, total: 3 } })])], { now: NOW });
    const r = ingest(db, [card("4321", [txn({ ...base, installment: { number: 2, total: 3 } })])], { now: NOW });
    expect(r.newRows).toBe(1);
    expect(countRows(db)).toBe(2);
  });
});

describe("pending rows", () => {
  const pending = txn({
    date: "2026-03-20",
    amount: -5600,
    description: "מסעדה בעיר",
    status: "pending",
    memo: "pending memo",
  });

  it("pending to completed updates in place and keeps the user's category", () => {
    const db = newDb();
    ingest(db, [card("4321", [pending])], { now: NOW });
    const id = idOf(db, "מסעדה בעיר");
    const restaurants = categoryId(db, "Restaurants");
    updateTransactions(db, [id], { categoryId: restaurants, note: "dinner" });

    const later = new Date("2026-04-02T08:00:00Z");
    const settled = { ...pending, status: "completed" as const, processedDate: "2026-04-10", identifier: "99881" };
    const result = ingest(db, [card("4321", [settled])], { now: later });

    expect(result).toMatchObject({ newRows: 0, updatedRows: 1 });
    expect(idOf(db, "מסעדה בעיר")).toBe(id);
    expect(stored(db, id)).toMatchObject({
      status: "completed",
      processed_date: "2026-04-10",
      identifier: "99881",
      category_id: restaurants,
      category_source: "user",
      note: "dinner",
      memo: "pending memo",
      updated_at: later.toISOString(),
    });
  });

  it("only status, processed date and identifier change when a row settles", () => {
    const db = newDb();
    ingest(db, [card("4321", [pending])], { now: NOW });
    const id = idOf(db, "מסעדה בעיר");
    const settled = {
      ...pending,
      status: "completed" as const,
      processedDate: "2026-04-10",
      memo: "a different memo",
      originalAmount: -1500,
      originalCurrency: "USD",
    };
    ingest(db, [card("4321", [settled])], { now: NOW });
    expect(stored(db, id)).toMatchObject({ memo: "pending memo", original_amount: null, original_currency: null });
  });

  it("a row that is still pending, or already completed, is left alone", () => {
    const db = newDb();
    ingest(db, [card("4321", [pending, day(1, -100)])], { now: NOW });
    const before = [stored(db, idOf(db, "מסעדה בעיר")), stored(db, idOf(db, "קנייה 1"))];
    const again = ingest(db, [card("4321", [pending, { ...day(1, -100), status: "pending" as const }])], {
      now: new Date("2026-04-01T00:00:00Z"),
    });
    expect(again).toMatchObject({ newRows: 0, updatedRows: 0 });
    expect([stored(db, idOf(db, "מסעדה בעיר")), stored(db, idOf(db, "קנייה 1"))]).toEqual(before);
  });
});

describe("judgePending: false (a download whose pending rows may be missing)", () => {
  const later = new Date("2026-04-02T08:00:00Z");
  const open = (date: string, amount: number, description: string) =>
    txn({ date, amount, description, status: "pending" });
  const statusOf = (db: ReturnType<typeof newDb>, description: string) =>
    listTransactions(db).find((t) => t.description === description)?.status;

  it("marks nothing gone but still settles", () => {
    const db = newDb();
    ingest(db, [card("4321", [open("2026-03-20", -5600, "מסעדה בעיר"), open("2026-03-25", -12000, "חנות נעליים")])], {
      now: NOW,
    });
    const restaurant = idOf(db, "מסעדה בעיר");
    updateTransactions(db, [restaurant], { note: "dinner" });

    const settled = txn({ date: "2026-03-21", amount: -5650, description: "מסעדה בעיר", processedDate: "2026-04-10" });
    const result = ingest(db, [card("4321", [settled])], { now: later, since: "2026-03-01", judgePending: false });

    expect(result).toMatchObject({ newRows: 0, updatedRows: 1 });
    expect(stored(db, restaurant)).toMatchObject({ status: "completed", amount: -5650, note: "dinner" });
    expect(statusOf(db, "חנות נעליים")).toBe("pending");
    expect(listTransactions(db, { flows: ["gone"] })).toEqual([]);
    expect(monthSummary(db, "2026-03").spending).toBe(17650);
  });

  it("changes nothing for an empty download, and true or unset judges as before", () => {
    const db = newDb();
    ingest(db, [card("4321", [open("2026-03-25", -12000, "חנות נעליים")])], { now: NOW });
    const before = snapshot(db);
    ingest(db, [card("4321", [])], { now: later, since: "2026-03-01", judgePending: false });
    expect(snapshot(db)).toEqual(before);

    ingest(db, [card("4321", [])], { now: later, since: "2026-03-01", judgePending: true });
    expect(statusOf(db, "חנות נעליים")).toBe("gone");
  });

  it("a gone row stays gone, and comes back when the download has it", () => {
    const db = newDb();
    const shoes = open("2026-03-25", -12000, "חנות נעליים");
    ingest(db, [card("4321", [shoes])], { now: NOW });
    ingest(db, [card("4321", [])], { now: NOW, since: "2026-03-01" });
    ingest(db, [card("4321", [])], { now: later, since: "2026-03-01", judgePending: false });
    expect(statusOf(db, "חנות נעליים")).toBe("gone");
    ingest(db, [card("4321", [shoes])], { now: later, since: "2026-03-01", judgePending: false });
    expect(statusOf(db, "חנות נעליים")).toBe("pending");
  });
});

describe("user fields", () => {
  it("survive a re-sync", () => {
    const db = newDb();
    const rows = [day(1, -100), day(2, -200), day(3, 300)];
    ingest(db, [bank(rows)], { now: NOW });
    const [a, b, c] = [idOf(db, "קנייה 1"), idOf(db, "קנייה 2"), idOf(db, "קנייה 3")];
    const groceries = categoryId(db, "Groceries");
    updateTransactions(db, [a], { categoryId: groceries });
    updateTransactions(db, [b], { note: "shared with a friend" });
    updateTransactions(db, [c], { excluded: true });
    const before = [stored(db, a), stored(db, b), stored(db, c)];

    const result = ingest(db, [bank([...rows, day(4, -400)])], { now: new Date("2026-04-01T00:00:00Z") });

    expect(result.newRows).toBe(1);
    expect([stored(db, a), stored(db, b), stored(db, c)]).toEqual(before);
  });

  it("account name and card mode survive a re-sync", () => {
    const db = newDb();
    ingest(db, [card("4321", [])], { now: NOW });
    const id = accountId(db, "visaCal", "4321");
    db.prepare("UPDATE accounts SET name = 'Everyday card' WHERE id = ?").run(id);
    setCardMode(db, id, "debit");
    ingest(db, [card("4321", [day(1, -100)])], { now: NOW });
    expect(listAccounts(db)).toMatchObject([{ id, name: "Everyday card", cardMode: "debit" }]);
  });
});

describe("accounts and sync runs", () => {
  it("creates Discount as a bank and Cal as a credit card, and records the sync", () => {
    const db = newDb();
    ingest(db, [bank([day(1, -100)])], { now: NOW });
    ingest(db, [card("4321", [day(2, -200)]), card("8765", [])], { now: NOW });
    expect(listAccounts(db)).toEqual([
      expect.objectContaining({ provider: "discount", kind: "bank", accountNumber: BANK_NUMBER, cardMode: null }),
      expect.objectContaining({ provider: "visaCal", kind: "card", accountNumber: "4321", cardMode: "credit" }),
      expect.objectContaining({ provider: "visaCal", kind: "card", accountNumber: "8765", cardMode: "credit" }),
    ]);
    expect(listAccounts(db)[0]?.lastSyncedAt).toBe(NOW.toISOString());
  });

  it("returns the counts and stamps each new row with its sync run", () => {
    const db = newDb();
    const first = ingest(db, [card("4321", [day(1, -100)])], { now: NOW });
    const second = ingest(db, [card("4321", [day(1, -100), day(2, -200)]), card("8765", [])], { now: NOW });
    expect(first).toEqual({ provider: "visaCal", accounts: 1, newRows: 1, updatedRows: 0 });
    expect(second).toEqual({ provider: "visaCal", accounts: 2, newRows: 1, updatedRows: 0 });
    const runs = db.prepare("SELECT id, provider, accounts, new_rows, updated_rows FROM sync_runs ORDER BY id").all();
    expect(runs).toEqual([
      { id: 1, provider: "visaCal", accounts: 1, new_rows: 1, updated_rows: 0 },
      { id: 2, provider: "visaCal", accounts: 2, new_rows: 1, updated_rows: 0 },
    ]);
    expect(stored(db, idOf(db, "קנייה 1")).sync_run_id).toBe(1);
    expect(stored(db, idOf(db, "קנייה 2")).sync_run_id).toBe(2);
  });

  it("keeps the description exactly as the bank sent it", () => {
    const db = newDb();
    ingest(db, [card("4321", [txn({ date: "2026-03-01", amount: -100, description: "  סופר  הדר " })])], { now: NOW });
    expect(idsOf(db, "  סופר  הדר ")).toHaveLength(1);
  });

  it("takes each provider's kind from the registry: every bank a bank, every card company a credit card", () => {
    expect(Object.keys(PROVIDER_KIND).sort()).toEqual([...PROVIDER_IDS].sort());
    const db = newDb();
    for (const p of PROVIDERS) {
      ingest(db, [{ provider: p.id, accountNumber: "9876", balance: null, transactions: [] }], { now: NOW });
    }
    const kinds = Object.fromEntries(listAccounts(db).map((a) => [a.provider, [a.kind, a.cardMode]]));
    for (const p of PROVIDERS) {
      expect(kinds[p.id], p.id).toEqual(p.kind === "card" ? ["card", "credit"] : ["bank", null]);
    }
    expect(kinds["max"]).toEqual(["card", "credit"]);
    expect(kinds["hapoalim"]).toEqual(["bank", null]);
  });

  it("rejects a provider the registry does not know", () => {
    const db = newDb();
    for (const provider of ["leumiCard", "__proto__", "toString"]) {
      expect(() => ingest(db, [], { now: NOW, provider: provider as never }), provider).toThrow(CodedError);
    }
  });

  it("accepts an empty download when told the provider", () => {
    const db = newDb();
    expect(ingest(db, [], { now: NOW, provider: "discount" })).toEqual({
      provider: "discount",
      accounts: 0,
      newRows: 0,
      updatedRows: 0,
    });
  });
});

describe("bad input", () => {
  const rejects = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      expect(e).toBeInstanceOf(CodedError);
      expect((e as CodedError).code).toBe("BAD_REQUEST");
      return;
    }
    throw new Error("expected BAD_REQUEST");
  };

  it("rejects a float amount and saves nothing at all", () => {
    const db = newDb();
    rejects(() => ingest(db, [bank([day(1, -100), day(2, -12.5)])], { now: NOW }));
    expect(countRows(db)).toBe(0);
    expect(listAccounts(db)).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM sync_runs").get()).toEqual({ n: 0 });
  });

  it("rejects bad dates, mixed providers and an empty download without a provider", () => {
    const db = newDb();
    rejects(() => ingest(db, [bank([txn({ date: "2026-02-30", amount: -1, description: "x" })])], { now: NOW }));
    rejects(() => ingest(db, [bank([txn({ date: "03/01/2026", amount: -1, description: "x" })])], { now: NOW }));
    rejects(() => ingest(db, [bank([]), card("4321", [])], { now: NOW }));
    rejects(() => ingest(db, [], { now: NOW }));
    rejects(() => ingest(db, [], { now: NOW, provider: "toString" as never }));
    rejects(() => ingest(db, [card("4321", [])], { now: NOW, judgePending: "no" as never }));
  });
});
