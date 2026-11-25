// Spec 33 (F65): money in that pays back part of a purchase. Synthetic rows.

import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import { NOW, bank, categoryId, idOf, newDb, snapshot, stored, txn } from "../testing/ledger";
import { ingest } from "./ingest";
import { clearPaidBack, markPaidBack, paidBackCandidates } from "./paid-back";
import { spendingByCategory, totals } from "./period";
import { emptyTrash, listTransactions, trashTransactions, updateTransactions } from "./queries";
import { saveRule } from "../rules/queries";
import { ruleInput } from "../testing/rules";

// The pay-back arrives 2026-03-12. Its window runs 2026-01-11 to 2026-03-19.
function ledger(): Db {
  const db = newDb();
  ingest(
    db,
    [
      bank([
        txn({ date: "2026-01-10", amount: -5000, description: "too early" }),
        txn({ date: "2026-01-11", amount: -4000, description: "first day" }),
        txn({ date: "2026-03-01", amount: -10000, description: "Pizza Hut" }),
        txn({ date: "2026-03-02", amount: -1500, description: "trashed buy" }),
        txn({ date: "2026-03-03", amount: -1500, description: "excluded buy" }),
        txn({ date: "2026-03-04", amount: -1000, description: "deposit" }),
        txn({ date: "2026-03-05", amount: -3000, description: "coffee" }),
        txn({ date: "2026-03-10", amount: 3000, description: "refund" }),
        txn({ date: "2026-03-12", amount: 5000, description: "Bit from Dana" }),
        txn({ date: "2026-03-19", amount: -2000, description: "last day" }),
        txn({ date: "2026-03-20", amount: -2000, description: "too late" }),
      ]),
    ],
    { now: NOW },
  );
  updateTransactions(db, [idOf(db, "Pizza Hut")], { categoryId: categoryId(db, "Restaurants") });
  updateTransactions(db, [idOf(db, "deposit")], { categoryId: categoryId(db, "Savings") });
  updateTransactions(db, [idOf(db, "excluded buy")], { excluded: true });
  trashTransactions(db, [idOf(db, "trashed buy")]);
  return db;
}

const names = (rows: { description: string }[]) => rows.map((r) => r.description);
const row = (db: Db, description: string) => listTransactions(db, { search: description })[0];

describe("paid back candidates", () => {
  it("are money out counting as spending, 60 days before to 7 after, newest first", () => {
    const db = ledger();
    const rowId = idOf(db, "Bit from Dana");
    expect(names(paidBackCandidates(db, { rowId }))).toEqual(["last day", "coffee", "Pizza Hut", "first day"]);
  });

  it("search the description and the note", () => {
    const db = ledger();
    const rowId = idOf(db, "Bit from Dana");
    updateTransactions(db, [idOf(db, "coffee")], { note: "with Noa" });
    expect(names(paidBackCandidates(db, { rowId, text: "pizza" }))).toEqual(["Pizza Hut"]);
    expect(names(paidBackCandidates(db, { rowId, text: " noa " }))).toEqual(["coffee"]);
    expect(paidBackCandidates(db, { rowId, text: "nothing like it" })).toEqual([]);
  });

  it("stop at 50", () => {
    const db = newDb();
    const buys = Array.from({ length: 60 }, (_, i) =>
      txn({ date: `2026-02-${String((i % 28) + 1).padStart(2, "0")}`, amount: -100 - i, description: `buy ${i}` }),
    );
    ingest(db, [bank([...buys, txn({ date: "2026-03-01", amount: 900, description: "back" })])], { now: NOW });
    const found = paidBackCandidates(db, { rowId: idOf(db, "back") });
    expect(found).toHaveLength(50);
    const dates = found.map((r) => r.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("reject malformed arguments", () => {
    const db = ledger();
    expect(() => paidBackCandidates(db, { rowId: 0 })).toThrow("BAD_REQUEST");
    expect(() => paidBackCandidates(db, { rowId: 99_999 })).toThrow("BAD_REQUEST");
    expect(() => paidBackCandidates(db, { rowId: 1, text: 5 as unknown as string })).toThrow("BAD_REQUEST");
  });
});

describe("marking paid back", () => {
  it("copies the purchase's category as the user's and remembers the purchase", () => {
    const db = ledger();
    const rowId = idOf(db, "Bit from Dana");
    const purchaseId = idOf(db, "Pizza Hut");
    const before = stored(db, purchaseId);
    expect(markPaidBack(db, { rowId, purchaseId })).toEqual({ ok: true });

    expect(stored(db, rowId)).toMatchObject({
      category_id: categoryId(db, "Restaurants"),
      category_source: "user",
      paid_back_for: purchaseId,
      amount: 5000,
    });
    expect(stored(db, purchaseId)).toEqual(before);
    const shown = row(db, "Bit from Dana");
    expect(shown?.flow).toBe("refund");
    expect(shown?.flags).toEqual([]);
    expect(shown?.paidBackFor).toEqual({ id: purchaseId, description: "Pizza Hut", date: "2026-03-01", amount: -10000 });
    expect(row(db, "Pizza Hut")?.paidBackFor).toBeNull();
  });

  it("refuses money out, a row that is not a purchase, and an uncategorized purchase, changing nothing", () => {
    const db = ledger();
    const rows = snapshot(db);
    const pay = idOf(db, "Bit from Dana");
    expect(markPaidBack(db, { rowId: idOf(db, "coffee"), purchaseId: idOf(db, "Pizza Hut") })).toEqual({
      ok: false,
      problem: "not_money_in",
    });
    expect(markPaidBack(db, { rowId: pay, purchaseId: idOf(db, "refund") })).toEqual({ ok: false, problem: "not_a_purchase" });
    expect(markPaidBack(db, { rowId: pay, purchaseId: idOf(db, "deposit") })).toEqual({ ok: false, problem: "not_a_purchase" });
    expect(markPaidBack(db, { rowId: pay, purchaseId: idOf(db, "trashed buy") })).toEqual({ ok: false, problem: "not_a_purchase" });
    expect(markPaidBack(db, { rowId: pay, purchaseId: idOf(db, "coffee") })).toEqual({
      ok: false,
      problem: "purchase_uncategorized",
    });
    expect(() => markPaidBack(db, { rowId: pay, purchaseId: 99_999 })).toThrow("BAD_REQUEST");
    expect(snapshot(db)).toEqual(rows);
  });

  it("makes a 100 purchase with a 50 pay-back count as 50 spending, and a second pay-back as 0", () => {
    const db = newDb();
    ingest(
      db,
      [
        bank([
          txn({ date: "2026-03-01", amount: -10000, description: "pizza" }),
          txn({ date: "2026-03-02", amount: 5000, description: "friend one" }),
          txn({ date: "2026-03-03", amount: 5000, description: "friend two" }),
        ]),
      ],
      { now: NOW },
    );
    const restaurants = categoryId(db, "Restaurants");
    const pizza = idOf(db, "pizza");
    updateTransactions(db, [pizza], { categoryId: restaurants });
    const march = () => totals(db, "2026-03-01", "2026-04-01");
    const restaurantSpending = () =>
      spendingByCategory(db, "2026-03-01", "2026-04-01").find((c) => c.categoryId === restaurants)?.amount;
    expect(march()).toMatchObject({ spending: 10000, income: 10000 });

    markPaidBack(db, { rowId: idOf(db, "friend one"), purchaseId: pizza });
    expect(march()).toMatchObject({ spending: 5000, income: 5000 });
    expect(restaurantSpending()).toBe(5000);

    markPaidBack(db, { rowId: idOf(db, "friend two"), purchaseId: pizza });
    expect(march()).toMatchObject({ spending: 0, income: 0 });
    expect(restaurantSpending()).toBe(0);
    expect(listTransactions(db, {}).filter((r) => r.paidBackFor?.id === pizza)).toHaveLength(2);
  });
});

describe("not paid back", () => {
  it("removes the link and the category, so the row is back in Needs review", () => {
    const db = ledger();
    const rowId = idOf(db, "Bit from Dana");
    markPaidBack(db, { rowId, purchaseId: idOf(db, "Pizza Hut") });
    expect(clearPaidBack(db, { rowId })).toEqual({ updated: 1 });
    expect(stored(db, rowId)).toMatchObject({ category_id: null, category_source: "user", paid_back_for: null });
    const shown = row(db, "Bit from Dana");
    expect(shown?.flow).toBe("income");
    expect(shown?.flags).toEqual(["uncategorized"]);
    expect(shown?.paidBackFor).toBeNull();
    // A row with no link is left alone.
    expect(clearPaidBack(db, { rowId })).toEqual({ updated: 0 });
    expect(() => clearPaidBack(db, { rowId: -1 })).toThrow("BAD_REQUEST");
  });

  // Review 2026-11-25: the link explains the category it copied, so a new category ends it.
  it("happens when the user gives the row another category, so Not paid back cannot wipe it", () => {
    const db = ledger();
    const rowId = idOf(db, "Bit from Dana");
    markPaidBack(db, { rowId, purchaseId: idOf(db, "Pizza Hut") });
    updateTransactions(db, [rowId], { categoryId: categoryId(db, "Groceries") });
    expect(stored(db, rowId)).toMatchObject({ paid_back_for: null, category_id: categoryId(db, "Groceries") });
    expect(clearPaidBack(db, { rowId })).toEqual({ updated: 0 });
    expect(stored(db, rowId)).toMatchObject({ category_id: categoryId(db, "Groceries"), category_source: "user" });
  });

  it("does not happen when the row is given the category it already has", () => {
    const db = ledger();
    const rowId = idOf(db, "Bit from Dana");
    const purchaseId = idOf(db, "Pizza Hut");
    markPaidBack(db, { rowId, purchaseId });
    updateTransactions(db, [rowId, idOf(db, "coffee")], { categoryId: categoryId(db, "Restaurants") });
    expect(stored(db, rowId)).toMatchObject({ paid_back_for: purchaseId });
  });

  it("happens when a rule the user saves takes the row over", () => {
    const db = ledger();
    const rowId = idOf(db, "Bit from Dana");
    markPaidBack(db, { rowId, purchaseId: idOf(db, "Pizza Hut") });
    const groceries = categoryId(db, "Groceries");
    saveRule(db, { id: null, rule: ruleInput({ matchText: "Bit from", setCategoryId: groceries }), alsoChange: [rowId] }, NOW);
    expect(stored(db, rowId)).toMatchObject({ paid_back_for: null, category_id: groceries, category_source: "rule" });
  });

  it("happens on its own when the purchase is deleted for good, and the category stays", () => {
    const db = ledger();
    const rowId = idOf(db, "Bit from Dana");
    const purchaseId = idOf(db, "Pizza Hut");
    markPaidBack(db, { rowId, purchaseId });
    trashTransactions(db, [purchaseId]);
    expect(row(db, "Bit from Dana")?.paidBackFor?.id).toBe(purchaseId);
    emptyTrash(db);
    expect(stored(db, rowId)).toMatchObject({ paid_back_for: null, category_id: categoryId(db, "Restaurants") });
    expect(row(db, "Bit from Dana")?.paidBackFor).toBeNull();
  });
});
