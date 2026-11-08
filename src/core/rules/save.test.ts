// Spec 13: saving says what it did, Apply now says what changed, and rows the
// user sorted by hand change only when the save names them.

import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import { ingest } from "../ledger/ingest";
import { updateTransactions } from "../ledger/queries";
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
