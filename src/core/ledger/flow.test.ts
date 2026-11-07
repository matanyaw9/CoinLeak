import { describe, expect, it } from "vitest";
import type { CategorySource, Flow, ReviewFlag } from "@shared/types";
import { NOW, bank, card, categoryId, charge, idOf, newDb, txn } from "../testing/ledger";
import { flagsOf, flowOf, LEDGER_SQL } from "./flow";
import { ingest } from "./ingest";
import { listTransactions, monthSummary, trend, updateTransactions } from "./queries";

describe("flowOf", () => {
  it("follows the money model table", () => {
    const base = { amount: -100, gone: false, excluded: false, internal: false, categoryKind: null };
    expect(flowOf({ ...base, gone: true, excluded: true, internal: true, amount: 100 })).toBe("gone");
    expect(flowOf({ ...base, excluded: true, internal: true })).toBe("excluded");
    expect(flowOf({ ...base, internal: true })).toBe("internal");
    expect(flowOf({ ...base, amount: 100, categoryKind: "expense" })).toBe("refund");
    expect(flowOf({ ...base, amount: 100, categoryKind: "income" })).toBe("income");
    expect(flowOf({ ...base, amount: 100 })).toBe("income");
    expect(flowOf({ ...base, categoryKind: "income" })).toBe("spending");
    expect(flowOf(base)).toBe("spending");
  });
});

describe("TS and SQL", () => {
  it("agree on flow and review flags for every combination", () => {
    const db = newDb();
    ingest(db, [bank([])], { now: NOW });
    const account = (db.prepare("SELECT id FROM accounts").get() as { id: number }).id;
    const categories = [
      { id: null, kind: null },
      { id: categoryId(db, "Groceries"), kind: "expense" as const },
      { id: categoryId(db, "Salary"), kind: "income" as const },
    ];
    // Only a pending row can be gone, so a gone combination is stored as pending.
    const insert = db.prepare(
      `INSERT INTO transactions (account_id, date, amount, description, status, gone_at, category_id, category_source,
         excluded, internal, possible_card_bill, dedup_hash, dedup_seq, created_at, updated_at)
       VALUES (?, '2026-03-01', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', '')`,
    );

    const expected = new Map<string, { flow: Flow; flags: ReviewFlag[] }>();
    let n = 0;
    for (const gone of [false, true])
      for (const excluded of [false, true])
        for (const internal of [false, true])
          for (const amount of [-500, 0, 500])
            for (const category of categories)
              for (const possibleCardBill of [false, true])
                for (const categorySource of [null, "rule", "user"] as (CategorySource | null)[]) {
                  const key = `combo ${n++}`;
                  insert.run(
                    account,
                    amount,
                    key,
                    gone ? "pending" : "completed",
                    gone ? NOW.toISOString() : null,
                    category.id,
                    categorySource,
                    Number(excluded),
                    Number(internal),
                    Number(possibleCardBill),
                    key,
                  );
                  const facts = {
                    amount,
                    gone,
                    excluded,
                    internal,
                    categoryKind: category.kind,
                    categoryId: category.id,
                    categorySource,
                    possibleCardBill,
                  };
                  expected.set(key, { flow: flowOf(facts), flags: flagsOf(facts) });
                }

    const viaSql = db
      .prepare(`WITH ledger AS (${LEDGER_SQL}) SELECT description, flow FROM ledger`)
      .all() as { description: string; flow: Flow }[];
    expect(viaSql).toHaveLength(432);
    for (const r of viaSql) expect(r.flow, r.description).toBe(expected.get(r.description)?.flow);
    for (const t of listTransactions(db)) {
      expect(t.flags, t.description).toEqual(expected.get(t.description)?.flags);
      expect(t.status === "gone", t.description).toBe(t.flow === "gone");
    }
    // Every flow and every flag shows up at least once, so no branch is untested.
    expect(new Set(viaSql.map((r) => r.flow))).toEqual(
      new Set(["spending", "income", "refund", "internal", "excluded", "gone"]),
    );
    expect(new Set([...expected.values()].flatMap((e) => e.flags))).toEqual(
      new Set(["uncategorized", "possible_card_bill", "gone"]),
    );
  });
});

describe("flows in the totals", () => {
  it("a refund reduces its category and the month's spending", () => {
    const db = newDb();
    ingest(
      db,
      [
        card("4321", [
          charge("2026-03-02", -30000, "חנות בגדים", "2026-04-10"),
          charge("2026-03-09", 12000, "זיכוי חנות בגדים", "2026-04-10"),
        ]),
      ],
      { now: NOW },
    );
    const shopping = categoryId(db, "Shopping");
    updateTransactions(db, [idOf(db, "חנות בגדים"), idOf(db, "זיכוי חנות בגדים")], { categoryId: shopping });

    const refund = listTransactions(db).find((t) => t.description === "זיכוי חנות בגדים");
    expect(refund?.flow).toBe("refund");
    const summary = monthSummary(db, "2026-03");
    expect(summary.income).toBe(0);
    expect(summary.spending).toBe(18000);
    expect(summary.byCategory).toEqual([{ categoryId: shopping, amount: 18000, count: 2 }]);
  });

  it("money in without an expense category is income, not a refund", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-03-01", amount: 900000, description: "משכורת" })])], { now: NOW });
    expect(monthSummary(db, "2026-03")).toMatchObject({ income: 900000, spending: 0, byCategory: [] });
  });

  it("an excluded row counts nowhere", () => {
    const db = newDb();
    ingest(
      db,
      [
        bank([
          txn({ date: "2026-03-01", amount: 500000, description: "החזר הלוואה מחבר" }),
          txn({ date: "2026-03-05", amount: -250000, description: "העברה לחיסכון" }),
          txn({ date: "2026-03-06", amount: -4000, description: "מכולת" }),
        ]),
      ],
      { now: NOW },
    );
    const before = monthSummary(db, "2026-03");
    updateTransactions(db, [idOf(db, "החזר הלוואה מחבר"), idOf(db, "העברה לחיסכון")], { excluded: true });

    const after = monthSummary(db, "2026-03");
    expect(before).toMatchObject({ income: 500000, spending: 254000, needsReview: 3 });
    expect(after).toMatchObject({ income: 0, spending: 4000, needsReview: 1 });
    expect(after.byCategory).toEqual([{ categoryId: null, amount: 4000, count: 1 }]);
    expect(after.byDay.at(-1)).toEqual({ date: "2026-03-31", amount: 4000 });
    expect(trend(db, 1, { now: NOW })).toEqual([
      { month: "2026-03", income: 0, spending: 4000, byCategory: [{ categoryId: null, amount: 4000 }] },
    ]);
    expect(listTransactions(db, { flows: ["excluded"] })).toHaveLength(2);
  });
});
