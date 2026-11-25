// Spec 13: saving says what it did, Apply now says what changed, and rows the
// user sorted by hand change only when the save names them.

import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import { ingest } from "../ledger/ingest";
import { createCategory } from "../ledger/categories";
import { trashTransactions, updateTransactions } from "../ledger/queries";
import { NOW, bank, categoryId, idOf, newDb, snapshot, txn } from "../testing/ledger";
import { multiRule, ruleFields, ruleInput } from "../testing/rules";
import { applyAllRules, createRule, deleteRule, previewRule, saveRule, updateRule } from "./queries";

const out = (date: string, amount: number, description: string) => txn({ date, amount, description });

/** Six cafe rows; two of them sorted by hand (one into Restaurants, one into Coffee already). */
function cafes(): Db {
  const db = newDb();
  ingest(
    db,
    [
      bank([
        out("2026-03-01", -1800, "ארומה תל אביב"),
        out("2026-03-02", -2400, "Aroma Haifa"),
        out("2026-03-03", -1900, "קופיקס רמת גן"),
        out("2026-03-04", -2100, "לנדוור"),
        out("2026-03-05", -2600, "Landwer TLV"),
        out("2026-03-06", -9000, "מסעדת הים"),
      ]),
    ],
    { now: NOW },
  );
  updateTransactions(db, [idOf(db, "לנדוור")], { categoryId: categoryId(db, "Restaurants") });
  updateTransactions(db, [idOf(db, "Landwer TLV")], { categoryId: categoryId(db, "Coffee & Cafes") });
  return db;
}

const cafeRule = (db: Db) =>
  multiRule(
    "all",
    [
      {
        kind: "text",
        field: "description",
        mode: "contains",
        values: ["ארומה", "Aroma", "קופיקס", "Landwer", "לנדוור"],
      },
    ],
    categoryId(db, "Coffee & Cafes"),
    "Cafes",
  );

describe("saveRule", () => {
  it("reports how many rows the rule sorts and how many changed", () => {
    const db = cafes();
    const saved = saveRule(db, { id: null, rule: cafeRule(db) });
    // Three cafes it may sort; the two the user sorted stay theirs.
    expect(saved).toMatchObject({ applied: 3, changed: 3, rule: { name: "Cafes", position: 1 } });

    const again = saveRule(db, { id: saved.rule.id, rule: { ...cafeRule(db), name: "Cafes again" } });
    expect(again).toMatchObject({ applied: 3, changed: 0, rule: { id: saved.rule.id, name: "Cafes again" } });
  });

  it("counts each row once, whichever of its actions the rule set", () => {
    const db = cafes();
    const saved = saveRule(db, { id: null, rule: { ...cafeRule(db), setExcluded: true } });
    // Three get both actions; the two hand-sorted rows keep their category but are excluded.
    expect(saved.applied).toBe(5);
  });

  it("never changes a user-set category when the save does not name the row", () => {
    const db = cafes();
    const userRows = [idOf(db, "לנדוור"), idOf(db, "Landwer TLV")];
    const before = userRows.map((id) => ruleFields(db, id));
    const rule = saveRule(db, { id: null, rule: cafeRule(db) }).rule;
    updateRule(db, rule.id, { ...cafeRule(db), setCategoryId: categoryId(db, "Groceries") });
    applyAllRules(db);
    deleteRule(db, rule.id);
    expect(userRows.map((id) => ruleFields(db, id))).toEqual(before);
  });

  it("the preview lists hand-sorted rows in another category, and the save takes over only those named", () => {
    const db = cafes();
    const preview = previewRule(db, cafeRule(db));
    // Landwer TLV is already in Coffee & Cafes, so it is not listed.
    expect(preview.handSet.map((t) => t.description)).toEqual(["לנדוור"]);
    expect(previewRule(db, { ...cafeRule(db), setCategoryId: null }).handSet).toEqual([]);

    const restaurant = idOf(db, "מסעדת הים");
    updateTransactions(db, [restaurant], { categoryId: categoryId(db, "Shopping") });
    // Naming a row the rule does not match, or one already in its category, changes nothing there.
    const named = [idOf(db, "לנדוור"), restaurant, idOf(db, "Landwer TLV")];
    const untouched = [restaurant, idOf(db, "Landwer TLV")].map((id) => ruleFields(db, id));
    const saved = saveRule(db, { id: null, rule: cafeRule(db), alsoChange: named });

    expect(saved.applied).toBe(4);
    expect(ruleFields(db, idOf(db, "לנדוור"))).toMatchObject({
      category_id: categoryId(db, "Coffee & Cafes"),
      category_source: "rule",
      rule_id: saved.rule.id,
    });
    expect([restaurant, idOf(db, "Landwer TLV")].map((id) => ruleFields(db, id))).toEqual(untouched);
  });

  // Nested categories (spec 34) with F45: a finer hand-sort inside the rule's own category agrees with it.
  it("never offers or takes back up a row the user sorted into a subcategory of the rule's category", () => {
    const db = cafes();
    const made = createCategory(db, { name: "Espresso bars", kind: "expense", parentId: categoryId(db, "Coffee & Cafes"), emoji: null, color: null });
    if (!made.ok) throw new Error(made.problem);
    const landwer = idOf(db, "Landwer TLV");
    updateTransactions(db, [landwer], { categoryId: made.category.id });

    expect(previewRule(db, cafeRule(db)).handSet.map((t) => t.description)).toEqual(["לנדוור"]);
    saveRule(db, { id: null, rule: cafeRule(db), alsoChange: [landwer, idOf(db, "לנדוור")] });
    expect(ruleFields(db, landwer)).toMatchObject({ category_id: made.category.id, category_source: "user" });
    expect(ruleFields(db, idOf(db, "לנדוור"))).toMatchObject({ category_id: categoryId(db, "Coffee & Cafes") });
  });

  it("does not take over hand-sorted rows when the rule is off or sets no category", () => {
    const db = cafes();
    const landwer = idOf(db, "לנדוור");
    const before = ruleFields(db, landwer);
    saveRule(db, { id: null, rule: { ...cafeRule(db), enabled: false }, alsoChange: [landwer] });
    saveRule(db, {
      id: null,
      rule: { ...cafeRule(db), setCategoryId: null, setExcluded: true },
      alsoChange: [landwer],
    });
    expect(ruleFields(db, landwer)).toMatchObject({ category_id: before.category_id, category_source: "user" });
  });

  it("rejects a malformed request and saves nothing", () => {
    const db = cafes();
    const rows = snapshot(db);
    expect(() => saveRule(db, { id: null, rule: cafeRule(db), alsoChange: ["x"] })).toThrow("BAD_REQUEST");
    expect(() => saveRule(db, { id: 0, rule: cafeRule(db) })).toThrow("BAD_REQUEST");
    expect(() => saveRule(db, { id: 999, rule: cafeRule(db) })).toThrow("BAD_REQUEST");
    expect(snapshot(db)).toEqual(rows);
  });
});

describe("applyAllRules (Apply now)", () => {
  it("reports what changed and how many rows the rules sort", () => {
    const db = cafes();
    createRule(db, ruleInput({ matchText: "מסעדת", setCategoryId: categoryId(db, "Restaurants") }));
    expect(applyAllRules(db)).toEqual({ changed: 0, sorted: 1 });

    // A row a rule sorted, put back by hand to nothing and then released, is sorted again.
    const id = idOf(db, "מסעדת הים");
    db.prepare("UPDATE transactions SET category_id = NULL, category_source = NULL, rule_id = NULL WHERE id = ?").run(
      id,
    );
    expect(applyAllRules(db)).toEqual({ changed: 1, sorted: 1 });
    expect(ruleFields(db, id)).toMatchObject({ category_id: categoryId(db, "Restaurants"), category_source: "rule" });
  });
});

describe("ticks in the editor (spec 35)", () => {
  const exceptions = (db: Db) =>
    db.prepare("SELECT rule_id, transaction_id FROM rule_exceptions ORDER BY rule_id, transaction_id").all();
  const coffee = (db: Db) => categoryId(db, "Coffee & Cafes");
  const restaurants = (db: Db) => categoryId(db, "Restaurants");

  /** The cafe rule saved, then saved again with Aroma Haifa unticked. */
  function untickedAroma() {
    const db = cafes();
    const id = saveRule(db, { id: null, rule: cafeRule(db) }).rule.id;
    const aroma = idOf(db, "Aroma Haifa");
    const others = [idOf(db, "ארומה תל אביב"), idOf(db, "קופיקס רמת גן")];
    saveRule(db, { id, rule: cafeRule(db), unticked: [aroma], ticked: others });
    return { db, id, aroma, others };
  }

  it("unticking a row the rule set keeps its category as the user's, also after later edits", () => {
    const { db, id, aroma, others } = untickedAroma();
    expect(ruleFields(db, aroma)).toEqual({
      category_id: coffee(db),
      category_source: "user",
      excluded: 0,
      excluded_source: null,
      rule_id: null,
    });
    expect(exceptions(db)).toEqual([{ rule_id: id, transaction_id: aroma }]);

    saveRule(db, { id, rule: { ...cafeRule(db), setCategoryId: restaurants(db) } });
    expect(ruleFields(db, aroma)).toMatchObject({ category_id: coffee(db), category_source: "user" });
    for (const other of others) {
      expect(ruleFields(db, other)).toMatchObject({ category_id: restaurants(db), category_source: "rule", rule_id: id });
    }
  });

  it("ticking it back ends the exception and the rule applies again", () => {
    const { db, id, aroma } = untickedAroma();
    saveRule(db, { id, rule: cafeRule(db), ticked: [aroma] });
    expect(exceptions(db)).toEqual([]);
    expect(ruleFields(db, aroma)).toMatchObject({ category_id: coffee(db), category_source: "rule", rule_id: id });
    saveRule(db, { id, rule: { ...cafeRule(db), setCategoryId: restaurants(db) } });
    expect(ruleFields(db, aroma)).toMatchObject({ category_id: restaurants(db), category_source: "rule" });
  });

  it("a row kept in another category comes back when ticked, as a hand-set row does (F45)", () => {
    const { db, id, aroma } = untickedAroma();
    const toRestaurants = { ...cafeRule(db), setCategoryId: restaurants(db) };
    saveRule(db, { id, rule: toRestaurants });
    expect(previewRule(db, toRestaurants).handSet.map((t) => t.id)).toContain(aroma);
    saveRule(db, { id, rule: toRestaurants, ticked: [aroma], alsoChange: [aroma] });
    expect(ruleFields(db, aroma)).toMatchObject({ category_id: restaurants(db), category_source: "rule", rule_id: id });
  });

  it("a row the rule had ignored stays ignored, as the user's", () => {
    const db = cafes();
    const hide = { ...cafeRule(db), setCategoryId: null, setExcluded: true };
    const id = saveRule(db, { id: null, rule: hide }).rule.id;
    const aroma = idOf(db, "Aroma Haifa");
    saveRule(db, { id, rule: hide, unticked: [aroma] });
    expect(ruleFields(db, aroma)).toEqual({
      category_id: null,
      category_source: null,
      excluded: 1,
      excluded_source: "user",
      rule_id: null,
    });
    saveRule(db, { id, rule: { ...hide, setExcluded: false } });
    expect(ruleFields(db, aroma)).toMatchObject({ excluded: 1, excluded_source: "user" });
  });

  it("a new rule leaves unticked rows as they are, and a lower rule still sorts them", () => {
    const db = cafes();
    const cofix = idOf(db, "קופיקס רמת גן");
    const id = saveRule(db, { id: null, rule: cafeRule(db), unticked: [cofix] }).rule.id;
    expect(ruleFields(db, cofix)).toMatchObject({ category_id: null, category_source: null, rule_id: null });
    const shopping = createRule(db, ruleInput({ matchText: "קופיקס", setCategoryId: categoryId(db, "Shopping") }));
    expect(shopping.position).toBeGreaterThan(1);
    expect(ruleFields(db, cofix)).toMatchObject({ category_id: categoryId(db, "Shopping"), rule_id: shopping.id });
    expect(exceptions(db)).toEqual([{ rule_id: id, transaction_id: cofix }]);
  });

  it("hand-set rows: ticked ones change with the rule, unticked ones keep their category", () => {
    const ticked = cafes();
    const landwer = idOf(ticked, "לנדוור");
    saveRule(ticked, { id: null, rule: cafeRule(ticked), ticked: [landwer], alsoChange: [landwer] });
    expect(ruleFields(ticked, landwer)).toMatchObject({ category_id: coffee(ticked), category_source: "rule" });

    const unticked = cafes();
    const id = saveRule(unticked, { id: null, rule: cafeRule(unticked), unticked: [landwer] }).rule.id;
    expect(ruleFields(unticked, landwer)).toMatchObject({ category_id: restaurants(unticked), category_source: "user" });
    // Naming an excepted row in `alsoChange` alone never hands it over.
    saveRule(unticked, { id, rule: cafeRule(unticked), alsoChange: [landwer] });
    expect(ruleFields(unticked, landwer)).toMatchObject({ category_id: restaurants(unticked), category_source: "user" });

    // Unticked wins over the same id ticked or in `alsoChange`.
    const both = cafes();
    saveRule(both, { id: null, rule: cafeRule(both), unticked: [landwer], ticked: [landwer], alsoChange: [landwer] });
    expect(ruleFields(both, landwer)).toMatchObject({ category_id: restaurants(both), category_source: "user" });
    expect(exceptions(both)).toHaveLength(1);
  });

  it("keeps exceptions on rows no longer shown, so widening the rule again never brings them back", () => {
    const { db, id, aroma, others } = untickedAroma();
    const hebrewOnly = multiRule(
      "all",
      [{ kind: "text", field: "description", mode: "contains", values: ["ארומה", "קופיקס"] }],
      coffee(db),
      "Cafes",
    );
    saveRule(db, { id, rule: hebrewOnly, ticked: others });
    saveRule(db, { id, rule: cafeRule(db), ticked: [...others, idOf(db, "Landwer TLV")] });
    expect(exceptions(db)).toEqual([{ rule_id: id, transaction_id: aroma }]);
    expect(ruleFields(db, aroma)).toMatchObject({ category_id: coffee(db), category_source: "user" });
  });

  it("ignores unknown and trashed ids, and refuses ids that are not positive integers", () => {
    const { db, id, aroma, others } = untickedAroma();
    const [tlv] = others as [number];
    trashTransactions(db, [aroma, tlv]);
    const trashed = ruleFields(db, tlv);
    saveRule(db, { id, rule: cafeRule(db), unticked: [tlv, 99999], ticked: [aroma, 88888], alsoChange: [77777] });
    // The trashed row keeps its exception and gets none new; nothing else changes on it.
    expect(exceptions(db)).toEqual([{ rule_id: id, transaction_id: aroma }]);
    expect(ruleFields(db, tlv)).toEqual(trashed);

    const rows = snapshot(db);
    for (const bad of [["x"], [0], [-3], [1.5], "1"]) {
      expect(() => saveRule(db, { id, rule: cafeRule(db), unticked: bad })).toThrow("BAD_REQUEST");
      expect(() => saveRule(db, { id, rule: cafeRule(db), ticked: bad })).toThrow("BAD_REQUEST");
    }
    expect(snapshot(db)).toEqual(rows);
    expect(exceptions(db)).toEqual([{ rule_id: id, transaction_id: aroma }]);
  });

  it("the preview marks the shown rows the rule skips, and deleting the rule forgets them", () => {
    const { db, id, aroma } = untickedAroma();
    expect(previewRule(db, { ...cafeRule(db), ruleId: id }).exceptions).toEqual([aroma]);
    expect(previewRule(db, cafeRule(db)).exceptions).toEqual([]);
    deleteRule(db, id);
    expect(exceptions(db)).toEqual([]);
    expect(ruleFields(db, aroma)).toMatchObject({ category_id: coffee(db), category_source: "user" });
  });
});
