// Spec 13: starter lists are offered, never added on their own, skip
// categories the user renamed or removed, and become ordinary list rules.

import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import { ingest } from "../ledger/ingest";
import { NOW, bank, card, categoryId, charge, idOf, newDb, snapshot, txn } from "../testing/ledger";
import { lastRunId, ruleFields, textValues } from "../testing/rules";
import { applyRules } from "./engine";
import { knownPlaces } from "./places";
import { createRule, deleteRule, listRules, updateRule } from "./queries";
import { STARTER_LISTS } from "./starter-places";
import { addStarters, starterPreview } from "./starters";

function ledger(): Db {
  const db = newDb();
  ingest(
    db,
    [
      bank([
        txn({ date: "2026-03-01", amount: -12000, description: "שופרסל דיל רמת גן" }),
        txn({ date: "2026-03-02", amount: -8000, description: "RAMI LEVY HASHIKMA" }),
        txn({ date: "2026-03-03", amount: -1800, description: "ארומה תל אביב" }),
        txn({ date: "2026-03-04", amount: -4990, description: "NETFLIX.COM" }),
        txn({ date: "2026-03-05", amount: -5000, description: "חנות שכונתית" }),
      ]),
    ],
    { now: NOW },
  );
  return db;
}

const keys = (db: Db) => starterPreview(db).lists.map((l) => l.key);

describe("starter lists", () => {
  it("are data for every seeded category the spec names, without repeats", () => {
    expect(STARTER_LISTS.map((l) => l.key)).toEqual([
      "supermarkets",
      "cafes",
      "restaurants",
      "fuel",
      "parking",
      "publicTransport",
      "pharmacies",
      "telecom",
      "streaming",
    ]);
    for (const l of STARTER_LISTS)
      expect(new Set(l.names.map((n) => n.toLowerCase())).size, l.key).toBe(l.names.length);
  });

  it("are never added without the call: a fresh ledger, a sync and the preview create no rule", () => {
    const db = ledger();
    expect(listRules(db)).toEqual([]);
    const rows = snapshot(db);
    const preview = starterPreview(db);
    expect(listRules(db)).toEqual([]);
    expect(snapshot(db)).toEqual(rows);
    ingest(db, [card("4321", [charge("2026-03-06", -2000, "קופיקס", "2026-04-10")])], { now: NOW });
    applyRules(db, { runId: lastRunId(db) });
    expect(listRules(db)).toEqual([]);

    expect(preview.lists.map((l) => l.key)).toEqual(STARTER_LISTS.map((l) => l.key));
    const sorts = Object.fromEntries(preview.lists.map((l) => [l.key, l.sorts]));
    expect(sorts).toMatchObject({ supermarkets: 2, cafes: 1, streaming: 1, restaurants: 0 });
    expect(preview.sorts).toBe(4);
    expect(preview.lists.find((l) => l.key === "supermarkets")?.categoryId).toBe(categoryId(db, "Groceries"));
  });

  it("skip categories the user renamed or removed", () => {
    const db = ledger();
    db.prepare("UPDATE categories SET name = 'Cafes' WHERE name = 'Coffee & Cafes'").run();
    db.prepare("UPDATE categories SET archived = 1 WHERE name = 'Subscriptions'").run();
    db.prepare("DELETE FROM categories WHERE name = 'Health'").run();
    expect(keys(db)).toEqual(["supermarkets", "restaurants", "fuel", "parking", "publicTransport", "telecom"]);
    addStarters(db, { keys: ["cafes", "streaming", "pharmacies"] });
    expect(listRules(db)).toEqual([]);
  });

  it("are added only as chosen, as ordinary list rules that sort and can be edited or deleted", () => {
    const db = ledger();
    const added = addStarters(db, { keys: ["supermarkets", "cafes", "unknown"] });
    expect(added).toEqual({ rules: 2, changed: 3 });
    const rules = listRules(db);
    expect(rules.map((r) => [r.name, r.enabled, r.join, r.setCategoryId, r.setExcluded])).toEqual([
      ["Groceries", true, "all", categoryId(db, "Groceries"), null],
      ["Coffee & Cafes", true, "all", categoryId(db, "Coffee & Cafes"), null],
    ]);
    expect(ruleFields(db, idOf(db, "RAMI LEVY HASHIKMA"))).toMatchObject({
      category_id: categoryId(db, "Groceries"),
      category_source: "rule",
    });
    expect(ruleFields(db, idOf(db, "חנות שכונתית"))).toMatchObject({ category_id: null });
    expect(knownPlaces(db).map((p) => p.names.length)).toEqual(
      [STARTER_LISTS[0], STARTER_LISTS[1]].map((l) => l?.names.length),
    );

    // Ordinary rules: editing and deleting work like any other.
    const [groceries, cafes] = rules;
    if (!groceries || !cafes) throw new Error("expected two rules");
    updateRule(db, groceries.id, {
      ...groceries,
      conditions: [{ kind: "text", field: "description", mode: "contains", values: ["שופרסל"] }],
    });
    expect(ruleFields(db, idOf(db, "RAMI LEVY HASHIKMA"))).toMatchObject({ category_id: null, category_source: null });
    deleteRule(db, cafes.id);
    expect(ruleFields(db, idOf(db, "ארומה תל אביב"))).toMatchObject({ category_id: null });
    // What is no longer on any list is offered again.
    expect(keys(db)).toContain("cafes");
  });

  it("offer only names no list has yet, and add them to the category's list rule", () => {
    const db = ledger();
    const mine = createRule(db, {
      name: "My cafes",
      enabled: true,
      join: "all",
      conditions: [{ kind: "text", field: "description", mode: "contains", values: ["Aroma", "My corner cafe"] }],
      setCategoryId: categoryId(db, "Coffee & Cafes"),
      setExcluded: null,
    });
    const cafes = starterPreview(db).lists.find((l) => l.key === "cafes");
    expect(cafes?.names).not.toContain("Aroma");
    expect(cafes?.names).toContain("ארומה");
    expect(cafes?.sorts).toBe(1);

    addStarters(db, { keys: ["cafes"] });
    const rules = listRules(db);
    expect(rules).toHaveLength(1);
    expect(textValues(rules[0] ?? mine).slice(0, 3)).toEqual(["Aroma", "My corner cafe", "ארומה"]);
    expect(keys(db)).not.toContain("cafes");
  });

  it("sort fuel into Fuel and parking into Parking (spec 18)", () => {
    const db = ledger();
    const preview = starterPreview(db).lists;
    expect(preview.find((l) => l.key === "fuel")?.categoryId).toBe(categoryId(db, "Fuel"));
    expect(preview.find((l) => l.key === "parking")?.categoryId).toBe(categoryId(db, "Parking"));
    expect(addStarters(db, { keys: ["fuel", "parking"] }).rules).toBe(2);
    expect(listRules(db).map((r) => r.setCategoryId)).toEqual([categoryId(db, "Fuel"), categoryId(db, "Parking")]);
    // Parking apps belong to the parking list only.
    const transit = STARTER_LISTS.find((l) => l.key === "publicTransport")?.names ?? [];
    expect(transit).not.toContain("Pango");
    expect(transit).not.toContain("Cellopark");
  });

  it("reject malformed keys", () => {
    const db = ledger();
    expect(() => addStarters(db, { keys: "cafes" })).toThrow("BAD_REQUEST");
    expect(() => addStarters(db, { keys: [1] })).toThrow("BAD_REQUEST");
    expect(listRules(db)).toEqual([]);
  });
});
