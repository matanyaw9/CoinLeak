import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../db";
import { NOW, accountId, bank, card, categoryId, charge, countRows, idOf, idsOf, newDb, snapshot, stored, txn } from "../testing/ledger";
import { ingest } from "./ingest";
import {
  emptyTrash,
  listCategories,
  listTransactions,
  monthSummary,
  restoreTransactions,
  trashTransactions,
  trend,
  updateTransactions,
} from "./queries";
import { createRule } from "../rules";
import { ruleInput } from "../testing/rules";

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

  it("March by parent rolls children up to top-level categories", () => {
    const march = monthSummary(db, "2026-03");
    const cats = listCategories(db);
    const parentOf = (id: number | null) => (id === null ? null : (cats.find((c) => c.id === id)?.parentId ?? id));
    const expected = new Map<number | null, number>();
    for (const c of march.byCategory) {
      const key = parentOf(c.categoryId);
      expected.set(key, (expected.get(key) ?? 0) + c.amount);
    }
    expect(new Map(march.byParent.map((p) => [p.categoryId, p.amount]))).toEqual(expected);
    expect(march.byParent.every((p) => p.categoryId === null || parentOf(p.categoryId) === p.categoryId)).toBe(true);
    expect(march.byParent.reduce((s, p) => s + p.amount, 0)).toBe(march.spending);
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

  it("names the rule that set a row, and no rule on rows the user set", () => {
    expect(listTransactions(db).every((t) => t.ruleId === null)).toBe(true);
    const cards = createRule(db, ruleInput({ matchText: "ישראכרט", setCategoryId: categoryId(db, "Shopping") }));
    createRule(db, ruleInput({ matchText: "סופר", setCategoryId: categoryId(db, "Groceries") }));
    const byName = (d: string) => listTransactions(db, { search: d });
    expect(byName("ישראכרט")).toEqual([expect.objectContaining({ ruleId: cards.id, categorySource: "rule" })]);
    expect(byName("סופר").map((t) => [t.ruleId, t.categorySource])).toEqual([
      [null, "user"],
      [null, "user"],
    ]);
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

  // spec 17: sorting and the filters that came with it.
  it("sorts by amount size either way, ties newest id first", () => {
    const desc = listTransactions(db, { sort: "amount_desc" });
    expect(desc.map((t) => Math.abs(t.amount))).toEqual([
      1500000, 1400000, 450000, 99900, 35000, 20000, 20000, 12345, 12000, 10000, 8000, 5000, 3000,
    ]);
    // ATM (bank, added after the card) and the card's 02-12 groceries tie at 200.
    expect(desc.slice(5, 7).map((t) => t.description)).toEqual(["כספומט", "סופר שכונתי"]);
    const asc = listTransactions(db, { sort: "amount_asc" });
    expect(asc.map((t) => Math.abs(t.amount))).toEqual(desc.map((t) => Math.abs(t.amount)).reverse());
    expect(asc.slice(6, 8).map((t) => t.description)).toEqual(["כספומט", "סופר שכונתי"]);
    expect(listTransactions(db, { sort: "date" })).toEqual(listTransactions(db));
  });

  it("sorts by name: Hebrew then English, natural numbers, case and spaces ignored, ties newest id first", () => {
    const db2 = newDb();
    const at = (description: string) => txn({ date: "2026-03-01", amount: -100, description });
    ingest(
      db2,
      [bank(["zeta", "  Apple", "שופרסל", "אלון", "Shop 10", "Shop 9", "apple", "בית"].map(at))],
      { now: NOW },
    );
    const rows = listTransactions(db2, { sort: "name" });
    expect(rows.map((t) => t.description.trim())).toEqual([
      "אלון",
      "בית",
      "שופרסל",
      "apple",
      "Apple",
      "Shop 9",
      "Shop 10",
      "zeta",
    ]);
    expect(rows[3]?.id ?? 0).toBeGreaterThan(rows[4]?.id ?? 0);
  });

  it("filters pending rows or settled rows", () => {
    expect(names({ pending: true })).toEqual(["מסעדה"]);
    expect(listTransactions(db, { pending: false })).toHaveLength(12);
  });

  it("combines every filter with search and sort", () => {
    const food = categoryId(db, "Food");
    const card4321 = accountId(db, "visaCal", "4321");
    expect(names({ search: "סופר", categoryIds: [food], sort: "amount_desc" })).toEqual(["סופר שכונתי", "סופר שכונתי"]);
    expect(listTransactions(db, { search: "סופר", sort: "amount_desc" }).map((t) => t.amount)).toEqual([-20000, -8000]);
    expect(names({ search: "חנות", flows: ["refund"] })).toEqual(["זיכוי חנות בגדים"]);
    expect(names({ search: "משכורת", accountIds: [card4321] })).toEqual([]);
    expect(names({ search: "מסעדה", pending: true })).toEqual(["מסעדה"]);
    expect(names({ search: "סופר", pending: true })).toEqual([]);
    expect(names({ search: "9999", needsReview: true })).toEqual(["ישראכרט 9999"]);
    expect(names({ search: "חיוב", hideInternal: true })).toEqual([]);
    expect(names({ search: "מתנה", flows: ["excluded"], categoryIds: [null], accountIds: [card4321], sort: "name" })).toEqual([
      "מתנה לחבר",
    ]);
  });

  it("rejects a malformed filter", () => {
    expect(() => listTransactions(db, { sort: "random" as never })).toThrow("BAD_REQUEST");
    expect(() => listTransactions(db, { pending: "yes" as never })).toThrow("BAD_REQUEST");
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
    expect(() => updateTransactions(db, [a], { note: "x", excludedSource: "rule" })).toThrow("BAD_REQUEST");
    expect(() => updateTransactions(db, [a], { excluded: true, excludedSource: "bank" as never })).toThrow(
      "BAD_REQUEST",
    );
    expect(stored(db, a)).toEqual(before);
  });
});

describe("undo Ignore (spec 13)", () => {
  const exclusion = (db: Db, id: number) => {
    const r = stored(db, id);
    return { excluded: r.excluded, excluded_source: r.excluded_source, rule_id: r.rule_id };
  };

  it("restores each row's previous excluded and excluded_source exactly", () => {
    const db = newDb();
    ingest(
      db,
      [
        bank([
          txn({ date: "2026-03-01", amount: -100, description: "never excluded" }),
          txn({ date: "2026-03-02", amount: -200, description: "counted by a rule" }),
          txn({ date: "2026-03-03", amount: -300, description: "counted by the user" }),
        ]),
      ],
      { now: NOW },
    );
    createRule(db, ruleInput({ matchText: "counted by a rule", setExcluded: false }));
    const [plain, ruled, user] = ["never excluded", "counted by a rule", "counted by the user"].map((d) => idOf(db, d));
    updateTransactions(db, [user as number], { excluded: false });
    const ids = [plain, ruled, user] as number[];
    const before = ids.map((id) => exclusion(db, id));

    const ignore = updateTransactions(db, ids, { excluded: true });
    expect(ignore.before).toEqual([
      { id: plain, excluded: false, excludedSource: null },
      { id: ruled, excluded: false, excludedSource: "rule" },
      { id: user, excluded: false, excludedSource: "user" },
    ]);
    // What the window's Undo sends: one call per previous state.
    for (const state of ignore.before ?? []) {
      updateTransactions(db, [state.id], { excluded: state.excluded, excludedSource: state.excludedSource });
    }
    expect(ids.map((id) => exclusion(db, id))).toEqual(before);
  });

  it("a row handed back to the rules can be excluded by a rule again", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-03-01", amount: -100, description: "העברה לחיסכון" })])], { now: NOW });
    const id = idOf(db, "העברה לחיסכון");
    const ignore = updateTransactions(db, [id], { excluded: true });
    updateTransactions(db, [id], { excluded: false, excludedSource: ignore.before?.[0]?.excludedSource ?? null });
    const rule = createRule(db, ruleInput({ matchText: "העברה", setExcluded: true }));
    expect(exclusion(db, id)).toEqual({ excluded: 1, excluded_source: "rule", rule_id: rule.id });
  });

  it("restores a rule's exclusion after Count again", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-03-01", amount: -100, description: "העברה לחיסכון" })])], { now: NOW });
    const rule = createRule(db, ruleInput({ matchText: "העברה", setExcluded: true }));
    const id = idOf(db, "העברה לחיסכון");
    const count = updateTransactions(db, [id], { excluded: false });
    expect(exclusion(db, id)).toMatchObject({ excluded: 0, excluded_source: "user" });
    const [state] = count.before ?? [];
    updateTransactions(db, [id], { excluded: state?.excluded ?? true, excludedSource: state?.excludedSource ?? null });
    expect(exclusion(db, id)).toEqual({ excluded: 1, excluded_source: "rule", rule_id: rule.id });
  });
});

describe("listCategories", () => {
  it("returns the seeded two-level tree, each parent followed by its children", () => {
    const db = newDb();
    const cats = listCategories(db);
    expect(cats).toHaveLength(39); // 31 from 0002, 3 transfer from 0006, 5 from 0009
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

describe("trash (spec 11)", () => {
  const LATER = new Date("2026-04-01T10:00:00Z");

  it("a trashed row counts nowhere, needs no review, and leaves the list", () => {
    const db = handBuiltLedger();
    const before = monthSummary(db, "2026-03");
    const atm = idOf(db, "כספומט");
    const untracked = idOf(db, "ישראכרט 9999");
    expect(trashTransactions(db, [atm, untracked, atm], LATER)).toEqual({ updated: 2 });

    const after = monthSummary(db, "2026-03");
    expect(after.spending).toBe(before.spending - 20000 - 12345);
    expect(after.income).toBe(before.income);
    expect(after.needsReview).toBe(before.needsReview - 1);
    expect(after.byCategory.find((c) => c.categoryId === categoryId(db, "Cash & ATM"))).toBeUndefined();
    expect(trend(db, 1, { now: NOW })[0]?.spending).toBe(after.spending);

    const listed = listTransactions(db).map((t) => t.id);
    expect(listed).not.toContain(atm);
    expect(listTransactions(db, { needsReview: true }).map((t) => t.id)).not.toContain(untracked);
    const trashed = listTransactions(db, { flows: ["trashed"] });
    expect(trashed.map((t) => t.id).sort()).toEqual([atm, untracked].sort());
    expect(trashed.every((t) => t.flow === "trashed" && t.flags.length === 0)).toBe(true);
    expect(stored(db, atm).trashed_at).toBe(LATER.toISOString());
  });

  it("restore brings the totals and the row back exactly", () => {
    const db = handBuiltLedger();
    const before = monthSummary(db, "2026-03");
    const rows = listTransactions(db);
    const ids = [idOf(db, "כספומט"), idOf(db, "מתנה לחבר"), idOf(db, "חיוב לכרטיס ויזה 4321"), idOf(db, "חנות בגדים")];
    trashTransactions(db, ids, LATER);
    expect(monthSummary(db, "2026-03")).not.toEqual(before);
    expect(restoreTransactions(db, [...ids, idOf(db, "שכר דירה")], LATER)).toEqual({ updated: 4 });
    expect(monthSummary(db, "2026-03")).toEqual(before);
    expect(listTransactions(db)).toEqual(rows);
    expect(listTransactions(db, { flows: ["trashed"] })).toEqual([]);
  });

  it("emptyTrash deletes only trashed rows", () => {
    const db = handBuiltLedger();
    const total = countRows(db);
    const ids = [idOf(db, "כספומט"), idOf(db, "קפה הפינה")];
    trashTransactions(db, ids, LATER);
    const kept = snapshot(db).filter((r) => !ids.includes(r.id as number));
    expect(emptyTrash(db)).toEqual({ deleted: 2 });
    expect(countRows(db)).toBe(total - 2);
    expect(snapshot(db)).toEqual(kept);
    expect(emptyTrash(db)).toEqual({ deleted: 0 });
  });

  it("ingesting the same download after emptying the Trash adds nothing (spec 14)", () => {
    const download = () =>
      bank([
        txn({ date: "2026-03-01", amount: -4000, description: "מכולת" }),
        txn({ date: "2026-03-01", amount: -4000, description: "מכולת" }),
        txn({ date: "2026-03-02", amount: -9000, description: "דלק", status: "pending" }),
      ]);
    const db = newDb();
    ingest(db, [download()], { now: NOW });
    const [first, second] = idsOf(db, "מכולת") as [number, number];
    trashTransactions(db, [second, idOf(db, "דלק")], LATER);
    expect(emptyTrash(db, LATER)).toEqual({ deleted: 2 });
    const kept = snapshot(db);

    expect(ingest(db, [download()], { now: LATER })).toMatchObject({ newRows: 0, updatedRows: 0 });
    expect(snapshot(db)).toEqual(kept);
    expect(idsOf(db, "מכולת")).toEqual([first]);
    // A third identical row is a new purchase, not the emptied one.
    const more = bank([...download().transactions, txn({ date: "2026-03-01", amount: -4000, description: "מכולת" })]);
    expect(ingest(db, [more], { now: LATER })).toMatchObject({ newRows: 1 });
  });

  it("a card row the user decided a bank line pays can still be trashed and emptied", () => {
    const db = newDb();
    ingest(db, [card("4321", [charge("2026-03-03", -4500, "מאפייה", "2026-03-04")])], { now: NOW });
    ingest(db, [bank([txn({ date: "2026-03-04", amount: -4500, description: "חיוב לכרטיס ויזה 4321" })])], { now: NOW });
    const bill = idOf(db, "חיוב לכרטיס ויזה 4321");
    const bakery = idOf(db, "מאפייה");
    db.prepare("UPDATE transactions SET card_bill_txn_id = ? WHERE id = ?").run(bakery, bill);
    trashTransactions(db, [bakery], LATER);
    expect(emptyTrash(db)).toEqual({ deleted: 1 });
    expect(stored(db, bill).card_bill_txn_id).toBeNull();
  });

  it("refuses bad ids", () => {
    const db = handBuiltLedger();
    expect(() => trashTransactions(db, [0])).toThrow();
    expect(() => restoreTransactions(db, ["1" as unknown as number])).toThrow();
    expect(trashTransactions(db, [])).toEqual({ updated: 0 });
  });
});

describe("listTransactions hides rows (spec 11)", () => {
  it("hides internal rows only when asked", () => {
    const db = handBuiltLedger();
    const bill = idOf(db, "חיוב לכרטיס ויזה 4321");
    expect(listTransactions(db).map((t) => t.id)).toContain(bill);
    const hidden = listTransactions(db, { hideInternal: true });
    expect(hidden.map((t) => t.id)).not.toContain(bill);
    expect(hidden).toHaveLength(listTransactions(db).length - 1);
    expect(listTransactions(db, { hideInternal: false }).map((t) => t.id)).toContain(bill);
    expect(() => listTransactions(db, { hideInternal: "yes" as unknown as boolean })).toThrow();
  });

  it("shows trashed rows only when flows asks for them, alone or with others", () => {
    const db = handBuiltLedger();
    const atm = idOf(db, "כספומט");
    trashTransactions(db, [atm]);
    expect(listTransactions(db, { flows: ["spending"] }).map((t) => t.id)).not.toContain(atm);
    expect(listTransactions(db, { search: "כספומט" })).toEqual([]);
    expect(listTransactions(db, { flows: ["spending", "trashed"] }).map((t) => t.id)).toContain(atm);
  });
});
