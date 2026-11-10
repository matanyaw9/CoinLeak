import { describe, expect, it } from "vitest";
import type { CategorySource, Flow, ReviewFlag } from "@shared/types";
import { NOW, bank, card, categoryId, charge, idOf, newDb, txn } from "../testing/ledger";
import { flagsOf, flowOf, LEDGER_SQL } from "./flow";
import { ingest } from "./ingest";
import { listTransactions, monthSummary, trend, updateTransactions } from "./queries";
import { FLOWS } from "./validate";

describe("flowOf", () => {
  it("follows the money model table", () => {
    const base = { amount: -100, trashed: false, gone: false, excluded: false, internal: false, categoryKind: null };
    expect(flowOf({ ...base, trashed: true, gone: true, excluded: true, internal: true })).toBe("trashed");
    expect(flowOf({ ...base, trashed: true, amount: 100, categoryKind: "expense" })).toBe("trashed");
    expect(flowOf({ ...base, trashed: true, amount: 100 })).toBe("trashed");
    expect(flowOf({ ...base, trashed: true })).toBe("trashed");
    expect(flowOf({ ...base, gone: true, excluded: true, internal: true, amount: 100 })).toBe("gone");
    expect(flowOf({ ...base, excluded: true, internal: true })).toBe("excluded");
    expect(flowOf({ ...base, internal: true })).toBe("internal");
    expect(flowOf({ ...base, amount: 100, categoryKind: "expense" })).toBe("refund");
    expect(flowOf({ ...base, amount: 100, categoryKind: "income" })).toBe("income");
    expect(flowOf({ ...base, amount: 100 })).toBe("income");
    expect(flowOf({ ...base, categoryKind: "income" })).toBe("spending");
    expect(flowOf(base)).toBe("spending");
  });

  it("puts a transfer row after trashed, gone, excluded and internal, either direction", () => {
    const out = { amount: -100, trashed: false, gone: false, excluded: false, internal: false, categoryKind: "transfer" as const };
    expect(flowOf(out)).toBe("transfer");
    expect(flowOf({ ...out, amount: 100 })).toBe("transfer");
    expect(flowOf({ ...out, amount: 0 })).toBe("transfer");
    expect(flowOf({ ...out, trashed: true })).toBe("trashed");
    expect(flowOf({ ...out, gone: true })).toBe("gone");
    expect(flowOf({ ...out, excluded: true })).toBe("excluded");
    expect(flowOf({ ...out, internal: true })).toBe("internal");
    expect(flagsOf({ ...out, categoryId: 1, categorySource: "rule", possibleCardBill: true })).toEqual([]);
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
      { id: categoryId(db, "Savings"), kind: "transfer" as const },
    ];
    // Only a pending row can be gone, so a gone combination is stored as pending.
    const insert = db.prepare(
      `INSERT INTO transactions (account_id, date, amount, description, status, gone_at, trashed_at, category_id,
         category_source, excluded, internal, possible_card_bill, dedup_hash, dedup_seq, created_at, updated_at)
       VALUES (?, '2026-03-01', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', '')`,
    );

    const expected = new Map<string, { flow: Flow; flags: ReviewFlag[] }>();
    let n = 0;
    for (const trashed of [false, true])
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
                      trashed ? NOW.toISOString() : null,
                      category.id,
                      categorySource,
                      Number(excluded),
                      Number(internal),
                      Number(possibleCardBill),
                      key,
                    );
                    const facts = {
                      amount,
                      trashed,
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
    expect(viaSql).toHaveLength(1152);
    for (const r of viaSql) expect(r.flow, r.description).toBe(expected.get(r.description)?.flow);
    const listed = listTransactions(db, { flows: [...FLOWS] });
    expect(listed).toHaveLength(1152);
    for (const t of listed) {
      expect(t.flags, t.description).toEqual(expected.get(t.description)?.flags);
      expect(t.status === "gone", t.description).toBe(t.flow === "gone");
    }
    // Every flow and every flag shows up at least once, so no branch is untested.
    expect(new Set(viaSql.map((r) => r.flow))).toEqual(
      new Set(["spending", "income", "refund", "internal", "excluded", "gone", "trashed", "transfer"]),
    );
    expect(new Set([...expected.values()].flatMap((e) => e.flags))).toEqual(
      new Set(["uncategorized", "possible_card_bill", "gone"]),
    );
  });
});

describe("flows in the totals", () => {
  it("a transfer is neither spending nor income, and nets into transfers", () => {
    const db = newDb();
    ingest(
      db,
      [
        bank([
          txn({ date: "2026-03-01", amount: 1000000, description: "משכורת" }),
          txn({ date: "2026-03-05", amount: -300000, description: "הפקדה לחיסכון" }),
          txn({ date: "2026-03-06", amount: -100000, description: "קניית קרן" }),
          txn({ date: "2026-03-20", amount: 50000, description: "משיכה מחיסכון" }),
          txn({ date: "2026-03-21", amount: -4000, description: "מכולת" }),
        ]),
      ],
      { now: NOW },
    );
    updateTransactions(db, [idOf(db, "הפקדה לחיסכון"), idOf(db, "משיכה מחיסכון")], { categoryId: categoryId(db, "Savings") });
    updateTransactions(db, [idOf(db, "קניית קרן")], { categoryId: categoryId(db, "Investments") });
    updateTransactions(db, [idOf(db, "משכורת")], { categoryId: categoryId(db, "Salary") });
    updateTransactions(db, [idOf(db, "מכולת")], { categoryId: categoryId(db, "Groceries") });

    const summary = monthSummary(db, "2026-03");
    expect(summary).toMatchObject({ income: 1000000, spending: 4000, transfers: 350000, needsReview: 0 });
    expect(summary.byCategory).toEqual([{ categoryId: categoryId(db, "Groceries"), amount: 4000, count: 1 }]);
    expect(summary.byDay.at(-1)?.amount).toBe(4000);
    expect(trend(db, 1, { now: NOW })[0]).toMatchObject({ income: 1000000, spending: 4000 });
    expect(listTransactions(db, { flows: ["transfer"] })).toHaveLength(3);
  });

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
      { month: "2026-03", income: 0, spending: 4000, byCategory: [{ categoryId: null, amount: 4000 }], byParent: [{ categoryId: null, amount: 4000 }] },
    ]);
    expect(listTransactions(db, { flows: ["excluded"] })).toHaveLength(2);
  });
});
