import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { NOW, accountId, bank, card, categoryId, charge, idOf, newDb, stored, txn } from "../testing/ledger";
import { ingest } from "./ingest";
import { listCategories, listTransactions, monthSummary, trend, updateTransactions } from "./queries";

// A hand-built ledger. Totals below are worked out by hand from these rows.
//
// Bank                                        March flow
//   02-01  +1,400,000  salary (Feb)           (February income)
//   03-01  +1,500,000  salary                 income
//   03-02    -450,000  rent                   spending, Bills & Utilities
//   03-10     -35,000  bill for card 4321     internal (pays the 03-10 cycle)
//   03-15     -12,345  untracked card 9999    spending, uncategorized, flagged
//   03-20     -20,000  ATM                    spending, Cash & ATM
// Card 4321 (credit)
//   02-12 -20,000 groceries  billed 03-10     (February spending)
//   02-20  -5,000 coffee     billed 03-10     (February spending)
//   03-01 -10,000 clothes    billed 03-10     spending, Shopping
//   03-05  -8,000 groceries  billed 04-10     spending, Groceries
//   03-12  +3,000 clothes refund              refund, Shopping
//   03-25 -12,000 restaurant (pending)        spending, Restaurants
//   03-28 -99,900 gift, excluded by the user  excluded
function handBuiltLedger(): Db {
  const db = newDb();
  ingest(
    db,
    [
      card("4321", [
        charge("2026-02-12", -20000, "סופר שכונתי", "2026-03-10"),
        charge("2026-02-20", -5000, "קפה הפינה", "2026-03-10"),
        charge("2026-03-01", -10000, "חנות בגדים", "2026-03-10"),
        charge("2026-03-05", -8000, "סופר שכונתי", "2026-04-10"),
        charge("2026-03-12", 3000, "זיכוי חנות בגדים", "2026-04-10"),
        txn({ date: "2026-03-25", amount: -12000, description: "מסעדה", status: "pending" }),
        charge("2026-03-28", -99900, "מתנה לחבר", "2026-04-10"),
      ]),
    ],
    { now: NOW },
  );
  ingest(
    db,
    [
      bank([
        txn({ date: "2026-02-01", amount: 1400000, description: "משכורת פברואר" }),
        txn({ date: "2026-03-01", amount: 1500000, description: "משכורת מרץ" }),
        txn({ date: "2026-03-02", amount: -450000, description: "שכר דירה" }),
        txn({ date: "2026-03-10", amount: -35000, description: "חיוב לכרטיס ויזה 4321" }),
        txn({ date: "2026-03-15", amount: -12345, description: "ישראכרט 9999" }),
        txn({ date: "2026-03-20", amount: -20000, description: "כספומט" }),
      ]),
    ],
    { now: NOW },
  );
  const set = (descriptions: string[], category: string) =>
    updateTransactions(
      db,
      descriptions.flatMap((d) => listTransactions(db, { search: d }).map((t) => t.id)),
      { categoryId: categoryId(db, category) },
    );
  set(["משכורת"], "Salary");
  set(["שכר דירה"], "Bills & Utilities");
  set(["כספומט"], "Cash & ATM");
  set(["סופר שכונתי"], "Groceries");
  set(["קפה הפינה"], "Coffee & Cafes");
  set(["חנות בגדים"], "Shopping");
  set(["מסעדה"], "Restaurants");
  updateTransactions(db, [idOf(db, "מתנה לחבר")], { excluded: true, note: "Birthday present" });
  return db;
}

describe("monthSummary and trend on a hand-built ledger", () => {
  let db: Db;
  beforeEach(() => {
    db = handBuiltLedger();
  });

  it("March equals the hand-computed totals", () => {
    const march = monthSummary(db, "2026-03");
    expect(march.month).toBe("2026-03");
    expect(march.income).toBe(1500000);
    // 450,000 + 12,345 + 20,000 + 10,000 + 8,000 + 12,000 - 3,000
    expect(march.spending).toBe(509345);
    expect(march.needsReview).toBe(1);
    expect(march.byCategory).toEqual([
      { categoryId: categoryId(db, "Bills & Utilities"), amount: 450000, count: 1 },
      { categoryId: categoryId(db, "Cash & ATM"), amount: 20000, count: 1 },
      { categoryId: null, amount: 12345, count: 1 },
      { categoryId: categoryId(db, "Restaurants"), amount: 12000, count: 1 },
      { categoryId: categoryId(db, "Groceries"), amount: 8000, count: 1 },
      { categoryId: categoryId(db, "Shopping"), amount: 7000, count: 2 },
    ]);
  });

  it("March by day is the running total of spending", () => {
    const { byDay } = monthSummary(db, "2026-03");
    expect(byDay).toHaveLength(31);
    const at = (d: string) => byDay.find((p) => p.date === `2026-03-${d}`)?.amount;
    expect([at("01"), at("02"), at("04"), at("05"), at("12"), at("15"), at("20"), at("25"), at("31")]).toEqual([
      10000, 460000, 460000, 468000, 465000, 477345, 497345, 509345, 509345,
    ]);
  });

  it("February counts card rows by purchase date, not billing date", () => {
    const feb = monthSummary(db, "2026-02");
    expect(feb).toMatchObject({ income: 1400000, spending: 25000, needsReview: 0 });
    expect(feb.byCategory).toEqual([
      { categoryId: categoryId(db, "Groceries"), amount: 20000, count: 1 },
      { categoryId: categoryId(db, "Coffee & Cafes"), amount: 5000, count: 1 },
    ]);
    expect(feb.byDay).toHaveLength(28);
  });

  it("an empty month is all zeros", () => {
    const jan = monthSummary(db, "2026-01");
    expect(jan).toMatchObject({ income: 0, spending: 0, byCategory: [], needsReview: 0 });
    expect(jan.byDay.every((d) => d.amount === 0)).toBe(true);
  });

  it("trend lists the last months oldest first with the same totals", () => {
    expect(trend(db, 3, { now: NOW })).toEqual([
      { month: "2026-01", income: 0, spending: 0, byCategory: [] },
      {
        month: "2026-02",
        income: 1400000,
        spending: 25000,
        byCategory: [
          { categoryId: categoryId(db, "Groceries"), amount: 20000 },
          { categoryId: categoryId(db, "Coffee & Cafes"), amount: 5000 },
        ],
      },
      {
        month: "2026-03",
        income: 1500000,
        spending: 509345,
        byCategory: monthSummary(db, "2026-03").byCategory.map(({ categoryId, amount }) => ({ categoryId, amount })),
      },
    ]);
  });

  it("trend ends at the current month in Israel time", () => {
    // 21:30 UTC on March 31 is already April 1 in Israel.
    expect(trend(db, 1, { now: new Date("2026-03-31T21:30:00Z") })[0]?.month).toBe("2026-04");
    expect(trend(db, 13, { now: NOW }).map((p) => p.month).slice(0, 2)).toEqual(["2025-03", "2025-04"]);
  });
});

describe("listTransactions", () => {
  let db: Db;
  beforeEach(() => {
    db = handBuiltLedger();
  });
  const names = (filter: Parameters<typeof listTransactions>[1]) =>
    listTransactions(db, filter).map((t) => t.description);

  it("returns every row newest first", () => {
    const rows = listTransactions(db);
    expect(rows).toHaveLength(13);
    const dates = rows.map((r) => r.date);
    expect(dates).toEqual([...dates].sort().reverse());
    expect(rows[0]).toMatchObject({ description: "מתנה לחבר", excluded: true, note: "Birthday present", flow: "excluded" });
  });

  it("filters by date range and account", () => {
    expect(names({ from: "2026-03-10", to: "2026-03-15" })).toEqual([
      "ישראכרט 9999",
      "זיכוי חנות בגדים",
      "חיוב לכרטיס ויזה 4321",
    ]);
    expect(listTransactions(db, { accountIds: [accountId(db, "visaCal", "4321")] })).toHaveLength(7);
    expect(listTransactions(db, { accountIds: [] })).toHaveLength(13);
  });

  it("filters by category: a parent includes its children, null is uncategorized", () => {
    expect(names({ categoryIds: [null] })).toEqual(["מתנה לחבר", "ישראכרט 9999", "חיוב לכרטיס ויזה 4321"]);
    expect(names({ categoryIds: [categoryId(db, "Food")] })).toEqual([
      "מסעדה",
      "סופר שכונתי",
      "קפה הפינה",
      "סופר שכונתי",
    ]);
    expect(listTransactions(db, { categoryIds: [categoryId(db, "Groceries"), null] })).toHaveLength(5);
  });

  it("filters by flow and by needing review", () => {
    expect(names({ flows: ["internal"] })).toEqual(["חיוב לכרטיס ויזה 4321"]);
    expect(names({ flows: ["refund", "income"] })).toEqual(["זיכוי חנות בגדים", "משכורת מרץ", "משכורת פברואר"]);
    expect(listTransactions(db, { needsReview: true })).toEqual([
      expect.objectContaining({ description: "ישראכרט 9999", flags: ["uncategorized", "possible_card_bill"] }),
    ]);
    expect(listTransactions(db, { needsReview: false })).toHaveLength(12);
  });

  it("searches description, memo and note, with wildcards taken literally", () => {
    expect(names({ search: "סופר" })).toEqual(["סופר שכונתי", "סופר שכונתי"]);
    expect(names({ search: "birthday" })).toEqual(["מתנה לחבר"]);
    expect(names({ search: "%" })).toEqual([]);
    expect(names({ search: "_" })).toEqual([]);
    expect(listTransactions(db, { search: "   " })).toHaveLength(13);
  });

  it("returns installments, pending status and amounts as stored", () => {
    const db2 = newDb();
    ingest(
      db2,
      [
        card("4321", [
          txn({
            date: "2026-03-01",
            amount: -33333,
            description: "חנות רהיטים",
            installment: { number: 2, total: 6 },
            originalAmount: -9000,
            originalCurrency: "USD",
            status: "pending",
          }),
        ]),
      ],
      { now: NOW },
    );
    expect(listTransactions(db2)).toEqual([
      expect.objectContaining({
        amount: -33333,
        originalAmount: -9000,
        originalCurrency: "USD",
        status: "pending",
        installment: { number: 2, total: 6 },
        categoryId: null,
        categorySource: null,
        excluded: false,
        flow: "spending",
        flags: ["uncategorized"],
      }),
    ]);
  });

  it("rejects a malformed filter", () => {
    expect(() => listTransactions(db, { flows: ["nope" as never] })).toThrow("BAD_REQUEST");
    expect(() => listTransactions(db, { from: "yesterday" })).toThrow("BAD_REQUEST");
    expect(() => listTransactions(db, { accountIds: [1.5] })).toThrow("BAD_REQUEST");
    expect(() => listTransactions(db, { categoryIds: ["1" as never] })).toThrow("BAD_REQUEST");
  });
});

describe("updateTransactions", () => {
  let db: Db;
  beforeEach(() => {
    db = newDb();
    ingest(
      db,
      [bank([txn({ date: "2026-03-01", amount: -100, description: "א" }), txn({ date: "2026-03-02", amount: -200, description: "ב" })])],
      { now: NOW },
    );
  });

  it("sets the category as the user's and counts each row once", () => {
    const [a, b] = [idOf(db, "א"), idOf(db, "ב")];
    const groceries = categoryId(db, "Groceries");
    expect(updateTransactions(db, [a, b, a, 999], { categoryId: groceries })).toEqual({ updated: 2 });
    expect(stored(db, a)).toMatchObject({ category_id: groceries, category_source: "user" });
    updateTransactions(db, [a], { categoryId: null });
    expect(stored(db, a)).toMatchObject({ category_id: null, category_source: "user" });
  });

  it("changes only the fields in the patch", () => {
    const a = idOf(db, "א");
    updateTransactions(db, [a], { categoryId: categoryId(db, "Groceries") });
    updateTransactions(db, [a], { note: "note" });
    expect(stored(db, a)).toMatchObject({ note: "note", category_source: "user", excluded: 0 });
    expect(updateTransactions(db, [a], {})).toEqual({ updated: 0 });
  });

  it("rejects an unknown category or bad ids and changes nothing", () => {
    const a = idOf(db, "א");
    const before = stored(db, a);
    expect(() => updateTransactions(db, [a], { categoryId: 99999 })).toThrow("BAD_REQUEST");
    expect(() => updateTransactions(db, [0], { note: "x" })).toThrow("BAD_REQUEST");
    expect(() => updateTransactions(db, [a], { excluded: "yes" as never })).toThrow("BAD_REQUEST");
    expect(stored(db, a)).toEqual(before);
  });
});

describe("listCategories", () => {
  it("returns the seeded two-level tree, each parent followed by its children", () => {
    const db = newDb();
    const cats = listCategories(db);
    expect(cats).toHaveLength(31);
    const byId = new Map(cats.map((c) => [c.id, c]));
    for (const c of cats) {
      expect(c.emoji, c.name).toBeTruthy();
      expect(c.color, c.name).toMatch(/^#[0-9A-F]{6}$/);
      expect(c.archived).toBe(false);
      if (c.parentId === null) continue;
      const parent = byId.get(c.parentId);
      expect(parent?.parentId, c.name).toBeNull();
      expect(parent?.kind, c.name).toBe(c.kind);
    }
    expect(cats.slice(0, 4).map((c) => c.name)).toEqual(["Food", "Groceries", "Restaurants", "Coffee & Cafes"]);
    expect(cats.filter((c) => c.parentId === null && c.kind === "expense")).toHaveLength(6);
    expect(cats.slice(-4).map((c) => [c.name, c.kind])).toEqual([
      ["Salary", "income"],
      ["Freelance & Side Income", "income"],
      ["Investment Income", "income"],
      ["Refunds & Reimbursements", "income"],
    ]);
  });
});

describe("summary input", () => {
  it("rejects a malformed month or month count", () => {
    const db = newDb();
    expect(() => monthSummary(db, "2026-13")).toThrow("BAD_REQUEST");
    expect(() => monthSummary(db, "March")).toThrow("BAD_REQUEST");
    expect(() => trend(db, 0)).toThrow("BAD_REQUEST");
    expect(() => trend(db, 1.5)).toThrow("BAD_REQUEST");
  });
});
