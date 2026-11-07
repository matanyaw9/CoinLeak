import { beforeEach, describe, expect, it } from "vitest";
import type { RuleInput } from "@shared/types";
import type { Db } from "../db";
import { ingest } from "../ledger/ingest";
import { updateTransactions } from "../ledger/queries";
import { NOW, accountId, bank, card, categoryId, charge, idOf, newDb, snapshot, stored, txn } from "../testing/ledger";
import { ruleFields, ruleInput } from "../testing/rules";
import { createRule, deleteRule, listRules, previewRule, reorderRules, updateRule } from "./queries";

const out = (date: string, amount: number, description: string) => txn({ date, amount, description });

function coffeeLedger(): Db {
  const db = newDb();
  ingest(
    db,
    [
      bank([
        out("2026-03-01", -1800, "קפה הפינה"),
        out("2026-03-02", -2400, "קפה גרג"),
        out("2026-03-03", -9000, "מסעדת הים"),
      ]),
    ],
    { now: NOW },
  );
  return db;
}

describe("the rules list", () => {
  it("creates rules last in order, applies them to all rows, and lists them in order", () => {
    const db = coffeeLedger();
    const coffeeCategory = categoryId(db, "Coffee & Cafes");
    const coffee = createRule(db, ruleInput({ name: "  Coffee  ", matchText: "קפה", setCategoryId: coffeeCategory }));
    const food = createRule(db, ruleInput({ matchText: "מסעדת", setCategoryId: categoryId(db, "Restaurants") }));
    expect(coffee).toMatchObject({ position: 1, name: "Coffee", enabled: true, setExcluded: null });
    expect(food.position).toBe(2);
    expect(listRules(db)).toEqual([coffee, food]);
    expect(ruleFields(db, idOf(db, "קפה גרג"))).toMatchObject({ category_source: "rule", rule_id: coffee.id });
    expect(ruleFields(db, idOf(db, "מסעדת הים"))).toMatchObject({ category_source: "rule", rule_id: food.id });
  });

  it("stores the text cleaned of extra whitespace, and a regex exactly as typed", () => {
    const db = coffeeLedger();
    const action = { setCategoryId: categoryId(db, "Coffee & Cafes") };
    expect(createRule(db, ruleInput({ matchText: "  קפה   הפינה ", ...action })).matchText).toBe("קפה הפינה");
    expect(createRule(db, ruleInput({ matchMode: "regex", matchText: "^קפה  ?\\S+$", ...action })).matchText).toBe(
      "^קפה  ?\\S+$",
    );
  });

  it("editing a rule recategorizes its rows", () => {
    const db = coffeeLedger();
    const rule = createRule(db, ruleInput({ matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") }));
    const edited = updateRule(db, rule.id, ruleInput({ matchText: "קפה", setCategoryId: categoryId(db, "Restaurants") }));
    expect(edited).toMatchObject({ id: rule.id, position: 1, setCategoryId: categoryId(db, "Restaurants") });
    for (const d of ["קפה הפינה", "קפה גרג"]) {
      expect(ruleFields(db, idOf(db, d)), d).toMatchObject({ category_id: categoryId(db, "Restaurants") });
    }

    // Narrowing the text lets go of the row it no longer matches.
    updateRule(db, rule.id, ruleInput({ matchText: "גרג", setCategoryId: categoryId(db, "Restaurants") }));
    expect(ruleFields(db, idOf(db, "קפה הפינה"))).toEqual({
      category_id: null,
      category_source: null,
      excluded: 0,
      excluded_source: null,
      rule_id: null,
    });
    expect(ruleFields(db, idOf(db, "קפה גרג"))).toMatchObject({ category_id: categoryId(db, "Restaurants") });

    // Disabling it lets go of everything.
    updateRule(db, rule.id, ruleInput({ matchText: "גרג", setCategoryId: categoryId(db, "Restaurants"), enabled: false }));
    expect(ruleFields(db, idOf(db, "קפה גרג"))).toMatchObject({ category_id: null, category_source: null });
  });

  it("deleting a rule clears what it set, or hands the row to the next matching rule", () => {
    const db = coffeeLedger();
    const coffee = categoryId(db, "Coffee & Cafes");
    const first = createRule(db, ruleInput({ matchText: "קפה", setCategoryId: coffee, setExcluded: true }));
    const second = createRule(db, ruleInput({ matchText: "גרג", setCategoryId: categoryId(db, "Restaurants") }));

    deleteRule(db, first.id);
    expect(ruleFields(db, idOf(db, "קפה הפינה"))).toEqual({
      category_id: null,
      category_source: null,
      excluded: 0,
      excluded_source: null,
      rule_id: null,
    });
    expect(ruleFields(db, idOf(db, "קפה גרג"))).toMatchObject({
      category_id: categoryId(db, "Restaurants"),
      excluded: 0,
      rule_id: second.id,
    });
    expect(listRules(db)).toEqual([{ ...second, position: 1 }]);
    expect(() => deleteRule(db, first.id)).toThrow("BAD_REQUEST");
  });

  it("reordering changes which rule wins and renumbers the list", () => {
    const db = coffeeLedger();
    const coffee = createRule(db, ruleInput({ matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") }));
    const greg = createRule(db, ruleInput({ matchText: "גרג", setCategoryId: categoryId(db, "Restaurants") }));
    expect(ruleFields(db, idOf(db, "קפה גרג"))).toMatchObject({ category_id: categoryId(db, "Coffee & Cafes") });

    reorderRules(db, [greg.id, coffee.id]);
    expect(listRules(db).map((r) => [r.id, r.position])).toEqual([
      [greg.id, 1],
      [coffee.id, 2],
    ]);
    expect(ruleFields(db, idOf(db, "קפה גרג"))).toMatchObject({ category_id: categoryId(db, "Restaurants") });
  });

  it("rejects an order that is not every rule exactly once", () => {
    const db = coffeeLedger();
    const a = createRule(db, ruleInput({ matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") }));
    const b = createRule(db, ruleInput({ matchText: "גרג", setCategoryId: categoryId(db, "Restaurants") }));
    const before = listRules(db);
    for (const ids of [[a.id], [a.id, a.id], [a.id, b.id, 999], [b.id, 999], [b.id, a.id, b.id]]) {
      expect(() => reorderRules(db, ids), JSON.stringify(ids)).toThrow("BAD_REQUEST");
    }
    expect(listRules(db)).toEqual(before);
  });
});

describe("user choices win", () => {
  let db: Db;
  // A: the user picked a category. B: the user excluded it. C: the user said
  // count it. D: the user cleared the category on purpose.
  beforeEach(() => {
    db = newDb();
    ingest(
      db,
      [
        bank([
          out("2026-03-01", -1000, "שופרסל A"),
          out("2026-03-02", -2000, "שופרסל B"),
          out("2026-03-03", -3000, "שופרסל C"),
          out("2026-03-04", -4000, "שופרסל D"),
        ]),
      ],
      { now: NOW },
    );
    updateTransactions(db, [idOf(db, "שופרסל A")], { categoryId: categoryId(db, "Restaurants") });
    updateTransactions(db, [idOf(db, "שופרסל B")], { excluded: true });
    updateTransactions(db, [idOf(db, "שופרסל C")], { excluded: false });
    updateTransactions(db, [idOf(db, "שופרסל D")], { categoryId: null });
  });

  const userFields = () => ({
    a: stored(db, idOf(db, "שופרסל A")).category_id,
    b: stored(db, idOf(db, "שופרסל B")).excluded,
    c: stored(db, idOf(db, "שופרסל C")).excluded,
    d: stored(db, idOf(db, "שופרסל D")).category_id,
  });

  it("rules never change a category or exclusion the user set, through create, edit, reorder and delete", () => {
    const expected = { a: categoryId(db, "Restaurants"), b: 1, c: 0, d: null };
    expect(userFields()).toEqual(expected);

    const groceries = categoryId(db, "Groceries");
    const both = createRule(db, ruleInput({ matchText: "שופרסל", setCategoryId: groceries, setExcluded: true }));
    expect(userFields()).toEqual(expected);
    // Fields the user did not set are the rule's: B's category, A's and D's exclusion.
    expect(ruleFields(db, idOf(db, "שופרסל B"))).toMatchObject({ category_id: groceries, category_source: "rule" });
    expect(ruleFields(db, idOf(db, "שופרסל A"))).toMatchObject({ excluded: 1, excluded_source: "rule" });

    const shopping = categoryId(db, "Shopping");
    const counted = createRule(db, ruleInput({ matchText: "שופרסל", setCategoryId: shopping, setExcluded: false }));
    reorderRules(db, [counted.id, both.id]);
    expect(userFields()).toEqual(expected);
    expect(ruleFields(db, idOf(db, "שופרסל A"))).toMatchObject({ excluded: 0, excluded_source: "rule" });

    updateRule(db, both.id, ruleInput({ matchText: "שופרסל", setCategoryId: categoryId(db, "Home"), setExcluded: true }));
    deleteRule(db, counted.id);
    expect(userFields()).toEqual(expected);
    deleteRule(db, both.id);
    expect(userFields()).toEqual(expected);
    expect(ruleFields(db, idOf(db, "שופרסל A"))).toMatchObject({
      excluded: 0,
      excluded_source: null,
      category_source: "user",
    });
  });

  it("updateTransactions records an exclusion either way as the user's", () => {
    expect(stored(db, idOf(db, "שופרסל B"))).toMatchObject({ excluded: 1, excluded_source: "user" });
    expect(stored(db, idOf(db, "שופרסל C"))).toMatchObject({ excluded: 0, excluded_source: "user" });
    expect(stored(db, idOf(db, "שופרסל A"))).toMatchObject({ excluded: 0, excluded_source: null });
  });
});

describe("rejected rules", () => {
  it("an invalid or oversized regex is rejected and nothing is saved", () => {
    const db = coffeeLedger();
    const coffee = categoryId(db, "Coffee & Cafes");
    const kept = createRule(db, ruleInput({ matchText: "קפה", setCategoryId: coffee }));
    const rows = snapshot(db);
    const rules = listRules(db);

    const regex = (matchText: string): RuleInput =>
      ruleInput({ name: "regex", matchMode: "regex", matchText, setCategoryId: categoryId(db, "Restaurants") });
    for (const bad of [regex("(קפה"), regex("[a-"), regex("a".repeat(201)), regex("   ")]) {
      expect(() => createRule(db, bad), bad.matchText).toThrow("BAD_REQUEST");
      expect(() => updateRule(db, kept.id, bad), bad.matchText).toThrow("BAD_REQUEST");
    }
    expect(snapshot(db)).toEqual(rows);
    expect(listRules(db)).toEqual(rules);

    // 200 characters is the limit, not over it.
    expect(createRule(db, regex(`^${"ק".repeat(199)}`)).matchText).toHaveLength(200);
  });

  it("rejects malformed rules, unknown references and rules with no action", () => {
    const db = coffeeLedger();
    const good = ruleInput({ matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") });
    const bad: [string, unknown][] = [
      ["not an object", null],
      ["no action", { ...good, setCategoryId: null }],
      ["blank name", { ...good, name: "   " }],
      ["long name", { ...good, name: "x".repeat(101) }],
      ["blank text", { ...good, matchText: " \t " }],
      ["long text", { ...good, matchText: "x".repeat(201) }],
      ["unknown mode", { ...good, matchMode: "like" }],
      ["unknown field", { ...good, matchField: "note" }],
      ["unknown category", { ...good, setCategoryId: 99999 }],
      ["unknown account", { ...good, accountId: 99999 }],
      ["negative amount", { ...good, amountMin: -1 }],
      ["float amount", { ...good, amountMax: 12.5 }],
      ["min above max", { ...good, amountMin: 500, amountMax: 400 }],
      ["unknown direction", { ...good, direction: "sideways" }],
      ["enabled not boolean", { ...good, enabled: 1 }],
      ["excluded not boolean", { ...good, setExcluded: "yes" }],
      ["missing field", { ...good, accountId: undefined }],
    ];
    for (const [label, input] of bad) expect(() => createRule(db, input), label).toThrow("BAD_REQUEST");
    expect(listRules(db)).toEqual([]);
    expect(() => updateRule(db, 999, good)).toThrow("BAD_REQUEST");
    expect(() => updateRule(db, 0, good)).toThrow("BAD_REQUEST");
    expect(listRules(db)).toEqual([]);
  });

  it("accepts every condition at once", () => {
    const db = coffeeLedger();
    const rule = createRule(
      db,
      ruleInput({
        matchField: "memo",
        matchMode: "equals",
        matchText: "הוראת קבע",
        accountId: accountId(db, "discount", "100-200300"),
        amountMin: 0,
        amountMax: 0,
        direction: "in",
        setExcluded: true,
      }),
    );
    expect(listRules(db)).toEqual([rule]);
  });
});

describe("previewRule", () => {
  it("counts every match and samples the newest 20, saving nothing", () => {
    const db = newDb();
    const coffees = Array.from({ length: 25 }, (_, i) =>
      charge(`2026-03-${String(i + 1).padStart(2, "0")}`, -(1000 + i), `קפה ${i}`, "2026-04-10"),
    );
    ingest(db, [card("4321", coffees)], { now: NOW });
    ingest(db, [bank([out("2026-03-10", -5000, "מסעדת הים")])], { now: NOW });
    const before = snapshot(db);

    const draft = ruleInput({ matchMode: "starts_with", matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") });
    const preview = previewRule(db, draft);
    expect(preview.matches).toBe(25);
    expect(preview.sample).toHaveLength(20);
    expect(preview.sample[0]).toMatchObject({ description: "קפה 24", date: "2026-03-25", flow: "spending" });
    expect(preview.sample.at(-1)?.description).toBe("קפה 5");
    expect(snapshot(db)).toEqual(before);
    expect(listRules(db)).toEqual([]);
  });

  it("shows rows whatever their owner, and needs only valid conditions", () => {
    const db = coffeeLedger();
    updateTransactions(db, [idOf(db, "קפה גרג")], { categoryId: categoryId(db, "Restaurants") });
    const draft = { ...ruleInput({ matchText: "קפה" }), name: "" };
    expect(previewRule(db, draft).matches).toBe(2);
    expect(previewRule(db, { ...draft, amountMax: 2000 }).sample.map((t) => t.description)).toEqual(["קפה הפינה"]);
    expect(() => previewRule(db, { ...draft, matchMode: "regex", matchText: "(" })).toThrow("BAD_REQUEST");
  });
});
