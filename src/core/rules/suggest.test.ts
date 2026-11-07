import { describe, expect, it } from "vitest";
import { ingest } from "../ledger/ingest";
import { listTransactions, updateTransactions } from "../ledger/queries";
import { NOW, accountId, bank, card, categoryId, charge, idOf, idsOf, newDb, txn } from "../testing/ledger";
import { lastRunId } from "../testing/rules";
import { applyRules } from "./engine";
import { createRule } from "./queries";
import { commonPrefix, suggestRule } from "./suggest";

describe("suggestRule", () => {
  it("gives a starts_with rule on the common prefix of three שופרסל rows with different branches", () => {
    const db = newDb();
    ingest(
      db,
      [
        card("4321", [
          charge("2026-03-02", -12000, "שופרסל דיל רמת גן", "2026-04-10"),
          charge("2026-03-09", -8550, "שופרסל  שלי חולון", "2026-04-10"),
          charge("2026-03-16", -30100, "שופרסל אקספרס תל אביב", "2026-04-10"),
        ]),
      ],
      { now: NOW },
    );
    const ids = listTransactions(db).map((t) => t.id);
    updateTransactions(db, ids, { categoryId: categoryId(db, "Groceries") });

    expect(suggestRule(db, ids)).toEqual({
      name: "שופרסל",
      enabled: true,
      matchField: "description",
      matchMode: "starts_with",
      matchText: "שופרסל",
      accountId: accountId(db, "visaCal", "4321"),
      amountMin: 8550,
      amountMax: 30100,
      direction: null,
      setCategoryId: categoryId(db, "Groceries"),
      setExcluded: null,
    });
  });

  it("uses the full text for one row", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-03-01", amount: -4990, description: " נטפליקס  ישראל " })])], { now: NOW });
    expect(suggestRule(db, [idOf(db, " נטפליקס  ישראל ")])).toMatchObject({
      matchMode: "starts_with",
      matchText: "נטפליקס ישראל",
      amountMin: 4990,
      amountMax: 4990,
      setCategoryId: null,
    });
  });

  it("leaves account and category open when the rows do not share them", () => {
    const db = newDb();
    ingest(db, [card("4321", [charge("2026-03-02", -1000, "קפה גרג", "2026-04-10")])], { now: NOW });
    ingest(db, [bank([txn({ date: "2026-03-03", amount: 500, description: "קפה גרג" })])], { now: NOW });
    const ids = idsOf(db, "קפה גרג");
    updateTransactions(db, ids.slice(0, 1), { categoryId: categoryId(db, "Coffee & Cafes") });
    expect(suggestRule(db, ids)).toMatchObject({
      matchText: "קפה גרג",
      accountId: null,
      amountMin: 500,
      amountMax: 1000,
      direction: null,
      setCategoryId: null,
    });
  });

  it("skips unknown ids and rejects a selection with no known row", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-03-01", amount: -100, description: "מכולת" })])], { now: NOW });
    expect(suggestRule(db, [idOf(db, "מכולת"), 999]).matchText).toBe("מכולת");
    expect(() => suggestRule(db, [999])).toThrow("BAD_REQUEST");
    expect(() => suggestRule(db, [])).toThrow("BAD_REQUEST");
    expect(() => suggestRule(db, [0])).toThrow("BAD_REQUEST");
  });

  it("saved without its amount span, categorizes the next sync's rows from that merchant", () => {
    const db = newDb();
    ingest(
      db,
      [
        card("4321", [
          charge("2026-03-02", -12000, "שופרסל דיל רמת גן", "2026-04-10"),
          charge("2026-03-09", -8550, "שופרסל שלי חולון", "2026-04-10"),
        ]),
      ],
      { now: NOW },
    );
    const picked = listTransactions(db).map((t) => t.id);
    updateTransactions(db, picked, { categoryId: categoryId(db, "Groceries") });
    createRule(db, { ...suggestRule(db, picked), amountMin: null, amountMax: null });

    ingest(db, [card("4321", [charge("2026-03-20", -4400, "שופרסל דיל חולון", "2026-04-10")])], { now: NOW });
    applyRules(db, { runId: lastRunId(db) });
    expect(listTransactions(db, { search: "שופרסל דיל חולון" })).toEqual([
      expect.objectContaining({ categoryId: categoryId(db, "Groceries"), categorySource: "rule", flags: [] }),
    ]);
  });
});

describe("commonPrefix", () => {
  it("cuts back to the last whole word, ignoring case", () => {
    expect(commonPrefix(["שופרסל דיל רמת גן", "שופרסל דיל רחובות"])).toBe("שופרסל דיל");
    expect(commonPrefix(["PAYPAL *NETFLIX", "PayPal *Netgear"])).toBe("PAYPAL");
    // Stopping after a symbol is not inside a word, so nothing is cut.
    expect(commonPrefix(["AMAZON MKTP US*2K3", "Amazon Mktp US*7J1"])).toBe("AMAZON MKTP US*");
    expect(commonPrefix(["נטפליקס", "נטפליקס חודשי"])).toBe("נטפליקס");
  });

  it("keeps a single partial word, and is empty when nothing is shared", () => {
    expect(commonPrefix(["סופרפארם", "סופרמרקט"])).toBe("סופר");
    expect(commonPrefix(["קפה", "מסעדה"])).toBe("");
  });

  it("is the whole text when every text is the same", () => {
    expect(commonPrefix(["פז חניונים", "פז חניונים"])).toBe("פז חניונים");
  });
});
