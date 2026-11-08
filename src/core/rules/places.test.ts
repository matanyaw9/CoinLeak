// Spec 13, F29: known places are the names in a category's list rules.

import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import { ingest } from "../ledger/ingest";
import { updateTransactions } from "../ledger/queries";
import { NOW, bank, categoryId, idOf, newDb, snapshot, txn } from "../testing/ledger";
import { multiRule, ruleFields, ruleInput, textValues } from "../testing/rules";
import { addKnownPlace, knownPlaces } from "./places";
import { createRule, listRules } from "./queries";

function ledger(): Db {
  const db = newDb();
  ingest(
    db,
    [
      bank([
        txn({ date: "2026-03-01", amount: -1800, description: "ארומה תל אביב" }),
        txn({ date: "2026-03-02", amount: -2100, description: "Landwer TLV" }),
        txn({ date: "2026-03-03", amount: -9000, description: "שופרסל דיל" }),
      ]),
    ],
    { now: NOW },
  );
  return db;
}

const list = (db: Db, category: string, values: string[], name = category) =>
  multiRule("all", [{ kind: "text", field: "description", mode: "contains", values }], categoryId(db, category), name);

describe("knownPlaces", () => {
  it("lists the names of each category's list rules, in rule order, without repeats", () => {
    const db = ledger();
    const cafes = createRule(db, list(db, "Coffee & Cafes", ["ארומה", "Aroma"]));
    const more = createRule(db, list(db, "Coffee & Cafes", ["aroma", "קופיקס"], "More cafes"));
    const groceries = createRule(db, {
      ...list(db, "Groceries", ["שופרסל"]),
      conditions: [{ kind: "text", field: "description", mode: "starts_with", values: ["שופרסל"] }],
    });
    expect(knownPlaces(db)).toEqual(
      [
        { categoryId: categoryId(db, "Groceries"), names: ["שופרסל"], ruleIds: [groceries.id] },
        {
          categoryId: categoryId(db, "Coffee & Cafes"),
          names: ["ארומה", "Aroma", "קופיקס"],
          ruleIds: [cafes.id, more.id],
        },
      ].sort((a, b) => a.categoryId - b.categoryId),
    );
  });

  it("leaves out rules that are not lists: off, patterns, memo, more conditions, or exclusion", () => {
    const db = ledger();
    const coffee = categoryId(db, "Coffee & Cafes");
    createRule(db, { ...list(db, "Coffee & Cafes", ["a"]), enabled: false });
    createRule(db, ruleInput({ matchMode: "regex", matchText: "aroma|cofix", setCategoryId: coffee }));
    createRule(db, ruleInput({ matchField: "memo", matchText: "קפה", setCategoryId: coffee }));
    createRule(db, ruleInput({ matchText: "קפה", amountMax: 3000, setCategoryId: coffee }));
    createRule(db, ruleInput({ matchText: "קפה", setCategoryId: coffee, setExcluded: false }));
    createRule(db, ruleInput({ matchText: "העברה", setExcluded: true }));
    expect(knownPlaces(db)).toEqual([]);
  });
});

describe("addKnownPlace", () => {
  it("makes a list rule named after the category when there is none, and sorts its rows", () => {
    const db = ledger();
    const coffee = categoryId(db, "Coffee & Cafes");
    const added = addKnownPlace(db, { categoryId: coffee, name: "  ארומה   תל אביב " });
    expect(added).toMatchObject({ created: true, added: true, changed: 1 });
    const [rule] = listRules(db);
    expect(rule).toMatchObject({
      id: added.ruleId,
      name: "Coffee & Cafes",
      enabled: true,
      join: "all",
      setCategoryId: coffee,
      setExcluded: null,
    });
    expect(rule && textValues(rule)).toEqual(["ארומה תל אביב"]);
    expect(ruleFields(db, idOf(db, "ארומה תל אביב"))).toMatchObject({ category_id: coffee, category_source: "rule" });
    expect(knownPlaces(db)).toEqual([{ categoryId: coffee, names: ["ארומה תל אביב"], ruleIds: [added.ruleId] }]);
  });

  it("appends to the category's first list rule, and a name already there changes nothing", () => {
    const db = ledger();
    const coffee = categoryId(db, "Coffee & Cafes");
    const cafes = createRule(db, list(db, "Coffee & Cafes", ["ארומה"]));
    createRule(db, list(db, "Coffee & Cafes", ["קופיקס"], "Second"));

    expect(addKnownPlace(db, { categoryId: coffee, name: "Landwer" })).toEqual({
      ruleId: cafes.id,
      created: false,
      added: true,
      changed: 1,
    });
    expect(listRules(db).map(textValues)).toEqual([["ארומה", "Landwer"], ["קופיקס"]]);

    const rows = snapshot(db);
    expect(addKnownPlace(db, { categoryId: coffee, name: "LANDWER" })).toMatchObject({ added: false, changed: 0 });
    expect(addKnownPlace(db, { categoryId: coffee, name: "קופיקס" })).toMatchObject({ ruleId: cafes.id, added: false });
    expect(listRules(db).map(textValues)).toEqual([["ארומה", "Landwer"], ["קופיקס"]]);
    expect(snapshot(db)).toEqual(rows);
  });

  it("leaves rows the user sorted by hand alone", () => {
    const db = ledger();
    const id = idOf(db, "Landwer TLV");
    updateTransactions(db, [id], { categoryId: categoryId(db, "Restaurants") });
    addKnownPlace(db, { categoryId: categoryId(db, "Coffee & Cafes"), name: "Landwer" });
    expect(ruleFields(db, id)).toMatchObject({ category_id: categoryId(db, "Restaurants"), category_source: "user" });
  });

  it("rejects an unknown category or a blank or long name", () => {
    const db = ledger();
    const coffee = categoryId(db, "Coffee & Cafes");
    expect(() => addKnownPlace(db, { categoryId: 99999, name: "x" })).toThrow("BAD_REQUEST");
    expect(() => addKnownPlace(db, { categoryId: coffee, name: "  " })).toThrow("BAD_REQUEST");
    expect(() => addKnownPlace(db, { categoryId: coffee, name: "x".repeat(201) })).toThrow("BAD_REQUEST");
    expect(() => addKnownPlace(db, { categoryId: coffee, name: 5 })).toThrow("BAD_REQUEST");
    expect(listRules(db)).toEqual([]);
  });
});
