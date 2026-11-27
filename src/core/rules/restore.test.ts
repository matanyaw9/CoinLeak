// Spec 43 B: deleting a rule and then restoring it leaves the Demo database
// as it was: every row, the order and the exceptions. Bad payloads are refused.

import { describe, expect, it } from "vitest";
import type { DeletedRule, Rule } from "@shared/types";
import { openDatabase, type Db } from "../db";
import { seedDemo } from "../demo/seed";
import { CARD_SPENDS } from "../demo/shops";
import { createCategory, deleteCategory, listTransactions, trashTransactions } from "../ledger";
import { categoryId } from "../testing/ledger";
import { ruleInput } from "../testing/rules";
import { createRule, deleteRule, listRules, reorderRules, restoreRule, saveRule } from "./queries";

const TODAY = new Date("2026-11-07T10:00:00Z");

function demo(): Db {
  const db = openDatabase(":memory:");
  seedDemo(db, TODAY);
  return db;
}

/** What rules own on every row, rows in Trash too. */
const rows = (db: Db) =>
  db
    .prepare("SELECT id, category_id, category_source, excluded, excluded_source, rule_id FROM transactions ORDER BY id")
    .all();
const exceptions = (db: Db) =>
  db.prepare("SELECT rule_id, transaction_id FROM rule_exceptions ORDER BY rule_id, transaction_id").all();
const order = (db: Db) => listRules(db).map((r) => `${r.position} ${r.id} ${r.name}`);
const everything = (db: Db) => ({ rows: rows(db), exceptions: exceptions(db), order: order(db) });

/** The Demo with one more rule, second in the order, with two exceptions, one of them now in Trash. */
function withExceptions(): { db: Db; rule: Rule; unticked: number[] } {
  const db = demo();
  const shop = CARD_SPENDS[0]?.shops[0] ?? "";
  const matching = listTransactions(db, { search: shop }).filter((t) => t.categorySource === "rule");
  const unticked = matching.slice(0, 2).map((t) => t.id).sort((a, b) => a - b);
  expect(unticked).toHaveLength(2);
  const input = {
    ...ruleInput({ matchText: shop, name: "Presents", setCategoryId: categoryId(db, "Gifts & Donations") }),
    setExcluded: true,
  };
  const { rule } = saveRule(db, { id: null, rule: input, unticked }, TODAY);
  const [first, ...others] = listRules(db)
    .map((r) => r.id)
    .filter((id) => id !== rule.id);
  reorderRules(db, [first as number, rule.id, ...others], TODAY);
  trashTransactions(db, unticked.slice(1), TODAY);
  return { db, rule, unticked };
}

describe("restoreRule", () => {
  it("brings back a middle rule with its exceptions, and every row as before", () => {
    const { db, rule, unticked } = withExceptions();
    const before = everything(db);

    const deleted = deleteRule(db, rule.id, TODAY);
    expect(deleted).toMatchObject({ rule: { id: rule.id, position: 2, name: "Presents" }, exceptions: unticked });
    expect(rows(db)).not.toEqual(before.rows);

    restoreRule(db, deleted, TODAY);
    expect(everything(db)).toEqual(before);
  });

  it("leaves everything as before for each of the Demo's rules", () => {
    const db = demo();
    const before = everything(db);
    for (const { id, name } of listRules(db)) {
      restoreRule(db, deleteRule(db, id, TODAY), TODAY);
      expect(everything(db), name).toEqual(before);
    }
  });

  it("puts the rule last when the list got shorter than its old position", () => {
    const db = demo();
    const ids = listRules(db).map((r) => r.id);
    const last = deleteRule(db, ids.at(-1) as number, TODAY);
    deleteRule(db, ids[0] as number, TODAY);
    restoreRule(db, last, TODAY);
    expect(listRules(db).map((r) => r.id)).toEqual(ids.slice(1));
    expect(listRules(db).map((r) => r.position)).toEqual(ids.slice(1).map((_, i) => i + 1));
  });

  it("refuses a malformed payload and changes nothing", () => {
    const { db, rule } = withExceptions();
    const deleted = deleteRule(db, rule.id, TODAY);
    const before = everything(db);
    const bad: unknown[] = [
      undefined,
      null,
      {},
      { ...deleted, rule: null },
      { ...deleted, rule: { ...deleted.rule, id: 0 } },
      { ...deleted, rule: { ...deleted.rule, position: 1.5 } },
      { ...deleted, rule: { ...deleted.rule, conditions: [] } },
      { ...deleted, exceptions: ["1"] },
      { ...deleted, exceptions: undefined },
      { ...deleted, links: [{ transactionId: 1 }] },
      { ...deleted, links: [null] },
      { ...deleted, links: undefined },
    ];
    for (const payload of bad) {
      expect(() => restoreRule(db, payload, TODAY), JSON.stringify(payload)).toThrow("BAD_REQUEST");
    }
    expect(everything(db)).toEqual(before);
  });

  it("refuses a stale payload: restored already, its id taken, or its category gone", () => {
    const db = demo();
    const cat = createCategory(db, { name: "Short lived", kind: "expense", parentId: null, emoji: "🧪", color: "#9CBF7C" });
    if (!cat.ok) throw new Error("category not made");
    const input = ruleInput({ matchText: "nothing matches this", setCategoryId: categoryId(db, "Short lived") });
    const refused = (deleted: DeletedRule) => {
      const before = everything(db);
      expect(() => restoreRule(db, deleted, TODAY)).toThrow("BAD_REQUEST");
      expect(everything(db)).toEqual(before);
    };

    const first = deleteRule(db, createRule(db, input, TODAY).id, TODAY);
    restoreRule(db, first, TODAY);
    refused(first);

    const second = deleteRule(db, first.rule.id, TODAY);
    // The newest id is free again, so the next rule takes it.
    expect(createRule(db, input, TODAY).id).toBe(second.rule.id);
    refused(second);

    const third = deleteRule(db, second.rule.id, TODAY);
    expect(deleteCategory(db, categoryId(db, "Short lived"), null)).toMatchObject({ ok: true });
    refused(third);
  });
});
