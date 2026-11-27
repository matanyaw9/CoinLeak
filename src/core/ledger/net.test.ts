import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import { NOW, bank, card, categoryId, charge, idOf, newDb, txn } from "../testing/ledger";
import { addMonths } from "./dates";
import { ingest } from "./ingest";
import { monthlyNet, netMonths } from "./net";
import { periodTrend } from "./period";
import { updateTransactions } from "./edits";
import { trashTransactions } from "./trash";

// A hand-built ledger over four months. Totals below are worked out by hand.
//
// Bank
//   2025-12-01  +1,000,000 salary              income
//   2025-12-22    -300,000 rent                spending
//   2026-01-01  +1,000,000 salary              income
//   2026-01-05    -300,000 savings deposit     transfer (not in the net)
//   2026-01-06    -800,000 rent                spending
//   2026-02-01    +400,000 salary              income (February is overspent)
//   2026-02-03    -450,000 rent                spending
//   2026-03-01  +1,000,000 salary              income
//   2026-03-10     -15,000 bill for card 4321  internal (pays the two Feb rows)
// Card 4321 (credit)
//   2025-12-30   -5,000 coffee      spending
//   2026-02-15   -6,000 groceries   billed 03-10
//   2026-02-20   -9,000 restaurant  billed 03-10
//   2026-03-12   -4,000 groceries
//   2026-03-14   +1,000 refund      Groceries: lowers spending
//   2026-03-18   -2,500 restaurant
//   2026-03-19   -8,000 clothes     trashed
//   2026-03-20   -3,000 gift        excluded by the user
//
//            income     spending   transfers        net
//   Dec   1,000,000      305,000           0    695,000
//   Jan   1,000,000      800,000     300,000    200,000
//   Feb     400,000      465,000           0    -65,000
//   Mar   1,000,000        5,500           0    994,500
const TODAY = new Date("2026-03-20T09:00:00Z");
const opts = { now: TODAY };
const MARCH = { from: "2026-03-01", to: "2026-03-31" };
const monthsOf = (first: string, n: number) => Array.from({ length: n }, (_, i) => addMonths(first, i));

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
        txn({ date: "2026-01-05", amount: -300000, description: "הפקדה לחיסכון" }),
        txn({ date: "2026-01-06", amount: -800000, description: "שכר דירה ינואר" }),
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
  for (const d of ["שכר דירה דצמבר", "שכר דירה ינואר", "שכר דירה פברואר"]) set(d, "Bills & Utilities");
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

describe("monthlyNet (spec 30)", () => {
  it("income minus spending per month, from the first transaction's month", () => {
    expect(monthlyNet(ledger(), MARCH, opts)).toEqual([
      { month: "2025-12", income: 1000000, spending: 305000, transfers: 0, net: 695000, partial: false },
      { month: "2026-01", income: 1000000, spending: 800000, transfers: 300000, net: 200000, partial: false },
      { month: "2026-02", income: 400000, spending: 465000, transfers: 0, net: -65000, partial: false },
      { month: "2026-03", income: 1000000, spending: 5500, transfers: 0, net: 994500, partial: true },
    ]);
  });

  it("savings moves change transfers but not the net", () => {
    const db = ledger();
    const jan = () => monthlyNet(db, MARCH, opts).find((p) => p.month === "2026-01");
    expect(jan()).toMatchObject({ transfers: 300000, net: 200000 });
    // Taking the deposit out of the books moves transfers only.
    updateTransactions(db, [idOf(db, "הפקדה לחיסכון")], { excluded: true });
    expect(jan()).toMatchObject({ transfers: 0, net: 200000 });
  });

  it("refunds and card bills count as on the month-by-month bars", () => {
    const db = ledger();
    // The bars get their 12 months from the window (trend-card's trendRange).
    const bars = periodTrend(db, { from: "2025-04-01", to: "2026-03-31" }, opts);
    for (const point of monthlyNet(db, MARCH, opts)) {
      const bar = bars.find((b) => b.month === point.month);
      expect(point.spending).toBe(bar?.spending);
      expect(point.income).toBe(bar?.income);
    }
    // February's card rows count once, in February; March's card bill counts nowhere.
    const march = monthlyNet(db, MARCH, opts).at(-1);
    expect(march?.spending).toBe(4000 - 1000 + 2500);
  });

  it("excluded and trashed rows count nowhere", () => {
    const db = ledger();
    const march = () => monthlyNet(db, MARCH, opts).at(-1)?.net;
    expect(march()).toBe(994500);
    updateTransactions(db, [idOf(db, "מתנה")], { excluded: false });
    expect(march()).toBe(994500 - 3000);
    trashTransactions(db, [idOf(db, "משכורת מרץ")]);
    expect(march()).toBe(-5500 - 3000);
  });

  it("only the current month is partial", () => {
    const db = ledger();
    const april = { now: new Date("2026-04-02T09:00:00Z") };
    const points = monthlyNet(db, { from: "2026-04-01", to: "2026-04-30" }, april);
    expect(points.map((p) => [p.month, p.partial])).toEqual([
      ["2025-12", false],
      ["2026-01", false],
      ["2026-02", false],
      ["2026-03", false],
      ["2026-04", true],
    ]);
    expect(points.at(-1)).toMatchObject({ income: 0, spending: 0, net: 0 });
  });

  it("leaves out months before the first transaction, trashed rows aside", () => {
    const db = ledger();
    trashTransactions(db, [idOf(db, "משכורת דצמבר"), idOf(db, "שכר דירה דצמבר"), idOf(db, "קפה")]);
    expect(monthlyNet(db, MARCH, opts).map((p) => p.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(monthlyNet(newDb(), MARCH, opts)).toEqual([]);
  });

  /** One spending row on the 10th of each month in the list. */
  function monthly(months: string[]): Db {
    const db = newDb();
    const rows = months.map((m) => txn({ date: `${m}-10`, amount: -1000, description: `חנות ${m}` }));
    ingest(db, [bank(rows)], { now: NOW });
    return db;
  }

  it("a period longer than 12 months returns all its months", () => {
    const db = monthly(monthsOf("2023-01", 40));
    const points = monthlyNet(db, { from: "2024-01-01", to: "2026-02-28" }, opts);
    expect(points.map((p) => p.month)).toEqual(monthsOf("2024-01", 26));
    expect(points.every((p) => p.net === -1000 && !p.partial)).toBe(true);
  });

  it("a future period stops at the current month", () => {
    const db = monthly(monthsOf("2023-01", 40));
    const points = monthlyNet(db, { from: "2026-06-01", to: "2026-06-30" }, opts);
    expect(points.map((p) => p.month)).toEqual(monthsOf("2025-04", 12));
    expect(points.at(-1)).toMatchObject({ month: "2026-03", partial: true });
  });

  it("rejects bad ranges", () => {
    const db = ledger();
    for (const bad of [null, {}, { from: "2026-03-31", to: "2026-03-01" }, { from: "2026-03", to: "2026-03-31" }]) {
      expect(() => monthlyNet(db, bad as never, opts)).toThrow("BAD_REQUEST");
    }
  });
});

describe("netMonths", () => {
  it("12 months up to the range's month, or this month when the range runs past it", () => {
    expect(netMonths(MARCH, "2026-03")).toEqual(monthsOf("2025-04", 12));
    expect(netMonths({ from: "2025-07-01", to: "2025-07-31" }, "2026-03")).toEqual(monthsOf("2024-08", 12));
    expect(netMonths({ from: "2026-01-01", to: "2026-12-31" }, "2026-03")).toEqual(monthsOf("2025-04", 12));
    expect(netMonths({ from: "2024-01-01", to: "2026-03-31" }, "2026-03")).toEqual(monthsOf("2024-01", 27));
  });
});

