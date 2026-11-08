import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import { ingest } from "../ledger/ingest";
import {
  listTransactions,
  monthSummary,
  restoreTransactions,
  trashTransactions,
  updateTransactions,
} from "../ledger/queries";
import { NOW, bank, card, categoryId, charge, idOf, newDb, snapshot, stored, txn } from "../testing/ledger";
import { lastRunId, ruleFields, ruleInput } from "../testing/rules";
import { applyRules } from "./engine";
import { createRule, deleteRule } from "./queries";
import { insertRule } from "./store";

const out = (date: string, amount: number, description: string) => txn({ date, amount, description });

function row(db: Db, id: number) {
  const found = listTransactions(db).find((t) => t.id === id);
  if (!found) throw new Error(`row ${id} not listed`);
  return found;
}

/** Saves a rule without reapplying, so a test controls when rules run. */
function saveRule(db: Db, input: Parameters<typeof ruleInput>[0], position: number): number {
  return insertRule(db, ruleInput(input), position, NOW.toISOString());
}

describe("order", () => {
  it("the first matching rule wins per field, and a later rule can still set another field", () => {
    const db = newDb();
    ingest(db, [bank([out("2026-03-01", -5000, "שופרסל דיל רמת גן"), out("2026-03-02", -6000, "שופרסל שלי חולון")])], {
      now: NOW,
    });
    const groceries = categoryId(db, "Groceries");
    const first = saveRule(db, { matchText: "שופרסל דיל", setCategoryId: groceries }, 1);
    saveRule(db, { matchText: "שופרסל", setCategoryId: categoryId(db, "Shopping") }, 2);
    const third = saveRule(db, { matchText: "שופרסל", setCategoryId: categoryId(db, "Home"), setExcluded: true }, 3);

    expect(applyRules(db, "all")).toEqual({ changed: 2 });
    // Category from rule 1 (first match); exclusion only rule 3 sets, so it wins that field.
    expect(ruleFields(db, idOf(db, "שופרסל דיל רמת גן"))).toEqual({
      category_id: groceries,
      category_source: "rule",
      excluded: 1,
      excluded_source: "rule",
      rule_id: third,
    });
    expect(ruleFields(db, idOf(db, "שופרסל שלי חולון"))).toMatchObject({
      category_id: categoryId(db, "Shopping"),
      excluded: 1,
      rule_id: third,
    });
    expect(first).toBeLessThan(third);
  });

  it("skips disabled rules", () => {
    const db = newDb();
    ingest(db, [bank([out("2026-03-01", -5000, "קפה הפינה")])], { now: NOW });
    saveRule(db, { matchText: "קפה", setCategoryId: categoryId(db, "Restaurants"), enabled: false }, 1);
    const coffee = saveRule(db, { matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") }, 2);
    applyRules(db, "all");
    expect(ruleFields(db, idOf(db, "קפה הפינה"))).toMatchObject({
      category_id: categoryId(db, "Coffee & Cafes"),
      rule_id: coffee,
    });
  });

  it("a rule that counts a row stops a later rule from excluding it", () => {
    const db = newDb();
    ingest(db, [bank([out("2026-03-01", -250000, "העברה לחיסכון"), out("2026-03-02", -40000, "העברה לבעל הבית")])], {
      now: NOW,
    });
    saveRule(db, { matchText: "בעל הבית", setExcluded: false }, 1);
    saveRule(db, { matchText: "העברה", setExcluded: true }, 2);
    applyRules(db, "all");
    expect(stored(db, idOf(db, "העברה לחיסכון"))).toMatchObject({ excluded: 1, excluded_source: "rule" });
    expect(stored(db, idOf(db, "העברה לבעל הבית"))).toMatchObject({ excluded: 0, excluded_source: "rule" });
    expect(monthSummary(db, "2026-03").spending).toBe(40000);
  });
});

describe("rule_id", () => {
  it("is the last rule in order that set a field, and only fields the rules own count", () => {
    const db = newDb();
    ingest(db, [bank([out("2026-03-01", -5000, "מנוי חדר כושר")])], { now: NOW });
    const id = idOf(db, "מנוי חדר כושר");
    const categorize = saveRule(db, { matchText: "חדר כושר", setCategoryId: categoryId(db, "Sports & Hobbies") }, 1);
    saveRule(db, { matchText: "מנוי", setExcluded: true }, 2);

    updateTransactions(db, [id], { excluded: false });
    applyRules(db, "all");
    expect(ruleFields(db, id)).toMatchObject({ category_source: "rule", excluded: 0, rule_id: categorize });

    updateTransactions(db, [id], { categoryId: categoryId(db, "Health") });
    applyRules(db, "all");
    expect(ruleFields(db, id)).toMatchObject({ category_source: "user", excluded_source: "user", rule_id: null });
  });
});

describe("scope", () => {
  function twoSyncs(): { db: Db; firstRun: number; secondRun: number } {
    const db = newDb();
    ingest(db, [bank([out("2026-03-01", -5000, "קפה הפינה"), out("2026-03-02", -7000, "קפה גרג")])], { now: NOW });
    const firstRun = lastRunId(db);
    ingest(db, [card("4321", [charge("2026-03-05", -3000, "קפה הפינה", "2026-04-10")])], { now: NOW });
    return { db, firstRun, secondRun: lastRunId(db) };
  }

  it("applyRules({ runId }) touches only that sync's rows", () => {
    const { db, firstRun, secondRun } = twoSyncs();
    expect(secondRun).not.toBe(firstRun);
    saveRule(db, { matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") }, 1);
    const firstRows = snapshot(db).filter((r) => r.sync_run_id === firstRun);

    expect(applyRules(db, { runId: secondRun })).toEqual({ changed: 1 });
    const after = snapshot(db);
    expect(after.filter((r) => r.sync_run_id === firstRun)).toEqual(firstRows);
    expect(after.filter((r) => r.sync_run_id === secondRun)).toEqual([
      expect.objectContaining({ category_id: categoryId(db, "Coffee & Cafes"), category_source: "rule" }),
    ]);
  });

  it("applyRules({ ids }) touches only those rows, and 'all' the rest", () => {
    const { db } = twoSyncs();
    saveRule(db, { matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") }, 1);
    expect(applyRules(db, { ids: [idOf(db, "קפה גרג")] })).toEqual({ changed: 1 });
    expect(listTransactions(db, { categoryIds: [null] })).toHaveLength(2);
    expect(applyRules(db, "all")).toEqual({ changed: 2 });
    expect(applyRules(db, "all")).toEqual({ changed: 0 });
  });

  it("rejects a malformed scope", () => {
    const db = newDb();
    for (const scope of [{ runId: 0 }, { runId: "1" }, { ids: [1.5] }, {}, null, "some"]) {
      expect(() => applyRules(db, scope as never), JSON.stringify(scope)).toThrow("BAD_REQUEST");
    }
  });
});

describe("user choices win", () => {
  it("an exclusion with no recorded source is treated as the user's", () => {
    const db = newDb();
    ingest(db, [bank([out("2026-03-01", -5000, "קפה הפינה")])], { now: NOW });
    const id = idOf(db, "קפה הפינה");
    db.prepare("UPDATE transactions SET excluded = 1, excluded_source = NULL WHERE id = ?").run(id);
    saveRule(db, { matchText: "קפה", setExcluded: false }, 1);
    applyRules(db, "all");
    expect(ruleFields(db, id)).toMatchObject({ excluded: 1, excluded_source: null, rule_id: null });
  });
});

describe("card bills", () => {
  const BILL = "חיוב לכרטיס ויזה 4321";
  function billedCycle(): Db {
    const db = newDb();
    ingest(db, [card("4321", [charge("2026-02-20", -20000, "סופר הדר", "2026-03-10")])], { now: NOW });
    ingest(db, [bank([out("2026-03-10", -20000, BILL)])], { now: NOW });
    return db;
  }

  it("a rule excluding a bank line freezes it for the matcher; deleting the rule hands it back", () => {
    const db = billedCycle();
    const bill = idOf(db, BILL);
    expect(row(db, bill).flow).toBe("internal");

    const rule = createRule(db, ruleInput({ matchText: "חיוב לכרטיס", setExcluded: true }));
    expect(row(db, bill)).toMatchObject({ flow: "excluded", excluded: true });
    expect(stored(db, bill)).toMatchObject({ excluded_source: "rule", rule_id: rule.id });

    deleteRule(db, rule.id);
    expect(row(db, bill)).toMatchObject({ flow: "internal", excluded: false });
    expect(stored(db, bill)).toMatchObject({ excluded_source: null, rule_id: null, internal: 1 });
  });

  it("internal card bills and gone rows take a category and still count nowhere", () => {
    const db = billedCycle();
    ingest(db, [card("4321", [txn({ date: "2026-03-25", amount: -12000, description: "מסעדה", status: "pending" })])], {
      now: NOW,
    });
    ingest(db, [card("4321", [charge("2026-03-20", -1000, "חניה", "2026-04-10")])], { now: NOW });
    const gone = idOf(db, "מסעדה");
    expect(row(db, gone).flow).toBe("gone");
    const before = monthSummary(db, "2026-03");

    createRule(db, ruleInput({ matchText: "חיוב לכרטיס", setCategoryId: categoryId(db, "Transfers") }));
    createRule(db, ruleInput({ matchText: "מסעדה", setCategoryId: categoryId(db, "Restaurants") }));

    expect(row(db, idOf(db, BILL))).toMatchObject({ flow: "internal", categoryId: categoryId(db, "Transfers") });
    expect(row(db, gone)).toMatchObject({ flow: "gone", flags: ["gone"], categoryId: categoryId(db, "Restaurants") });
    const after = monthSummary(db, "2026-03");
    expect(after.spending).toBe(before.spending);
    expect(after.byCategory).toEqual(before.byCategory);
  });
});

describe("flow, summaries and needs review after rules run", () => {
  // March. Card 4321 (credit, billed 04-10) and the bank.
  //   card 03-02  -12,000  שופרסל דיל רמת גן   rule: Groceries
  //   card 03-09   -8,500  שופרסל שלי חולון    rule: Groceries
  //   card 03-12   +2,000  שופרסל דיל רמת גן   rule: Groceries, so a refund
  //   card 03-15   -4,000  נטפליקס             no rule, stays uncategorized
  //   bank 03-01 +1,500,000 משכורת מרץ         rule: Salary
  //   bank 03-10  -50,000  העברה לחיסכון       rule: excluded
  //   bank 03-20  -12,345  ישראכרט 9999        rule: Transfers, still a possible card bill
  function ledger(): Db {
    const db = newDb();
    ingest(
      db,
      [
        card("4321", [
          charge("2026-03-02", -12000, "שופרסל דיל רמת גן", "2026-04-10"),
          charge("2026-03-09", -8500, "שופרסל שלי חולון", "2026-04-10"),
          charge("2026-03-12", 2000, "שופרסל דיל רמת גן", "2026-04-10"),
          charge("2026-03-15", -4000, "נטפליקס", "2026-04-10"),
        ]),
      ],
      { now: NOW },
    );
    ingest(
      db,
      [
        bank([
          out("2026-03-01", 1500000, "משכורת מרץ"),
          out("2026-03-10", -50000, "העברה לחיסכון"),
          out("2026-03-20", -12345, "ישראכרט 9999"),
        ]),
      ],
      { now: NOW },
    );
    return db;
  }

  it("matches the hand-computed totals before and after", () => {
    const db = ledger();
    expect(monthSummary(db, "2026-03")).toMatchObject({ income: 1502000, spending: 86845, needsReview: 7 });

    createRule(db, ruleInput({ matchMode: "starts_with", matchText: "שופרסל", setCategoryId: categoryId(db, "Groceries") }));
    createRule(db, ruleInput({ matchMode: "starts_with", matchText: "משכורת", setCategoryId: categoryId(db, "Salary") }));
    createRule(db, ruleInput({ matchText: "לחיסכון", setExcluded: true }));
    createRule(db, ruleInput({ matchText: "ישראכרט", setCategoryId: categoryId(db, "Transfers") }));

    const march = monthSummary(db, "2026-03");
    // 12,000 + 8,500 - 2,000 + 4,000 + 12,345; the transfer is excluded.
    expect(march).toMatchObject({ income: 1500000, spending: 34845, needsReview: 2 });
    expect(march.byCategory).toEqual([
      { categoryId: categoryId(db, "Groceries"), amount: 18500, count: 3 },
      { categoryId: categoryId(db, "Transfers"), amount: 12345, count: 1 },
      { categoryId: null, amount: 4000, count: 1 },
    ]);
    expect(listTransactions(db, { needsReview: true }).map((t) => [t.description, t.flags])).toEqual([
      ["ישראכרט 9999", ["possible_card_bill"]],
      ["נטפליקס", ["uncategorized"]],
    ]);
    expect(listTransactions(db, { flows: ["refund"] }).map((t) => t.amount)).toEqual([2000]);
    expect(listTransactions(db, { flows: ["excluded"] }).map((t) => t.description)).toEqual(["העברה לחיסכון"]);
  });
});

describe("trashed rows (spec 11)", () => {
  it("rules never touch a trashed row, and catch up when it is restored", () => {
    const db = newDb();
    ingest(db, [bank([out("2026-03-01", -5000, "שופרסל דיל"), out("2026-03-02", -6000, "שופרסל שלי")])], { now: NOW });
    const trashed = idOf(db, "שופרסל דיל");
    trashTransactions(db, [trashed], NOW);
    const before = stored(db, trashed);

    createRule(db, ruleInput({ matchText: "שופרסל", setCategoryId: categoryId(db, "Groceries"), setExcluded: true }));
    applyRules(db, "all");
    applyRules(db, { ids: [trashed] });
    expect(stored(db, trashed)).toEqual(before);
    expect(ruleFields(db, idOf(db, "שופרסל שלי"))).toMatchObject({ category_source: "rule", excluded: 1 });

    restoreTransactions(db, [trashed], NOW);
    expect(ruleFields(db, trashed)).toMatchObject({ category_source: "rule", excluded: 1, excluded_source: "rule" });
    expect(stored(db, trashed).trashed_at).toBeNull();
  });

  it("a rule set before trashing stays on the row while it is in Trash", () => {
    const db = newDb();
    ingest(db, [bank([out("2026-03-01", -5000, "שופרסל דיל")])], { now: NOW });
    const id = idOf(db, "שופרסל דיל");
    const rule = createRule(db, ruleInput({ matchText: "שופרסל", setCategoryId: categoryId(db, "Groceries") }));
    trashTransactions(db, [id], NOW);
    const before = stored(db, id);
    deleteRule(db, rule.id);
    expect(stored(db, id)).toEqual({ ...before, rule_id: null });
  });
});
