// spec 21: per rule, the rows a higher rule decides, counted per action
// (category vs exclude), before and after a reorder, and in the preview.

import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import { ingest } from "../ledger/ingest";
import { updateTransactions } from "../ledger/edits";
import { NOW, bank, categoryId, idOf, newDb, txn } from "../testing/ledger";
import { ruleFields, ruleInput } from "../testing/rules";
import { addKnownPlace } from "./places";
import { createRule, listRules, previewRule, reorderRules, saveRule, updateRule } from "./queries";
import { addStarters } from "./starters";
import { addExceptions, loadRules } from "./store";
import { createCategory } from "../ledger/categories";

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
    expect(overlapsOf(db, "קפה הפינה")).toEqual([{ action: "category", count: 2, winnerId: broad.id, winnerNames: ["קפה"] }]);
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
    expect(overlapsOf(db, "קפה")).toEqual([{ action: "category", count: 2, winnerId: narrow.id, winnerNames: ["קפה הפינה"] }]);
  });

  it("keeps category and exclude apart: an exclude rule never hides a category rule", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const hide = createRule(db, ruleInput({ matchText: "קפה", setExcluded: true }), NOW);
    createRule(db, ruleInput({ matchText: "קפה הפינה", setCategoryId: cafes }), NOW);
    createRule(db, ruleInput({ matchText: "תל אביב", setExcluded: false }), NOW);

    expect(overlapsOf(db, "קפה הפינה")).toBeUndefined();
    expect(overlapsOf(db, "תל אביב")).toEqual([{ action: "exclude", count: 1, winnerId: hide.id, winnerNames: ["קפה"] }]);
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
      { action: "category", count: 3, winnerId: null, winnerNames: ["הפינה", "מסעדת"] },
      { action: "exclude", count: 1, winnerId: hideSea.id, winnerNames: ["הים"] },
    ]);
  });

  it("skips disabled rules and rows the user set by hand", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const food = categoryId(db, "Restaurants");
    const broad = createRule(db, ruleInput({ matchText: "קפה", setCategoryId: cafes }), NOW);
    createRule(db, ruleInput({ matchText: "קפה הפינה", setCategoryId: food }), NOW);
    updateTransactions(db, [idOf(db, "קפה הפינה")], { categoryId: food });

    expect(overlapsOf(db, "קפה הפינה")).toEqual([{ action: "category", count: 1, winnerId: broad.id, winnerNames: ["קפה"] }]);
    updateRule(db, broad.id, { ...ruleInput({ matchText: "קפה", setCategoryId: cafes }), enabled: false }, NOW);
    expect(overlapsOf(db, "קפה הפינה")).toBeUndefined();
  });
});

describe("the editor preview", () => {
  it("counts matching rows a higher rule decides: none for a new rule, only those above for a saved one", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const food = categoryId(db, "Restaurants");
    createRule(db, ruleInput({ matchText: "קפה", setCategoryId: cafes }), NOW);
    const narrow = createRule(db, ruleInput({ matchText: "קפה הפינה", setCategoryId: food }), NOW);
    const draft = ruleInput({ matchText: "הפינה", setCategoryId: food });

    // spec 41: a new rule goes on top, so nothing is higher.
    expect(previewRule(db, draft).decidedHigher).toBe(0);
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
    expect(overlapsOf(db, "קפה הפינה")).toEqual([{ action: "category", count: 2, winnerId: broad.id, winnerNames: ["קפה"] }]);

    // The higher rule skips one row, so the lower rule decides it.
    addExceptions(db, broad.id, [corner]);
    expect(overlapsOf(db, "קפה הפינה")).toEqual([{ action: "category", count: 1, winnerId: broad.id, winnerNames: ["קפה"] }]);
    const draft = { ...ruleInput({ matchText: "קפה הפינה", setCategoryId: food }), ruleId: narrow.id };
    expect(previewRule(db, draft).decidedHigher).toBe(1);

    // The lower rule skips the other row, so it no longer fits it either,
    // in the list and in its own editor.
    addExceptions(db, narrow.id, [telAviv]);
    expect(overlapsOf(db, "קפה הפינה")).toBeUndefined();
    expect(previewRule(db, draft).decidedHigher).toBe(0);
  });
});

describe("rows the editor shows without a tick box (wave 14 review)", () => {
  it("names the listed rows the rule would not change: sorted by hand into its category or below, or decided higher", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const food = categoryId(db, "Restaurants");
    const fish = createCategory(db, { name: "Fish", kind: "expense", parentId: food, emoji: null, color: null });
    if (!fish.ok) throw new Error(fish.problem);
    createRule(db, ruleInput({ matchText: "קפה הפינה", setCategoryId: cafes }), NOW);
    const sea = idOf(db, "מסעדת הים");
    const pharm = idOf(db, "SUPER PHARM");
    updateTransactions(db, [sea], { categoryId: fish.category.id }); // By hand, inside Restaurants.
    updateTransactions(db, [pharm], { categoryId: cafes }); // By hand, elsewhere: F45 moves it when ticked.
    const anyOf = { kind: "text", field: "description", mode: "contains", values: ["קפה", "מסעדת", "SUPER"] } as const;
    const draft = { ...ruleInput({ matchText: "x", setCategoryId: food }), conditions: [anyOf] };

    // Saved last, so the cafes rule is higher.
    const saved = createRule(db, draft, NOW);
    const corners = [idOf(db, "קפה הפינה"), idOf(db, "קפה הפינה תל אביב")];
    const preview = previewRule(db, { ...draft, ruleId: saved.id });
    expect(preview.alreadyHere).toEqual([sea]);
    expect([...preview.higherRule].sort()).toEqual([...corners].sort());
    expect(preview.decidedHigher).toBe(2);

    // A rule that also hides rows would change all of them, so every row keeps its box.
    const hiding = previewRule(db, { ...draft, setExcluded: true, ruleId: saved.id });
    expect([hiding.alreadyHere, hiding.higherRule]).toEqual([[], []]);

    // The rule's own exceptions keep their box, so they can be ticked back.
    addExceptions(db, saved.id, [sea, ...corners]);
    const own = previewRule(db, { ...draft, ruleId: saved.id });
    expect([own.alreadyHere, own.higherRule, own.decidedHigher]).toEqual([[], [], 0]);
  });
});

describe("newer rules win (spec 41)", () => {
  const order = (db: Db) => loadRules(db).map((r) => [r.name, r.position]);
  const categoryOf = (db: Db, description: string) => ruleFields(db, idOf(db, description)).category_id;

  it("a saved rule lands on top, the rest move down by one, and it wins rows an older rule also fits", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const food = categoryId(db, "Restaurants");
    saveRule(db, { id: null, rule: ruleInput({ matchText: "קפה", setCategoryId: cafes }) }, NOW);
    saveRule(db, { id: null, rule: ruleInput({ matchText: "SUPER", setCategoryId: food }) }, NOW);
    expect(categoryOf(db, "קפה הפינה")).toBe(cafes);

    const saved = saveRule(db, { id: null, rule: ruleInput({ matchText: "הפינה", setCategoryId: food }) }, NOW);
    expect(saved.rule.position).toBe(1);
    expect(order(db)).toEqual([
      ["הפינה", 1],
      ["SUPER", 2],
      ["קפה", 3],
    ]);
    expect(categoryOf(db, "קפה הפינה")).toBe(food);

    // Saving it again keeps its place.
    saveRule(db, { id: saved.rule.id, rule: ruleInput({ matchText: "הפינה", setCategoryId: cafes }) }, NOW);
    expect(order(db)[0]).toEqual(["הפינה", 1]);
  });

  it("a known place's new rule lands on top; a starter list's rule lands last", () => {
    const db = ledger();
    createRule(db, ruleInput({ matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") }), NOW);
    addKnownPlace(db, { categoryId: categoryId(db, "Restaurants"), name: "הפינה" }, NOW);
    expect(order(db)).toEqual([
      ["Restaurants", 1],
      ["קפה", 2],
    ]);
    expect(categoryOf(db, "קפה הפינה")).toBe(categoryId(db, "Restaurants"));

    expect(addStarters(db, { keys: ["pharmacies"] }, NOW).rules).toBe(1);
    expect(order(db).map(([, position]) => position)).toEqual([1, 2, 3]);
    expect(order(db).slice(0, 2).map(([name]) => name)).toEqual(["Restaurants", "קפה"]);
  });

  it("the preview of a new rule ticks every row except those already here or set by hand", () => {
    const db = ledger();
    const food = categoryId(db, "Restaurants");
    createRule(db, ruleInput({ matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") }), NOW);
    const sea = idOf(db, "מסעדת הים");
    updateTransactions(db, [sea], { categoryId: food });
    const anyOf = { kind: "text", field: "description", mode: "contains", values: ["קפה", "מסעדת", "SUPER"] } as const;
    const draft = { ...ruleInput({ matchText: "x", setCategoryId: food }), conditions: [anyOf] };

    const preview = previewRule(db, draft);
    // The rows an older rule sorts keep their box.
    expect([preview.alreadyHere, preview.higherRule, preview.setByYou]).toEqual([[sea], [], []]);
    expect(preview.decidedHigher).toBe(0);
    expect(preview.sample).toHaveLength(4);

    const pharm = idOf(db, "SUPER PHARM");
    updateTransactions(db, [pharm], { excluded: true });
    const ignoring = previewRule(db, { ...draft, setCategoryId: null, setExcluded: true });
    expect([ignoring.setByYou, ignoring.alreadyHere, ignoring.higherRule]).toEqual([[pharm], [], []]);
  });

  it("says Set by you for a row ignored or counted by hand, under an ignore or an always count rule", () => {
    const db = ledger();
    const sea = idOf(db, "מסעדת הים");
    const pharm = idOf(db, "SUPER PHARM");
    updateTransactions(db, [sea], { excluded: true });
    updateTransactions(db, [pharm], { excluded: false });
    for (const setExcluded of [true, false]) {
      const preview = previewRule(db, ruleInput({ matchText: "S", setExcluded }));
      expect(preview.setByYou, String(setExcluded)).toEqual([pharm]);
      expect(previewRule(db, ruleInput({ matchText: "הים", setExcluded })).setByYou).toEqual([sea]);
    }
    // A rule that also sorts it into a category would still change it.
    const both = ruleInput({ matchText: "הים", setExcluded: true, setCategoryId: categoryId(db, "Restaurants") });
    expect(previewRule(db, both).setByYou).toEqual([]);
  });
});

describe("contradiction hints (spec 41)", () => {
  const hintsOf = (db: Db, name: string) => listRules(db).find((r) => r.name === name);

  it("counts both ways: the winner overrides, the loser is decided", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    const food = categoryId(db, "Restaurants");
    createRule(db, ruleInput({ matchText: "הפינה", setCategoryId: food }), NOW);
    createRule(db, ruleInput({ matchText: "קפה", setCategoryId: cafes }), NOW);
    createRule(db, ruleInput({ matchText: "תל אביב", setCategoryId: cafes }), NOW);

    expect(hintsOf(db, "הפינה")?.overrides).toEqual({ names: ["קפה", "תל אביב"], rows: 2 });
    expect(hintsOf(db, "קפה")?.overlaps).toMatchObject([{ count: 2, winnerNames: ["הפינה"] }]);
    // The two lower rules agree with each other, and neither wins a row they share.
    expect(hintsOf(db, "קפה")?.overrides).toBeUndefined();
    expect(hintsOf(db, "תל אביב")?.overrides).toBeUndefined();

    const draft = ruleInput({ matchText: "קפה הפינה", setCategoryId: categoryId(db, "Shopping") });
    expect(previewRule(db, draft).overrides).toEqual([
      { name: "הפינה", rows: 2 },
      { name: "קפה", rows: 2 },
      { name: "תל אביב", rows: 1 },
    ]);
  });

  it("agreeing rules give none", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    createRule(db, ruleInput({ matchText: "קפה", setCategoryId: cafes }), NOW);
    createRule(db, ruleInput({ matchText: "הפינה", setCategoryId: cafes }), NOW);
    expect(listRules(db).map((r) => r.overrides)).toEqual([undefined, undefined]);
    expect(previewRule(db, ruleInput({ matchText: "קפה", setCategoryId: cafes })).overrides).toEqual([]);
    // A category rule and an ignore rule set different things, so they do not contradict.
    expect(previewRule(db, ruleInput({ matchText: "קפה", setExcluded: true })).overrides).toEqual([]);
  });

  it("ignore against always count contradicts", () => {
    const db = ledger();
    createRule(db, ruleInput({ matchText: "קפה", setExcluded: true }), NOW);
    createRule(db, ruleInput({ matchText: "הפינה", setExcluded: false }), NOW);

    expect(hintsOf(db, "קפה")?.overrides).toEqual({ names: ["הפינה"], rows: 2 });
    expect(hintsOf(db, "הפינה")?.overlaps).toMatchObject([{ action: "exclude", count: 2, winnerNames: ["קפה"] }]);
    expect(previewRule(db, ruleInput({ matchText: "תל אביב", setExcluded: false })).overrides).toEqual([
      { name: "קפה", rows: 1 },
    ]);
  });

  it("a saved rule's preview names the rules above that decide rows, and overrides only what it wins", () => {
    const db = ledger();
    createRule(db, ruleInput({ matchText: "תל אביב", setCategoryId: categoryId(db, "Shopping") }), NOW);
    const middle = createRule(db, ruleInput({ matchText: "קפה", setCategoryId: categoryId(db, "Coffee & Cafes") }), NOW);
    createRule(db, ruleInput({ matchText: "הפינה", setCategoryId: categoryId(db, "Restaurants") }), NOW);

    const preview = previewRule(db, { ...middle, ruleId: middle.id });
    expect(preview).toMatchObject({ decidedHigher: 1, higherNames: ["תל אביב"], overrides: [{ name: "הפינה", rows: 1 }] });
  });

  it("leaves out rows the user set by hand, except those the draft would take over (F45)", () => {
    const db = ledger();
    const cafes = categoryId(db, "Coffee & Cafes");
    createRule(db, ruleInput({ matchText: "קפה", setCategoryId: cafes }), NOW);
    createRule(db, ruleInput({ matchText: "הפינה", setCategoryId: categoryId(db, "Restaurants") }), NOW);
    updateTransactions(db, [idOf(db, "קפה הפינה")], { categoryId: categoryId(db, "Shopping") });

    expect(hintsOf(db, "קפה")?.overrides).toEqual({ names: ["הפינה"], rows: 1 });
    // The new rule takes over the hand-set row when ticked, so there it wins too.
    const draft = ruleInput({ matchText: "קפה", setCategoryId: categoryId(db, "Fuel") });
    expect(previewRule(db, draft).overrides).toEqual([
      { name: "קפה", rows: 2 },
      { name: "הפינה", rows: 2 },
    ]);
  });
});
