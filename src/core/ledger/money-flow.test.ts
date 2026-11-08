import { describe, expect, it } from "vitest";
import type { MoneyFlow, ScrapedTransaction } from "@shared/types";
import type { Db } from "../db";
import { NOW, bank, categoryId, idOf, newDb, txn } from "../testing/ledger";
import { ingest } from "./ingest";
import { monthFlow } from "./money-flow";
import { monthSummary, updateTransactions } from "./queries";

// Synthetic rows: [day, amount in agorot, description, category name or null].
type Row = [string, number, string, string | null, ("pending" | "completed")?];

function ledger(rows: Row[]): Db {
  const db = newDb();
  const txns: ScrapedTransaction[] = rows.map(([date, amount, description, , status]) =>
    txn({ date: `2026-03-${date}`, amount, description, status: status ?? "completed" }),
  );
  ingest(db, [bank(txns)], { now: NOW });
  for (const [, , description, category] of rows) {
    if (category) updateTransactions(db, [idOf(db, description)], { categoryId: categoryId(db, category) });
  }
  return db;
}

/** Sum in equals sum out, every node matches its one link, and nothing is zero or negative. */
function expectBalanced(flow: MoneyFlow): void {
  const hub = flow.nodes.findIndex((n) => n.kind === "hub");
  const into = flow.links.filter((l) => l.target === hub).reduce((a, l) => a + l.amount, 0);
  const out = flow.links.filter((l) => l.source === hub).reduce((a, l) => a + l.amount, 0);
  expect(into).toBe(out);
  expect(flow.nodes[hub]?.amount).toBe(into);
  expect(flow.links).toHaveLength(flow.nodes.length - 1);
  for (const [i, n] of flow.nodes.entries()) {
    expect(n.amount).toBeGreaterThan(0);
    expect(Number.isSafeInteger(n.amount)).toBe(true);
    if (i !== hub) expect(flow.links.find((l) => l.source === i || l.target === i)?.amount).toBe(n.amount);
  }
}

const shape = (db: Db, flow: MoneyFlow) =>
  flow.nodes.map((n) => [n.kind, n.categoryId === null ? null : nameOf(db, n.categoryId), n.amount]);

function nameOf(db: Db, id: number): string {
  return (db.prepare("SELECT name FROM categories WHERE id = ?").get(id) as { name: string }).name;
}

describe("monthFlow", () => {
  it("a normal month: income in, categories, savings and what was left out", () => {
    const db = ledger([
      ["01", 1500000, "משכורת", "Salary"],
      ["03", 200000, "פרילנס", "Freelance & Side Income"],
      ["04", -450000, "שכר דירה", "Bills & Utilities"],
      ["05", -60000, "סופר", "Groceries"],
      ["06", -20000, "מסעדה", "Restaurants"],
      ["07", -300000, "הפקדה לחיסכון", "Savings"],
      ["08", -12000, "קפה", "Coffee & Cafes", "pending"],
    ]);
    const flow = monthFlow(db, "2026-03");
    expectBalanced(flow);
    expect(flow).toMatchObject({ income: 1700000, spending: 542000, transfers: 300000 });
    expect(shape(db, flow)).toEqual([
      ["income", "Salary", 1500000],
      ["income", "Freelance & Side Income", 200000],
      ["hub", null, 1700000],
      ["spending", "Home & Bills", 450000],
      ["spending", "Food", 92000],
      ["transfer", "Savings & Investments", 300000],
      ["left", null, 858000],
    ]);
    expect(flow.income).toBe(monthSummary(db, "2026-03").income);
  });

  it("an overspent month takes the difference from savings or earlier months", () => {
    const db = ledger([
      ["01", 500000, "משכורת", "Salary"],
      ["04", -450000, "שכר דירה", "Bills & Utilities"],
      ["05", -100000, "טיסה", "Travel"],
      ["07", -50000, "קרן", "Investments"],
    ]);
    const flow = monthFlow(db, "2026-03");
    expectBalanced(flow);
    expect(shape(db, flow)).toEqual([
      ["income", "Salary", 500000],
      ["from_savings", null, 100000],
      ["hub", null, 600000],
      ["spending", "Home & Bills", 450000],
      ["spending", "Transportation", 100000],
      ["transfer", "Savings & Investments", 50000],
    ]);
  });

  it("money taken back out of savings is a source, not income", () => {
    const db = ledger([
      ["01", 300000, "משכורת", "Salary"],
      ["02", 200000, "משיכה מחיסכון", "Savings"],
      ["04", -450000, "שכר דירה", "Bills & Utilities"],
    ]);
    const flow = monthFlow(db, "2026-03");
    expectBalanced(flow);
    expect(flow).toMatchObject({ income: 300000, transfers: -200000 });
    expect(shape(db, flow)).toEqual([
      ["income", "Salary", 300000],
      ["from_savings", null, 200000],
      ["hub", null, 500000],
      ["spending", "Home & Bills", 450000],
      ["left", null, 50000],
    ]);
  });

  it("a month with no income is all from savings", () => {
    const db = ledger([["05", -60000, "סופר", "Groceries"]]);
    const flow = monthFlow(db, "2026-03");
    expectBalanced(flow);
    expect(shape(db, flow)).toEqual([
      ["from_savings", null, 60000],
      ["hub", null, 60000],
      ["spending", "Food", 60000],
    ]);
  });

  it("uncategorized rows show as their own nodes", () => {
    const db = ledger([
      ["01", 100000, "העברה נכנסת", null],
      ["05", -30000, "חנות", null],
    ]);
    const flow = monthFlow(db, "2026-03");
    expectBalanced(flow);
    expect(shape(db, flow)).toEqual([
      ["income", null, 100000],
      ["hub", null, 100000],
      ["spending", null, 30000],
      ["left", null, 70000],
    ]);
  });

  it("refunds net out inside their category, and a category refunded beyond its spending flows in", () => {
    const db = ledger([
      ["01", 100000, "משכורת", "Salary"],
      ["02", -40000, "בגדים", "Shopping"],
      ["03", 10000, "זיכוי בגדים", "Shopping"],
      ["04", 25000, "זיכוי טיסה", "Travel"],
    ]);
    const flow = monthFlow(db, "2026-03");
    expectBalanced(flow);
    expect(flow.spending).toBe(5000);
    expect(shape(db, flow)).toEqual([
      ["income", "Salary", 100000],
      ["refund", "Transportation", 25000],
      ["hub", null, 125000],
      ["spending", "Lifestyle", 30000],
      ["left", null, 95000],
    ]);
  });

  it("is empty when nothing moved, and leaves out rows that count nowhere", () => {
    const db = ledger([["05", -60000, "סופר", "Groceries"]]);
    updateTransactions(db, [idOf(db, "סופר")], { excluded: true });
    expect(monthFlow(db, "2026-03")).toEqual({
      month: "2026-03",
      income: 0,
      spending: 0,
      transfers: 0,
      nodes: [],
      links: [],
    });
    expect(monthFlow(db, "2026-04").nodes).toEqual([]);
    expect(() => monthFlow(db, "2026-3")).toThrow("BAD_REQUEST");
  });
});
