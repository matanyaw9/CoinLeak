// Rules run as part of every sync save (ingest), so new rows arrive sorted.

import { describe, expect, it } from "vitest";
import { ingest, listTransactions, updateTransactions } from "../ledger";
import { NOW, card, categoryId, charge, idOf, newDb } from "../testing/ledger";
import { ruleInput } from "../testing/rules";
import { createRule } from "./queries";

describe("rules during a sync", () => {
  it("categorizes new rows as they are saved, and never a row the user set", () => {
    const db = newDb();
    createRule(db, ruleInput({ matchText: "שופרסל", setCategoryId: categoryId(db, "Groceries") }), NOW);

    ingest(db, [card("4321", [charge("2026-03-02", -15000, "שופרסל דיל רחובות", "2026-04-10")])], { now: NOW });
    const first = listTransactions(db).find((t) => t.description.startsWith("שופרסל"));
    expect(first).toMatchObject({ categoryId: categoryId(db, "Groceries"), categorySource: "rule" });

    updateTransactions(db, [idOf(db, "שופרסל דיל רחובות")], { categoryId: categoryId(db, "Restaurants") });
    ingest(
      db,
      [
        card("4321", [
          charge("2026-03-02", -15000, "שופרסל דיל רחובות", "2026-04-10"),
          charge("2026-03-09", -9000, "שופרסל אקספרס", "2026-04-10"),
        ]),
      ],
      { now: NOW },
    );
    const rows = listTransactions(db);
    expect(rows.find((t) => t.description === "שופרסל דיל רחובות")?.categoryId).toBe(categoryId(db, "Restaurants"));
    expect(rows.find((t) => t.description === "שופרסל אקספרס")?.categoryId).toBe(categoryId(db, "Groceries"));
  });
});
