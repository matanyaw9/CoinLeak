import { beforeAll, describe, expect, it } from "vitest";
import type { DateRange, TransactionFilter, TransactionRow } from "@shared/types";
import type { Db } from "../db";
import { NOW, bank, card, categoryId, charge, idOf, newDb, txn } from "../testing/ledger";
import { ingest } from "./ingest";
import { groupFlow, periodFlow } from "./money-flow";
import {
  bucketFor,
  bucketsOf,
  compareSpending,
  monthRange,
  periodCurves,
  periodSummary,
  periodTrend,
  previousRange,
  thisMonth,
} from "./period";
import {
  dayTotals,
  listCategories,
  listTransactions,
  listTransactionsWithDays,
  monthSummary,
  trashTransactions,
  trend,
  updateTransactions,
} from "./queries";

// A hand-built ledger over four months. Totals below are worked out by hand.
//
// Bank
//   2025-12-01  +1,000,000 salary              income
//   2025-12-22    -300,000 rent                spending, Bills & Utilities
//   2026-01-01  +1,000,000 salary              income
//   2026-01-05    -200,000 savings deposit     transfer
//   2026-02-01    +400,000 salary              income (February is overspent)
//   2026-02-03    -450,000 rent                spending
//   2026-03-01  +1,000,000 salary              income
//   2026-03-10     -15,000 bill for card 4321  internal (pays the two Feb rows)
// Card 4321 (credit)
//   2025-12-30   -5,000 coffee      Coffee & Cafes
//   2026-02-15   -6,000 groceries   Groceries, billed 03-10
//   2026-02-20   -9,000 restaurant  Restaurants, billed 03-10
//   2026-03-12   -4,000 groceries   Groceries
//   2026-03-14   +1,000 refund      Groceries
//   2026-03-18   -2,500 restaurant  Restaurants
//   2026-03-19   -8,000 clothes     trashed
//   2026-03-20   -3,000 gift        excluded by the user
//
//            income     spending   transfers
//   Dec   1,000,000      305,000           0
//   Jan   1,000,000            0     200,000
//   Feb     400,000      465,000           0   short by 65,000
//   Mar   1,000,000        5,500           0
const TODAY = new Date("2026-03-20T09:00:00Z");
const MONTHS = ["2025-12", "2026-01", "2026-02", "2026-03"];

function ledger(): Db {
  const db = newDb();
  ingest(
    db,
    [
      card("4321", [
        charge("2025-12-30", -5000, "קפה", "2026-01-10"),
        charge("2026-02-15", -6000, "סופר פברואר", "2026-03-10"),
        charge("2026-02-20", -9000, "מסעדה פברואר", "2026-03-10"),
        charge("2026-03-12", -4000, "סופר מרץ", "2026-04-10"),
        charge("2026-03-14", 1000, "זיכוי סופר", "2026-04-10"),
        charge("2026-03-18", -2500, "מסעדה מרץ", "2026-04-10"),
        charge("2026-03-19", -8000, "חנות בגדים", "2026-04-10"),
        charge("2026-03-20", -3000, "מתנה", "2026-04-10"),
      ]),
    ],
    { now: NOW },
  );
  ingest(
    db,
    [
      bank([
        txn({ date: "2025-12-01", amount: 1000000, description: "משכורת דצמבר" }),
        txn({ date: "2025-12-22", amount: -300000, description: "שכר דירה דצמבר" }),
        txn({ date: "2026-01-01", amount: 1000000, description: "משכורת ינואר" }),
        txn({ date: "2026-01-05", amount: -200000, description: "הפקדה לחיסכון" }),
        txn({ date: "2026-02-01", amount: 400000, description: "משכורת פברואר" }),
        txn({ date: "2026-02-03", amount: -450000, description: "שכר דירה פברואר" }),
        txn({ date: "2026-03-01", amount: 1000000, description: "משכורת מרץ" }),
        txn({ date: "2026-03-10", amount: -15000, description: "חיוב לכרטיס ויזה 4321" }),
      ]),
    ],
    { now: NOW },
  );
  const set = (description: string, category: string) =>
    updateTransactions(db, [idOf(db, description)], { categoryId: categoryId(db, category) });
  for (const d of ["משכורת דצמבר", "משכורת ינואר", "משכורת פברואר", "משכורת מרץ"]) set(d, "Salary");
  set("שכר דירה דצמבר", "Bills & Utilities");
  set("שכר דירה פברואר", "Bills & Utilities");
  set("הפקדה לחיסכון", "Savings");
  set("קפה", "Coffee & Cafes");
  set("סופר פברואר", "Groceries");
  set("סופר מרץ", "Groceries");
  set("זיכוי סופר", "Groceries");
  set("מסעדה פברואר", "Restaurants");
  set("מסעדה מרץ", "Restaurants");
  set("חנות בגדים", "Shopping");
  trashTransactions(db, [idOf(db, "חנות בגדים")]);
  updateTransactions(db, [idOf(db, "מתנה")], { excluded: true });
  return db;
}

const opts = { now: TODAY };

describe("periodSummary", () => {
  let db: Db;
  beforeAll(() => {
    db = ledger();
  });

  it("the ledger is what the comments say", () => {
    const totals = MONTHS.map((m) => {
      const s = monthSummary(db, m, opts);
      return [s.income, s.spending, s.transfers];
    });
    expect(totals).toEqual([
      [1000000, 305000, 0],
      [1000000, 0, 200000],
      [400000, 465000, 0],
      [1000000, 5500, 0],
    ]);
  });

  it("a month's range gives the month functions' numbers, every one of them", () => {
    const food = categoryId(db, "Food");
    for (const month of MONTHS) {
      const range = monthRange(month);
      const p = periodSummary(db, range, opts);
      const m = monthSummary(db, month, opts);
      expect(p).toMatchObject({
        income: m.income,
        spending: m.spending,
        transfers: m.transfers,
        needsReview: m.needsReview,
        byCategory: m.byCategory,
        byParent: m.byParent,
        bucket: "day",
      });
      expect(p.series.map((x) => ({ date: x.from, amount: x.amount }))).toEqual(m.byDay);

      const flow = periodFlow(db, range);
      expect([flow.from, flow.to]).toEqual([range.from, range.to]);
      expect([flow.income, flow.spending, flow.transfers]).toEqual([m.income, m.spending, m.transfers]);

      const curves = periodCurves(db, { ...range, categoryIds: [food] }, opts);
      expect(curves[0]?.series.at(-1)?.amount ?? 0).toBe(m.byParent.find((x) => x.categoryId === food)?.amount ?? 0);

      const { split, ...point } = periodTrend(db, range, opts).at(-1) ?? {};
      expect(point).toEqual(trend(db, 4, opts).find((t) => t.month === month));
      expect(split).toBeDefined();
    }
  });

  it("the last 7 days, against the 7 days before", () => {
    const p = periodSummary(db, { from: "2026-03-14", to: "2026-03-20" }, opts);
    expect(p).toMatchObject({ income: 0, spending: 1500, transfers: 0, bucket: "day", inProgress: true });
    expect(p.series.map((x) => x.amount)).toEqual([-1000, -1000, -1000, -1000, 1500, 1500, 1500]);
    expect(p.previous).toMatchObject({ from: "2026-03-07", to: "2026-03-13", spending: 4000, sameTime: 4000 });
  });

  it("the last 12 months, by week, against the 12 months before", () => {
    const p = periodSummary(db, { from: "2025-04-01", to: "2026-03-31" }, opts);
    expect(p).toMatchObject({ income: 3400000, spending: 775500, transfers: 200000, bucket: "week" });
    expect(p.previous).toMatchObject({ from: "2024-04-01", to: "2025-03-31", spending: 0 });
    // Stops at the week holding today, with everything spent by then.
    const last = p.series.at(-1);
    expect(last && last.from <= "2026-03-20" && last.to >= "2026-03-20").toBe(true);
    expect(last?.amount).toBe(775500);
    expect(p.previous.series.at(-1)?.to).toBe("2025-03-31");
  });

  it("a custom range across a year boundary", () => {
    const p = periodSummary(db, { from: "2025-12-20", to: "2026-01-10" }, opts);
    expect(p).toMatchObject({ income: 1000000, spending: 305000, transfers: 200000, bucket: "day", inProgress: false });
    expect(p.series).toHaveLength(22);
    expect(p.series.at(-1)).toEqual({ from: "2026-01-10", to: "2026-01-10", amount: 305000 });
    expect(p.previous).toMatchObject({ from: "2025-11-28", to: "2025-12-19", spending: 0, sameTime: 0 });
  });

  it("this month's daily series ends at today; past months are full", () => {
    const march = monthSummary(db, "2026-03", opts);
    expect(march.byDay).toHaveLength(20);
    expect(march.byDay.at(-1)).toEqual({ date: "2026-03-20", amount: 5500 });
    expect(monthSummary(db, "2026-02", opts).byDay).toHaveLength(28);
    const [curve] = periodCurves(db, { ...monthRange("2026-03"), categoryIds: [categoryId(db, "Food")] }, opts);
    expect(curve?.series).toHaveLength(20);
    expect(curve?.previous).toHaveLength(28);
    // February compared with March so far: by the 20th of February, all of it.
    expect(periodSummary(db, monthRange("2026-03"), opts).previous).toMatchObject({ spending: 465000, sameTime: 465000 });
  });

  it("rejects malformed ranges", () => {
    const bad: unknown[] = [
      null,
      { from: "2026-03-01" },
      { from: "2026-03-10", to: "2026-03-01" },
      { from: "2026-02-30", to: "2026-03-01" },
      { from: "1990-01-01", to: "2026-01-01" },
    ];
    for (const range of bad) expect(() => periodSummary(db, range as DateRange)).toThrow("BAD_REQUEST");
    expect(() => periodTrend(db, { from: "2026-01-01", to: "2026-01-31", categoryIds: [-1] })).toThrow("BAD_REQUEST");
    expect(() => groupFlow(db, { from: "2026-01-01", to: "2026-01-31", categoryId: 0 })).toThrow("BAD_REQUEST");
  });
});

describe("buckets", () => {
  const range = (from: string, to: string): DateRange => ({ from, to });

  it("day up to 62 days, week up to a year, month beyond", () => {
    expect(bucketFor(range("2026-01-01", "2026-03-03"))).toBe("day"); // 62 days
    expect(bucketFor(range("2026-01-01", "2026-03-04"))).toBe("week"); // 63
    expect(bucketFor(range("2024-01-01", "2024-12-31"))).toBe("week"); // 366
    expect(bucketFor(range("2024-01-01", "2025-01-01"))).toBe("month"); // 367
  });

  it("weeks run from the first day; months are calendar months; the last may be short", () => {
    expect(bucketsOf(range("2026-01-01", "2026-01-17"), "week")).toEqual([
      range("2026-01-01", "2026-01-07"),
      range("2026-01-08", "2026-01-14"),
      range("2026-01-15", "2026-01-17"),
    ]);
    expect(bucketsOf(range("2025-12-15", "2026-02-10"), "month")).toEqual([
      range("2025-12-15", "2025-12-31"),
      range("2026-01-01", "2026-01-31"),
      range("2026-02-01", "2026-02-10"),
    ]);
  });

  it("the period before is whole months for whole months, else the same days", () => {
    expect(previousRange(range("2026-03-01", "2026-03-31"))).toEqual(range("2026-02-01", "2026-02-28"));
    expect(previousRange(range("2026-01-01", "2026-12-31"))).toEqual(range("2025-01-01", "2025-12-31"));
    expect(previousRange(range("2026-03-14", "2026-03-20"))).toEqual(range("2026-03-07", "2026-03-13"));
  });
});

describe("periodFlow: spending beyond income", () => {
  let db: Db;
  beforeAll(() => {
    db = ledger();
  });

  it("an overspent month has no savings node; the shortfall is spending plus transfers minus income", () => {
    const flow = periodFlow(db, monthRange("2026-02"));
    expect(flow.shortfall).toBe(flow.spending + flow.transfers - flow.income);
    expect(flow.shortfall).toBe(65000);
    expect(flow.nodes.map((n) => n.kind)).toEqual(["income", "beyond_income", "hub", "spending", "spending"]);
    expect(flow.nodes.find((n) => n.kind === "beyond_income")?.amount).toBe(65000);
    expect(flow.nodes.some((n) => n.kind === "from_savings")).toBe(false);
  });

  it("a balanced month has no shortfall", () => {
    for (const month of ["2025-12", "2026-01", "2026-03"]) {
      const flow = periodFlow(db, monthRange(month));
      expect(flow.shortfall).toBe(0);
      expect(flow.nodes.some((n) => n.kind === "beyond_income")).toBe(false);
    }
  });

  it("over several months, only the net shortfall counts", () => {
    const flow = periodFlow(db, { from: "2025-12-01", to: "2026-03-31" });
    expect(flow.shortfall).toBe(0);
    expect(flow.nodes.find((n) => n.kind === "left")?.amount).toBe(3400000 - 775500 - 200000);
  });
});

describe("groupFlow", () => {
  let db: Db;
  beforeAll(() => {
    db = ledger();
  });

  it("the group's categories add up to its node in the main flow", () => {
    const food = categoryId(db, "Food");
    for (const range of [monthRange("2026-02"), monthRange("2026-03"), { from: "2025-12-01", to: "2026-03-31" }]) {
      const main = periodFlow(db, range).nodes.find((n) => n.kind === "spending" && n.categoryId === food);
      const group = groupFlow(db, { ...range, categoryId: food });
      const signed = group.nodes.reduce(
        (a, n) => a + (n.kind === "spending" ? n.amount : n.kind === "refund" ? -n.amount : 0),
        0,
      );
      expect(group.total).toBe(main?.amount);
      expect(signed).toBe(group.total);
      expect(group.nodes[0]).toEqual({ kind: "group", categoryId: food, amount: group.total });
    }
  });

  it("names each category, and lists a refunded one on the left through a hub", () => {
    const food = categoryId(db, "Food");
    const march = groupFlow(db, { ...monthRange("2026-03"), categoryId: food });
    expect(march.nodes).toEqual([
      { kind: "group", categoryId: food, amount: 5500 },
      { kind: "spending", categoryId: categoryId(db, "Groceries"), amount: 3000 },
      { kind: "spending", categoryId: categoryId(db, "Restaurants"), amount: 2500 },
    ]);
    expect(march.links).toEqual([
      { source: 0, target: 1, amount: 3000 },
      { source: 0, target: 2, amount: 2500 },
    ]);

    const refunded = groupFlow(db, { from: "2026-03-14", to: "2026-03-18", categoryId: food });
    expect(refunded.nodes.map((n) => [n.kind, n.amount])).toEqual([
      ["group", 1500],
      ["refund", 1000],
      ["hub", 2500],
      ["spending", 2500],
    ]);
    expect(groupFlow(db, { from: "2026-03-14", to: "2026-03-14", categoryId: food }).nodes).toEqual([]);
  });
});

describe("periodTrend", () => {
  let db: Db;
  beforeAll(() => {
    db = ledger();
  });

  it("covers the period's months, at least three, never past this month", () => {
    const months = (range: DateRange) => periodTrend(db, range, opts).map((t) => t.month);
    expect(months({ from: "2026-03-14", to: "2026-03-20" })).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(months({ from: "2025-12-20", to: "2026-01-10" })).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(months({ from: "2026-01-01", to: "2026-12-31" })).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(months({ from: "2025-04-01", to: "2026-03-31" })).toHaveLength(12);
  });

  it("per category: each month equals that category's month total", () => {
    const range = { from: "2025-12-01", to: "2026-03-31" };
    const names = ["Food", "Home & Bills", "Restaurants"];
    const ids = names.map((name) => categoryId(db, name));
    for (const id of ids) {
      const points = periodTrend(db, { ...range, categoryIds: [id] }, opts);
      for (const p of points) {
        const m = monthSummary(db, p.month, opts);
        const expected =
          m.byParent.find((x) => x.categoryId === id)?.amount ??
          m.byCategory.find((x) => x.categoryId === id)?.amount ??
          0;
        expect(p.spending).toBe(expected);
        expect(p.byCategory).toEqual([{ categoryId: id, amount: expected }]);
      }
    }
    const food = periodTrend(db, { ...range, categoryIds: [categoryId(db, "Food")] }, opts);
    expect(food.map((p) => p.spending)).toEqual([5000, 0, 15000, 5500]);
    expect(periodTrend(db, { ...range, categoryIds: [null] }, opts).every((p) => p.spending === 0)).toBe(true);
  });

  it("several categories: one series each, in the order asked, summed into spending", () => {
    const range = { from: "2025-12-01", to: "2026-03-31" };
    const food = categoryId(db, "Food");
    const home = categoryId(db, "Home & Bills");
    const points = periodTrend(db, { ...range, categoryIds: [home, food] }, opts);
    expect(points.map((p) => p.byCategory.map((c) => c.categoryId))).toEqual(points.map(() => [home, food]));
    expect(points.map((p) => p.byCategory.map((c) => c.amount))).toEqual([
      [300000, 5000],
      [0, 0],
      [450000, 15000],
      [0, 5500],
    ]);
    expect(points.map((p) => p.spending)).toEqual([305000, 0, 465000, 5500]);
  });

  it("refuses repeated or malformed category ids", () => {
    const range = { from: "2026-03-01", to: "2026-03-31" };
    expect(() => periodTrend(db, { ...range, categoryIds: [1, 1] }, opts)).toThrow();
    expect(() => periodTrend(db, { ...range, categoryIds: [0] }, opts)).toThrow();
  });
});

// ---- Spec 22: essentials and extras, money left this month ----

/**
 * The ledger above plus three March rows: one uncategorized, one set on the
 * Food group itself (no tag), and a move to savings (a transfer).
 *
 *            essential    extra   untagged
 *   Dec        300,000    5,000          0
 *   Feb        456,000    9,000          0
 *   Mar          3,000    2,500      3,500
 */
function taggedLedger(): Db {
  const db = ledger();
  ingest(
    db,
    [
      bank([
        txn({ date: "2026-03-05", amount: -2000, description: "קיוסק" }),
        txn({ date: "2026-03-06", amount: -1500, description: "שוק" }),
        txn({ date: "2026-03-07", amount: -100000, description: "הפקדה מרץ" }),
      ]),
    ],
    { now: NOW },
  );
  updateTransactions(db, [idOf(db, "שוק")], { categoryId: categoryId(db, "Food") });
  updateTransactions(db, [idOf(db, "הפקדה מרץ")], { categoryId: categoryId(db, "Savings") });
  return db;
}

describe("essentials and extras (spec 22)", () => {
  let db: Db;
  beforeAll(() => {
    db = taggedLedger();
  });
  const ranges: DateRange[] = [
    ...MONTHS.map(monthRange),
    { from: "2026-03-14", to: "2026-03-20" },
    { from: "2025-12-20", to: "2026-01-10" },
    { from: "2025-04-01", to: "2026-03-31" },
  ];

  it("splits March by the category's tag; groups and uncategorized are neither", () => {
    const march = monthRange("2026-03");
    const all = periodSummary(db, march, opts);
    expect(all).toMatchObject({ income: 1000000, spending: 9000, transfers: 100000, untagged: 3500 });
    expect(periodSummary(db, { ...march, essential: true }, opts)).toMatchObject({
      income: 1000000,
      spending: 3000,
      transfers: 100000,
      untagged: 3500,
    });
    expect(periodSummary(db, { ...march, essential: false }, opts).spending).toBe(2500);
    expect(periodSummary(db, { ...monthRange("2026-02"), essential: true }, opts).spending).toBe(456000);
    expect(periodSummary(db, { ...monthRange("2025-12"), essential: false }, opts).spending).toBe(5000);
  });

  it("essentials plus extras plus untagged is all spending, for every number of the summary", () => {
    const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);
    for (const range of ranges) {
      const all = periodSummary(db, range, opts);
      const ess = periodSummary(db, { ...range, essential: true }, opts);
      const ext = periodSummary(db, { ...range, essential: false }, opts);
      expect(ess.spending + ext.spending + all.untagged).toBe(all.spending);
      expect(sum(ess.byCategory) + sum(ext.byCategory) + all.untagged).toBe(all.spending);
      expect(sum(ess.byParent) + sum(ext.byParent) + all.untagged).toBe(all.spending);
      expect((ess.series.at(-1)?.amount ?? 0) + (ext.series.at(-1)?.amount ?? 0) + all.untagged).toBe(
        all.series.at(-1)?.amount ?? 0,
      );
      expect(ess.previous.spending + ext.previous.spending).toBeLessThanOrEqual(all.previous.spending);
      expect(ess.previous.sameTime + ext.previous.sameTime).toBeLessThanOrEqual(all.previous.sameTime);
      // Income, transfers and the review count never change with the filter.
      for (const x of [ess, ext]) {
        expect([x.income, x.transfers, x.needsReview, x.untagged, x.bucket]).toEqual([
          all.income,
          all.transfers,
          all.needsReview,
          all.untagged,
          all.bucket,
        ]);
      }
    }
  });

  it("the trend: all spending comes split by tag; a filter keeps one tag", () => {
    const range = { from: "2025-12-01", to: "2026-03-31" };
    const all = periodTrend(db, range, opts);
    const ess = periodTrend(db, { ...range, essential: true }, opts);
    const ext = periodTrend(db, { ...range, essential: false }, opts);
    expect(all.map((p) => p.split)).toEqual([
      { essential: 300000, extra: 5000, untagged: 0 },
      { essential: 0, extra: 0, untagged: 0 },
      { essential: 456000, extra: 9000, untagged: 0 },
      { essential: 3000, extra: 2500, untagged: 3500 },
    ]);
    all.forEach((p, i) => {
      const split = p.split ?? { essential: NaN, extra: NaN, untagged: NaN };
      expect(split.essential + split.extra + split.untagged).toBe(p.spending);
      expect(ess[i]).toMatchObject({ month: p.month, income: p.income, spending: split.essential });
      expect(ext[i]).toMatchObject({ month: p.month, income: p.income, spending: split.extra });
      expect(ess[i]?.split).toBeUndefined();
    });
    // Chosen categories and a tag: Food's extras are the restaurants and coffee only.
    const food = categoryId(db, "Food");
    const foodExtras = periodTrend(db, { ...range, essential: false, categoryIds: [food] }, opts);
    expect(foodExtras.map((p) => p.spending)).toEqual([5000, 0, 9000, 2500]);
    const foodEssentials = periodTrend(db, { ...range, essential: true, categoryIds: [food] }, opts);
    expect(foodEssentials.map((p) => p.spending)).toEqual([0, 0, 6000, 3000]);
  });

  it("category curves keep one tag; Food's own untagged row shows only under all", () => {
    const food = categoryId(db, "Food");
    const march = { ...monthRange("2026-03"), categoryIds: [food] };
    const last = (essential?: boolean) =>
      periodCurves(db, essential === undefined ? march : { ...march, essential }, opts)[0]?.series.at(-1)?.amount;
    expect([last(), last(true), last(false)]).toEqual([7000, 3000, 2500]);
    const [curve] = periodCurves(db, { ...march, essential: true }, opts);
    expect(curve?.previous.at(-1)?.amount).toBe(6000);
  });

  it("the trend under neither: each month is that month's untagged split", () => {
    const range = { from: "2025-12-01", to: "2026-03-31" };
    const all = periodTrend(db, range, opts);
    const neither = periodTrend(db, { ...range, essential: null }, opts);
    expect(neither.map((p) => p.spending)).toEqual(all.map((p) => p.split?.untagged));
    const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);
    for (const p of neither) expect(sum(p.byParent)).toBe(p.spending);
  });

  it("refuses a malformed filter", () => {
    const bad = { ...monthRange("2026-03"), essential: "yes" as unknown as boolean };
    expect(() => periodSummary(db, bad)).toThrow("BAD_REQUEST");
    expect(() => periodTrend(db, bad)).toThrow("BAD_REQUEST");
    expect(() => periodCurves(db, { ...bad, categoryIds: [] })).toThrow("BAD_REQUEST");
  });
});

describe("money left this month (spec 22)", () => {
  let db: Db;
  beforeAll(() => {
    db = taggedLedger();
  });
  const at = (iso: string) => thisMonth(db, { now: new Date(iso) });

  // March: income 1,000,000; spending 9,000; 100,000 moved to savings (the
  // card bill is internal, the gift excluded, the clothes trashed).
  it("subtracts spending and savings moves from income, over the whole month", () => {
    expect(at("2026-03-20T09:00:00Z")).toEqual({
      month: "2026-03",
      today: "2026-03-20",
      income: 1000000,
      spending: 9000,
      transfers: 100000,
      left: 891000,
      daysLeft: 12,
      perDay: 74200,
    });
  });

  it("the first and the last day of the month", () => {
    expect(at("2026-03-01T10:00:00Z")).toMatchObject({ daysLeft: 31, left: 891000, perDay: 28700 });
    expect(at("2026-03-31T10:00:00Z")).toMatchObject({ daysLeft: 1, left: 891000, perDay: 891000 });
  });

  it("follows Israel time at midnight", () => {
    // 23:30 on 19 March in Israel (UTC+2): still the 19th.
    expect(at("2026-03-19T21:30:00Z")).toMatchObject({ today: "2026-03-19", daysLeft: 13 });
    // 00:30 on 1 March in Israel, still February in UTC.
    expect(at("2026-02-28T22:30:00Z")).toMatchObject({ month: "2026-03", today: "2026-03-01", daysLeft: 31 });
    // 01:30 on 1 April in Israel (UTC+3 by then): a new month with nothing in it yet.
    expect(at("2026-03-31T22:30:00Z")).toEqual({
      month: "2026-04",
      today: "2026-04-01",
      income: 0,
      spending: 0,
      transfers: 0,
      left: 0,
      daysLeft: 30,
      perDay: null,
    });
  });

  it("overspent: a negative left and no per-day number", () => {
    expect(at("2026-02-10T09:00:00Z")).toMatchObject({
      income: 400000,
      spending: 465000,
      left: -65000,
      daysLeft: 19,
      perDay: null,
    });
  });

  it("no income yet this month", () => {
    const fresh = newDb();
    ingest(fresh, [bank([txn({ date: "2026-04-02", amount: -10000, description: "סופר" })])], { now: NOW });
    expect(thisMonth(fresh, { now: new Date("2026-04-10T09:00:00Z") })).toMatchObject({
      income: 0,
      spending: 10000,
      left: -10000,
      daysLeft: 21,
      perDay: null,
    });
  });

  it("rounds down to whole shekels", () => {
    const fresh = newDb();
    ingest(fresh, [bank([txn({ date: "2026-04-01", amount: 100099, description: "משכורת" })])], { now: NOW });
    // 1,000.99 over 30 days is 33.37 a day: 33.
    expect(thisMonth(fresh, { now: new Date("2026-04-01T09:00:00Z") }).perDay).toBe(3300);
  });
});

// ---- Spec 25: money math moved from the window to core ----
// Each `window*` helper is the formula the window used before, kept here so
// the numbers core now returns are proven to be the same.

/** hero-card.tsx: income minus all spending minus savings moves, from the unfiltered summary. */
const windowLeft = (all: { income: number; spending: number; transfers: number }) => all.income - all.spending - all.transfers;

/** lib/categories.ts `groupByRoot`: each amount under its top-level category, positive ones only. */
function windowGroups(db: Db, rows: { categoryId: number | null; amount: number }[]): Map<number | null, number> {
  const parent = new Map(listCategories(db).map((c) => [c.id, c.parentId ?? c.id]));
  const sums = new Map<number | null, number>();
  for (const r of rows) {
    const root = r.categoryId === null ? null : (parent.get(r.categoryId) ?? null);
    sums.set(root, (sums.get(root) ?? 0) + r.amount);
  }
  return new Map([...sums].filter(([, amount]) => amount > 0));
}

/** lib/day-groups.ts `groupByDay`: per day, spending after refunds and income. */
function windowDays(rows: TransactionRow[]): { date: string; spent: number; income: number }[] {
  const days: { date: string; spent: number; income: number }[] = [];
  for (const row of rows) {
    let day = days.at(-1);
    if (!day || day.date !== row.date) {
      day = { date: row.date, spent: 0, income: 0 };
      days.push(day);
    }
    if (row.flow === "spending" || row.flow === "refund") day.spent -= row.amount;
    if (row.flow === "income") day.income += row.amount;
  }
  return days;
}

describe("money math the window used to do (spec 25)", () => {
  let db: Db;
  beforeAll(() => {
    db = taggedLedger();
  });
  const ranges: DateRange[] = [
    ...MONTHS.map(monthRange),
    { from: "2026-03-14", to: "2026-03-20" },
    { from: "2026-03-01", to: "2026-03-10" },
    { from: "2025-12-20", to: "2026-01-10" },
    { from: "2025-04-01", to: "2026-03-31" },
  ];
  const tags = [undefined, true, false];

  it("left is the hero's income minus spending minus savings, whatever the filter", () => {
    for (const range of ranges) {
      const all = periodSummary(db, range, opts);
      for (const essential of tags) {
        const p = periodSummary(db, { ...range, essential }, opts);
        expect(p.left, JSON.stringify(range)).toBe(windowLeft(all));
      }
    }
    expect(periodSummary(db, monthRange("2026-02"), opts).left).toBe(400000 - 465000);
  });

  it("the comparison is the hero's: base, change and about the same", () => {
    let seen = 0;
    for (const range of ranges) {
      for (const essential of tags) {
        const p = periodSummary(db, { ...range, essential }, opts);
        const base = p.previous.sameTime;
        const diff = p.spending - base;
        expect(p.comparison).toEqual({ base, change: diff, aboutSame: Math.abs(diff) < base * 0.02 });
        if (base > 0) seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(compareSpending(10100, 10000)).toEqual({ base: 10000, change: 100, aboutSame: true });
    expect(compareSpending(10200, 10000)).toEqual({ base: 10000, change: 200, aboutSame: false });
    expect(compareSpending(0, 0)).toEqual({ base: 0, change: 0, aboutSame: false });
  });

  it("each trend month's byParent is the trend card's roll-up of byCategory", () => {
    const range = { from: "2025-12-01", to: "2026-03-31" };
    for (const essential of tags) {
      for (const point of periodTrend(db, { ...range, essential }, opts)) {
        const core = new Map(point.byParent.filter((p) => p.amount > 0).map((p) => [p.categoryId, p.amount]));
        expect(core, point.month).toEqual(windowGroups(db, point.byCategory));
        expect(point.byParent.reduce((a, p) => a + p.amount, 0)).toBe(point.spending);
      }
    }
  });

  it("day subtotals are the list's own, for every filter and sort", () => {
    const filters: TransactionFilter[] = [
      {},
      { from: "2026-03-01", to: "2026-03-31" },
      { flows: ["spending", "refund"] },
      { categoryIds: [null] },
      { search: "סופר" },
      { sort: "amount_desc" },
      { flows: ["income"] },
    ];
    for (const filter of filters) {
      const list = listTransactionsWithDays(db, filter);
      expect(list.rows).toEqual(listTransactions(db, filter));
      const newestFirst = [...list.rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
      expect(list.days, JSON.stringify(filter)).toEqual(windowDays(newestFirst));
    }
    expect(dayTotals([])).toEqual([]);
  });
});
