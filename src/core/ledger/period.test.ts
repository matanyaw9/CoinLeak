import { beforeAll, describe, expect, it } from "vitest";
import type { DateRange } from "@shared/types";
import type { Db } from "../db";
import { NOW, bank, card, categoryId, charge, idOf, newDb, txn } from "../testing/ledger";
import { categoryCurves } from "./curves";
import { ingest } from "./ingest";
import { groupFlow, monthFlow, periodFlow } from "./money-flow";
import { bucketFor, bucketsOf, monthRange, periodCurves, periodSummary, periodTrend, previousRange } from "./period";
import { monthSummary, trashTransactions, trend, updateTransactions } from "./queries";

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

      const { from, to, ...flow } = periodFlow(db, range);
      expect([from, to]).toEqual([range.from, range.to]);
      expect({ month, ...flow }).toEqual(monthFlow(db, month));

      const curves = periodCurves(db, { ...range, categoryIds: [food, null] }, opts);
      const byMonth = categoryCurves(db, { month, categoryIds: [food, null] }, opts);
      expect(curves.map((c) => c.series.map((x) => x.amount))).toEqual(byMonth.map((c) => c.byDay.map((x) => x.amount)));
      expect(curves.map((c) => c.previous.map((x) => x.amount))).toEqual(
        byMonth.map((c) => c.previousByDay.map((x) => x.amount)),
      );

      const point = periodTrend(db, range, opts).at(-1);
      expect(point).toEqual(trend(db, 4, opts).find((t) => t.month === month));
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
    const [curve] = categoryCurves(db, { month: "2026-03", categoryIds: [categoryId(db, "Food")] }, opts);
    expect(curve?.byDay).toHaveLength(20);
    expect(curve?.previousByDay).toHaveLength(28);
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
    expect(() => periodTrend(db, { from: "2026-01-01", to: "2026-01-31", categoryId: -1 })).toThrow("BAD_REQUEST");
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

  it("one category: each month equals that category's month total", () => {
    const range = { from: "2025-12-01", to: "2026-03-31" };
    for (const name of ["Food", "Home & Bills", "Restaurants"]) {
      const id = categoryId(db, name);
      const points = periodTrend(db, { ...range, categoryId: id }, opts);
      for (const p of points) {
        const m = monthSummary(db, p.month, opts);
        const expected =
          m.byParent.find((x) => x.categoryId === id)?.amount ??
          m.byCategory.find((x) => x.categoryId === id)?.amount ??
          0;
        expect(p.spending).toBe(expected);
        expect(p.byCategory.reduce((a, c) => a + c.amount, 0)).toBe(expected);
      }
    }
    const food = periodTrend(db, { ...range, categoryId: categoryId(db, "Food") }, opts);
    expect(food.map((p) => p.spending)).toEqual([5000, 0, 15000, 5500]);
    expect(periodTrend(db, { ...range, categoryId: null }, opts).every((p) => p.spending === 0)).toBe(true);
  });
});
