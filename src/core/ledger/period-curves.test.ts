// Category curves over a month's days (period.ts `periodCurves`), read one
// point per day. The month-only `summary:curves` channel is gone (spec 25);
// these cases now run through the period function it wrapped.

import { beforeEach, describe, expect, it } from "vitest";
import type { Agorot, IsoDate, IsoMonth } from "@shared/types";
import type { Db } from "../db";
import { NOW, bank, card, categoryId, charge, idOf, newDb, txn } from "../testing/ledger";
import { ingest } from "./ingest";
import { MAX_SUMMED, monthRange, periodCurveSum, periodCurves, periodTrendWithAverage } from "./period";
import { listTransactions, monthSummary, updateTransactions } from "./queries";

type DayPoint = { date: IsoDate; amount: Agorot };

/** A month's curves with a point per day, this month and the one before. */
function categoryCurves(db: Db, args: { month: IsoMonth; categoryIds: (number | null)[] }, opts: { now?: Date } = {}) {
  const days = (points: { from: IsoDate; amount: Agorot }[]): DayPoint[] => points.map((p) => ({ date: p.from, amount: p.amount }));
  return periodCurves(db, { ...monthRange(args.month), categoryIds: args.categoryIds }, opts).map((c) => ({
    categoryId: c.categoryId,
    byDay: days(c.series),
    previousByDay: days(c.previous),
  }));
}

// A hand-built ledger. Expected curves below are worked out by hand.
//
// Card 4321 (credit)
//   02-10   -7,000 groceries     billed 03-10   Groceries (February)
//   03-02  -10,000 groceries     billed 04-10   Groceries
//   03-02   -5,000 restaurant    billed 04-10   Restaurants
//   03-05   -3,000 food stall    billed 04-10   Food itself (top level)
//   03-07   +2,000 refund        billed 04-10   Groceries, a refund
//   03-10   -4,000 shop          billed 04-10   uncategorized
//   03-12  -99,900 gift          billed 04-10   Groceries, excluded by the user
//   03-15   -1,850 pending cafe, gone after the next download (uncategorized)
// Bank
//   03-10   -7,000 bill for card 4321          internal, categorized Groceries by hand
//   03-20  -20,000 ATM                         Cash & ATM
const LATER = new Date("2026-04-02T08:00:00Z");

function ledger(): Db {
  const db = newDb();
  const completed = [
    charge("2026-02-10", -7000, "סופר פברואר", "2026-03-10"),
    charge("2026-03-02", -10000, "סופר שכונתי", "2026-04-10"),
    charge("2026-03-02", -5000, "מסעדה", "2026-04-10"),
    charge("2026-03-05", -3000, "דוכן אוכל", "2026-04-10"),
    charge("2026-03-07", 2000, "זיכוי סופר", "2026-04-10"),
    charge("2026-03-10", -4000, "חנות לא ידועה", "2026-04-10"),
    charge("2026-03-12", -99900, "מתנה לחבר", "2026-04-10"),
  ];
  const cafe = txn({ date: "2026-03-15", amount: -1850, description: "קפה נעלם", status: "pending" });
  ingest(db, [card("4321", [...completed, cafe])], { now: NOW });
  ingest(db, [card("4321", completed)], { now: LATER, since: "2026-02-01" });
  ingest(
    db,
    [
      bank([
        txn({ date: "2026-03-10", amount: -7000, description: "חיוב לכרטיס ויזה 4321" }),
        txn({ date: "2026-03-20", amount: -20000, description: "כספומט" }),
      ]),
    ],
    { now: LATER },
  );
  const set = (description: string, category: string) =>
    updateTransactions(db, [idOf(db, description)], { categoryId: categoryId(db, category) });
  set("סופר פברואר", "Groceries");
  set("סופר שכונתי", "Groceries");
  set("מסעדה", "Restaurants");
  set("דוכן אוכל", "Food");
  set("זיכוי סופר", "Groceries");
  set("מתנה לחבר", "Groceries");
  set("חיוב לכרטיס ויזה 4321", "Groceries");
  set("כספומט", "Cash & ATM");
  updateTransactions(db, [idOf(db, "מתנה לחבר")], { excluded: true });
  return db;
}

/** The curve's value on each listed day of the month (1-based). */
function on(points: DayPoint[] | undefined, ...days: number[]): number[] {
  return days.map((d) => points?.[d - 1]?.amount ?? Number.NaN);
}

describe("periodCurves over a month", () => {
  let db: Db;
  beforeEach(() => {
    db = ledger();
  });

  it("the ledger is what the comments say", () => {
    const flows = Object.fromEntries(listTransactions(db).map((t) => [t.description, t.flow]));
    expect(flows).toMatchObject({
      "זיכוי סופר": "refund",
      "מתנה לחבר": "excluded",
      "קפה נעלם": "gone",
      "חיוב לכרטיס ויזה 4321": "internal",
    });
  });

  it("is cumulative per day over every day of the month", () => {
    const [groceries] = categoryCurves(db, { month: "2026-03", categoryIds: [categoryId(db, "Groceries")] });
    expect(groceries?.byDay).toHaveLength(31);
    expect(groceries?.byDay[0]).toEqual({ date: "2026-03-01", amount: 0 });
    expect(groceries?.byDay[30]?.date).toBe("2026-03-31");
    // 10,000 on the 2nd, a 2,000 refund on the 7th; the excluded gift and
    // the internal card bill do not count.
    expect(on(groceries?.byDay, 1, 2, 6, 7, 10, 12, 31)).toEqual([0, 10000, 10000, 8000, 8000, 8000, 8000]);
  });

  it("a top-level category includes its subcategories and its own rows", () => {
    const [food] = categoryCurves(db, { month: "2026-03", categoryIds: [categoryId(db, "Food")] });
    expect(on(food?.byDay, 1, 2, 5, 7, 31)).toEqual([0, 15000, 18000, 16000, 16000]);
  });

  it("null is uncategorized, without the gone or excluded rows", () => {
    const [none] = categoryCurves(db, { month: "2026-03", categoryIds: [null] });
    expect(none?.categoryId).toBeNull();
    expect(on(none?.byDay, 9, 10, 15, 31)).toEqual([0, 4000, 4000, 4000]);
  });

  it("gives last month for comparison, over that month's own days", () => {
    const [food] = categoryCurves(db, { month: "2026-03", categoryIds: [categoryId(db, "Food")] });
    expect(food?.previousByDay).toHaveLength(28);
    expect(food?.previousByDay[0]?.date).toBe("2026-02-01");
    expect(on(food?.previousByDay, 9, 10, 28)).toEqual([0, 7000, 7000]);
  });

  it("answers in the order asked and agrees with the month summary", () => {
    const ids = monthSummary(db, "2026-03").byParent.map((p) => p.categoryId);
    const curves = categoryCurves(db, { month: "2026-03", categoryIds: ids });
    expect(curves.map((c) => c.categoryId)).toEqual(ids);
    const ends = curves.map((c) => c.byDay.at(-1)?.amount);
    expect(ends).toEqual(monthSummary(db, "2026-03").byParent.map((p) => p.amount));
  });

  it("an empty month is all zeros, and no categories is no curves", () => {
    const [food] = categoryCurves(db, { month: "2025-06", categoryIds: [categoryId(db, "Food")] });
    expect(food?.byDay).toHaveLength(30);
    expect(food?.byDay.every((p) => p.amount === 0)).toBe(true);
    expect(food?.previousByDay.every((p) => p.amount === 0)).toBe(true);
    expect(categoryCurves(db, { month: "2026-03", categoryIds: [] })).toEqual([]);
  });

  it("rejects malformed requests with BAD_REQUEST", () => {
    const bad = [
      { month: "2026-03", categoryIds: [0] },
      { month: "2026-03", categoryIds: ["1"] },
      { month: "2026-03", categoryIds: null },
      { month: "2026-03", categoryIds: Array(31).fill(null) },
    ];
    for (const args of bad) {
      expect(() => categoryCurves(db, args as never)).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    }
    expect(() => periodCurves(db, null as never)).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
  });
});

describe("periodCurveSum: chosen categories as one curve (spec 38)", () => {
  let db: Db;
  beforeEach(() => {
    db = ledger();
  });
  const march = monthRange("2026-03");
  // Early April: February and March are the average months.
  const opts = { now: LATER };
  const amounts = (points: { amount: Agorot }[] | undefined) => (points ?? []).map((p) => p.amount);
  /** Several lines added up point by point. */
  const added = (lines: ({ amount: Agorot }[] | undefined)[]) =>
    amounts(lines[0]).map((_, i) => lines.reduce((sum, line) => sum + (line?.[i]?.amount ?? 0), 0));

  it("equals the single curves added up for categories that do not overlap, previous and average too", () => {
    const ids = [categoryId(db, "Groceries"), categoryId(db, "Restaurants"), null, categoryId(db, "Cash & ATM")];
    const sum = periodCurveSum(db, { ...march, categoryIds: ids }, opts);
    const singles = periodCurves(db, { ...march, categoryIds: ids }, opts);
    expect(sum.categoryIds).toEqual(ids);
    expect(sum.bucket).toBe("day");
    expect(amounts(sum.series)).toEqual(added(singles.map((c) => c.series)));
    expect(amounts(sum.previous)).toEqual(added(singles.map((c) => c.previous)));
    expect(sum.average).toMatchObject({ from: "2026-02", to: "2026-03", count: 2 });
    expect(amounts(sum.average?.series)).toEqual(added(singles.map((c) => c.average?.series)));
    // 10,000 + 5,000 on the 2nd, -2,000 on the 7th, 4,000 on the 10th, 20,000 on the 20th.
    expect(on(sum.series.map((p) => ({ date: p.from, amount: p.amount })), 1, 2, 7, 10, 20, 31)).toEqual([0, 15000, 13000, 17000, 37000, 37000]);
  });

  it("a parent and its child together count each row once", () => {
    const food = categoryId(db, "Food");
    const both = periodCurveSum(db, { ...march, categoryIds: [categoryId(db, "Groceries"), food] }, opts);
    const [alone] = periodCurves(db, { ...march, categoryIds: [food] }, opts);
    expect(both.series).toEqual(alone?.series);
    expect(both.previous).toEqual(alone?.previous);
    expect(both.average).toEqual(alone?.average);
  });

  it("takes uncategorized in the list, and ends on the bars' average for the same categories", () => {
    const groceries = categoryId(db, "Groceries");
    const sum = periodCurveSum(db, { ...march, categoryIds: [null, groceries] }, opts);
    // Groceries 8,000 and the 4,000 unknown shop; the gone cafe does not count.
    expect(sum.series.at(-1)?.amount).toBe(12000);
    const bars = periodTrendWithAverage(db, { from: "2025-04-01", to: "2026-03-31", categoryIds: [null, groceries] }, opts).average;
    expect(sum.average?.series.at(-1)?.amount).toBe(bars?.amount);
  });

  it("stops this period at today, like the single curves", () => {
    const mid = { now: new Date("2026-03-10T09:00:00Z") };
    const sum = periodCurveSum(db, { ...march, categoryIds: [categoryId(db, "Food")] }, mid);
    expect(sum.series).toHaveLength(10);
    expect(sum.previous).toHaveLength(28);
  });

  it("rejects an empty list, more than 500 ids, repeats and bad ids", () => {
    const bad = [[], Array.from({ length: MAX_SUMMED + 1 }, (_, i) => i + 1), [3, 3], [null, null], [0], ["1"], null];
    for (const categoryIds of bad) {
      expect(() => periodCurveSum(db, { ...march, categoryIds } as never)).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
    }
    const many = Array.from({ length: MAX_SUMMED }, (_, i) => i + 1);
    expect(periodCurveSum(db, { ...march, categoryIds: many }, opts).series).toHaveLength(31);
  });
});
