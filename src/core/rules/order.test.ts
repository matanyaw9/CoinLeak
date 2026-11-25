// spec 21: per rule, the rows a higher rule decides, counted per action
// (category vs exclude), before and after a reorder, and in the preview.

import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import { ingest } from "../ledger/ingest";
import { updateTransactions } from "../ledger/queries";
import { NOW, bank, categoryId, idOf, newDb, txn } from "../testing/ledger";
import { ruleInput } from "../testing/rules";
import { createRule, listRules, previewRule, reorderRules, updateRule } from "./queries";
import { addExceptions } from "./store";

function ledger(): Db {
  const db = newDb();
  const out = (date: string, amount: number, description: string) => txn({ date, amount, description });
  ingest(
    db,
    [
      bank([
        out("2026-03-01", -1800, "קפה הפינה"),
        out("2026-03-02", -2400, "קפה הפינה תל אביב"),
        out("2026-03-03", -9000, "מסעדת הים"),
        out("2026-03-04", -5000, "SUPER PHARM"),
      ]),
    ],
    { now: NOW },
  );
  return db;
}

const overlapsOf = (db: Db, name: string) => listRules(db).find((r) => r.name === name)?.overlaps;

describe("rules decided by a higher rule", () => {
  it("counts category rows a higher category rule wins, and names that rule", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const food = categoryId(db, "Restaurants");
    const broad = createRule(db, ruleInput({ matchText: "קפה", setCategoryId: cafes }), NOW);
    createRule(db, ruleInput({ matchText: "קפה הפינה", setCategoryId: food }), NOW);
    createRule(db, ruleInput({ matchText: "SUPER", setCategoryId: food }), NOW);

    expect(overlapsOf(db, "קפה")).toBeUndefined();
    expect(overlapsOf(db, "קפה הפינה")).toEqual([{ action: "category", count: 2, winnerId: broad.id }]);
    // No overlap with anything above.
    expect(overlapsOf(db, "SUPER")).toBeUndefined();
  });

  it("after a reorder the counts move to the rule now below", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const food = categoryId(db, "Restaurants");
    const broad = createRule(db, ruleInput({ matchText: "קפה", setCategoryId: cafes }), NOW);
    const narrow = createRule(db, ruleInput({ matchText: "קפה הפינה", setCategoryId: food }), NOW);
    reorderRules(db, [narrow.id, broad.id], NOW);

    expect(overlapsOf(db, "קפה הפינה")).toBeUndefined();
    expect(overlapsOf(db, "קפה")).toEqual([{ action: "category", count: 2, winnerId: narrow.id }]);
  });

  it("keeps category and exclude apart: an exclude rule never hides a category rule", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const hide = createRule(db, ruleInput({ matchText: "קפה", setExcluded: true }), NOW);
    createRule(db, ruleInput({ matchText: "קפה הפינה", setCategoryId: cafes }), NOW);
    createRule(db, ruleInput({ matchText: "תל אביב", setExcluded: false }), NOW);

    expect(overlapsOf(db, "קפה הפינה")).toBeUndefined();
    expect(overlapsOf(db, "תל אביב")).toEqual([{ action: "exclude", count: 1, winnerId: hide.id }]);
  });

  it("a rule with both actions reports each one, and several winners give no single name", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const food = categoryId(db, "Restaurants");
    createRule(db, ruleInput({ matchText: "הפינה", setCategoryId: cafes }), NOW);
    const hideSea = createRule(db, ruleInput({ matchText: "הים", setExcluded: true }), NOW);
    createRule(db, ruleInput({ matchText: "מסעדת", setCategoryId: food }), NOW);
    const both = { ...ruleInput({ matchText: "ה", setCategoryId: food, setExcluded: true }), name: "both" };
    createRule(db, both, NOW);

    expect(overlapsOf(db, "both")).toEqual([
      // Two rows by "הפינה", one by "מסעדת".
      { action: "category", count: 3, winnerId: null },
      { action: "exclude", count: 1, winnerId: hideSea.id },
    ]);
  });

  it("skips disabled rules and rows the user set by hand", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const food = categoryId(db, "Restaurants");
    const broad = createRule(db, ruleInput({ matchText: "קפה", setCategoryId: cafes }), NOW);
    createRule(db, ruleInput({ matchText: "קפה הפינה", setCategoryId: food }), NOW);
    updateTransactions(db, [idOf(db, "קפה הפינה")], { categoryId: food });

    expect(overlapsOf(db, "קפה הפינה")).toEqual([{ action: "category", count: 1, winnerId: broad.id }]);
    updateRule(db, broad.id, { ...ruleInput({ matchText: "קפה", setCategoryId: cafes }), enabled: false }, NOW);
    expect(overlapsOf(db, "קפה הפינה")).toBeUndefined();
  });
});

describe("the editor preview", () => {
  it("counts matching rows a higher rule decides: all rules for a new rule, only those above for a saved one", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const food = categoryId(db, "Restaurants");
    createRule(db, ruleInput({ matchText: "קפה", setCategoryId: cafes }), NOW);
    const narrow = createRule(db, ruleInput({ matchText: "קפה הפינה", setCategoryId: food }), NOW);
    const draft = ruleInput({ matchText: "הפינה", setCategoryId: food });

    expect(previewRule(db, draft).decidedHigher).toBe(2);
    expect(previewRule(db, { ...draft, ruleId: narrow.id }).decidedHigher).toBe(2);
    reorderRules(db, [narrow.id, ...listRules(db).filter((r) => r.id !== narrow.id).map((r) => r.id)], NOW);
    expect(previewRule(db, { ...draft, ruleId: narrow.id }).decidedHigher).toBe(0);
    // An exclude draft is not decided by category rules.
    expect(previewRule(db, ruleInput({ matchText: "הפינה", setExcluded: true })).decidedHigher).toBe(0);
  });

  it("refuses a ruleId that is not an id", () => {
    const db = ledger();
    expect(() => previewRule(db, { ...ruleInput({ matchText: "x" }), ruleId: "1" })).toThrow("BAD_REQUEST");
  });
});

describe("exceptions (spec 35)", () => {
  it("a rule's exceptions count as neither its wins nor its overlaps, in the list and the preview", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const food = categoryId(db, "Restaurants");
    const broad = createRule(db, ruleInput({ matchText: "קפה", setCategoryId: cafes }), NOW);
    const narrow = createRule(db, ruleInput({ matchText: "קפה הפינה", setCategoryId: food }), NOW);
    const corner = idOf(db, "קפה הפינה");
    const telAviv = idOf(db, "קפה הפינה תל אביב");
    expect(overlapsOf(db, "קפה הפינה")).toEqual([{ action: "category", count: 2, winnerId: broad.id }]);

    // The higher rule skips one row, so the lower rule decides it.
    addExceptions(db, broad.id, [corner]);
    expect(overlapsOf(db, "קפה הפינה")).toEqual([{ action: "category", count: 1, winnerId: broad.id }]);
    const draft = { ...ruleInput({ matchText: "קפה הפינה", setCategoryId: food }), ruleId: narrow.id };
    expect(previewRule(db, draft).decidedHigher).toBe(1);

    // The lower rule skips the other row, so it no longer fits it either,
    // in the list and in its own editor.
    addExceptions(db, narrow.id, [telAviv]);
    expect(overlapsOf(db, "קפה הפינה")).toBeUndefined();
    expect(previewRule(db, draft).decidedHigher).toBe(0);
  });
});
