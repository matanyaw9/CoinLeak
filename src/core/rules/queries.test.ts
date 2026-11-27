import { beforeEach, describe, expect, it } from "vitest";
import type { RuleInput } from "@shared/types";
import type { Db } from "../db";
import { ingest } from "../ledger/ingest";
import { updateTransactions } from "../ledger/queries";
import { NOW, accountId, bank, card, categoryId, charge, idOf, newDb, snapshot, stored, txn } from "../testing/ledger";
import { ruleFields, ruleInput, textValues } from "../testing/rules";
import { createRule, deleteRule, listRules, previewRule, reorderRules, saveRule, updateRule } from "./queries";

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
    expect(textValues(createRule(db, ruleInput({ matchText: "  קפה   הפינה ", ...action })))).toEqual(["קפה הפינה"]);
    expect(textValues(createRule(db, ruleInput({ matchMode: "regex", matchText: "^קפה  ?\\S+$", ...action })))).toEqual(
      ["^קפה  ?\\S+$"],
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
      expect(() => createRule(db, bad), textValues(bad)[0]).toThrow("BAD_REQUEST");
      expect(() => updateRule(db, kept.id, bad), textValues(bad)[0]).toThrow("BAD_REQUEST");
    }
    expect(snapshot(db)).toEqual(rows);
    expect(listRules(db)).toEqual(rules);

    // 200 characters is the limit, not over it.
    expect(textValues(createRule(db, regex(`^${"ק".repeat(199)}`)))[0]).toHaveLength(200);
  });

  it("rejects malformed rules, unknown references and rules with no action", () => {
    const db = coffeeLedger();
    const good = ruleInput({ matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") });
    const with1 = (condition: unknown) => ({ ...good, conditions: [good.conditions[0], condition] });
    const many = (n: number) => Array.from({ length: n }, (_, i) => `name ${i}`);
    const bad: [string, unknown][] = [
      ["not an object", null],
      ["no action", { ...good, setCategoryId: null }],
      ["blank name", { ...good, name: "   " }],
      ["long name", { ...good, name: "x".repeat(101) }],
      ["blank text", with1({ kind: "text", field: "description", mode: "contains", values: [" \t "] })],
      ["long text", with1({ kind: "text", field: "description", mode: "contains", values: ["x".repeat(201)] })],
      ["no values", with1({ kind: "text", field: "description", mode: "contains", values: [] })],
      ["too many values", with1({ kind: "text", field: "description", mode: "contains", values: many(201) })],
      ["value not text", with1({ kind: "text", field: "description", mode: "contains", values: [5] })],
      ["unknown mode", with1({ kind: "text", field: "description", mode: "like", values: ["x"] })],
      ["unknown field", with1({ kind: "text", field: "note", mode: "contains", values: ["x"] })],
      ["unknown kind", with1({ kind: "note", values: ["x"] })],
      ["unknown category", { ...good, setCategoryId: 99999 }],
      ["unknown account", with1({ kind: "account", accountId: 99999 })],
      ["negative amount", with1({ kind: "amount", min: -1, max: null })],
      ["float amount", with1({ kind: "amount", min: null, max: 12.5 })],
      ["empty amount", with1({ kind: "amount", min: null, max: null })],
      ["min above max", with1({ kind: "amount", min: 500, max: 400 })],
      ["unknown direction", with1({ kind: "direction", direction: "sideways" })],
      ["unknown join", { ...good, join: "some" }],
      ["no conditions", { ...good, conditions: [] }],
      ["too many conditions", { ...good, conditions: Array.from({ length: 21 }, () => good.conditions[0]) }],
      ["conditions not a list", { ...good, conditions: "קפה" }],
      ["enabled not boolean", { ...good, enabled: 1 }],
      ["excluded not boolean", { ...good, setExcluded: "yes" }],
      ["missing field", { ...good, setExcluded: undefined }],
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
  it("counts every match and lists the newest 25, saving nothing", () => {
    const db = newDb();
    const coffees = Array.from({ length: 25 }, (_, i) =>
      charge(`2026-03-${String(i + 1).padStart(2, "0")}`, -(1000 + i), `קפה ${i}`, "2026-04-10"),
    );
    ingest(db, [card("4321", coffees)], { now: NOW });
    ingest(db, [bank([out("2026-03-10", -5000, "מסעדת הים")])], { now: NOW });
    const before = snapshot(db);

    const draft = ruleInput({ matchMode: "starts_with", matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") });
    const preview = previewRule(db, draft);
    expect(preview).toMatchObject({ matches: 25, more: 0, exceptions: [] });
    expect(preview.sample).toHaveLength(25);
    expect(preview.sample[0]).toMatchObject({ description: "קפה 24", date: "2026-03-25", flow: "spending" });
    expect(preview.sample.at(-1)?.description).toBe("קפה 0");
    expect(snapshot(db)).toEqual(before);
    expect(listRules(db)).toEqual([]);
  });

  it("lists at most 500 rows, newest first, and says how many more match (spec 35)", () => {
    const db = newDb();
    const day = (i: number) => new Date(Date.UTC(2024, 10, 1 + i)).toISOString().slice(0, 10);
    ingest(db, [bank(Array.from({ length: 503 }, (_, i) => out(day(i), -(1000 + i), `קפה ${i}`)))], { now: NOW });

    const preview = previewRule(db, ruleInput({ matchText: "קפה" }));
    expect(preview).toMatchObject({ matches: 503, more: 3 });
    expect(preview.sample).toHaveLength(500);
    expect(preview.sample[0]?.description).toBe("קפה 502");
    expect(preview.sample.at(-1)?.description).toBe("קפה 3");
  });

  it("shows rows whatever their owner, and needs only valid conditions", () => {
    const db = coffeeLedger();
    updateTransactions(db, [idOf(db, "קפה גרג")], { categoryId: categoryId(db, "Restaurants") });
    const draft = { ...ruleInput({ matchText: "קפה" }), name: "" };
    expect(previewRule(db, draft).matches).toBe(2);
    const cheap = { ...ruleInput({ matchText: "קפה", amountMax: 2000 }), name: "" };
    expect(previewRule(db, cheap).sample.map((t) => t.description)).toEqual(["קפה הפינה"]);
    expect(() => previewRule(db, ruleInput({ matchMode: "regex", matchText: "(" }))).toThrow("BAD_REQUEST");
    // A pattern that could hang the app is refused when typed or saved (review 2026-11-27).
    expect(() => previewRule(db, ruleInput({ matchMode: "regex", matchText: "(\\d+)+$" }))).toThrow("BAD_REQUEST");
    expect(() => saveRule(db, { rule: ruleInput({ matchMode: "regex", matchText: "(\\d+)+$" }), id: null })).toThrow("BAD_REQUEST");
  });
});
