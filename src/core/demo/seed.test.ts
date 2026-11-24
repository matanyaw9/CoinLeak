// The Demo seeder: deterministic, sums that add up through the real core,
// and the rules, categories and review cases the screens need.

import { describe, expect, it } from "vitest";
import type { TransactionRow } from "@shared/types";
import { openDatabase, type Db } from "../db";
import { balanceChecks, budgetStatus, getCashWallet, listAccounts, listCategories, listTransactions, monthSummary } from "../ledger";
import { listRules } from "../rules";
import { seedDemo } from "./seed";

const TODAY = new Date("2026-11-07T10:00:00Z");

function seeded(): Db {
  const db = openDatabase(":memory:");
  seedDemo(db, TODAY);
  return db;
}

const visible = (rows: TransactionRow[]) => rows.map(({ id, description, amount, date, flow, categoryId, flags }) => ({
  id, description, amount, date, flow, categoryId, flags,
}));

describe("seedDemo", () => {
  it("gives the same rows for the same date", () => {
    const a = listTransactions(seeded(), {});
    const b = listTransactions(seeded(), {});
    expect(a.length).toBeGreaterThan(200);
    expect(visible(a)).toEqual(visible(b));
  });

  it("covers about six months up to the given day", () => {
    const dates = listTransactions(seeded(), {}).map((r) => r.date).sort();
    expect(dates[0]?.slice(0, 7)).toBe("2026-06");
    expect(dates.at(-1)).toBe("2026-11-07");
  });

  it("a month's Home summary adds up from its rows", () => {
    const db = seeded();
    const month = "2026-10";
    const rows = listTransactions(db, { from: "2026-10-01", to: "2026-10-31" });
    const sum = (flows: string[]) => rows.filter((r) => flows.includes(r.flow)).reduce((t, r) => t + r.amount, 0);
    const summary = monthSummary(db, month, { now: TODAY });
    expect(summary.income).toBe(sum(["income"]));
    expect(summary.spending).toBe(-sum(["spending", "refund"]));
    expect(summary.transfers).toBe(-sum(["transfer"]));
    expect(summary.income).toBeGreaterThan(0);
    expect(summary.spending).toBeGreaterThan(0);
    expect(summary.transfers).toBeGreaterThan(0);
    expect(summary.byCategory.reduce((t, c) => t + c.amount, 0)).toBe(summary.spending);
  });

  it("has rules, a new category, and rows of every kind", () => {
    const db = seeded();
    const rules = listRules(db);
    expect(rules.length).toBeGreaterThan(10);
    expect(rules.some((r) => !r.enabled)).toBe(true);
    expect(listCategories(db).some((c) => c.name === "Rent")).toBe(true);

    const rows = [...listTransactions(db, {}), ...listTransactions(db, { flows: ["trashed"] })];
    const flows = new Set(rows.map((r) => r.flow));
    for (const f of ["spending", "income", "refund", "internal", "excluded", "gone", "trashed", "transfer"]) {
      expect(flows, f).toContain(f);
    }
    expect(rows.some((r) => r.categorySource === "rule")).toBe(true);
    expect(rows.some((r) => r.categorySource === "user")).toBe(true);
    expect(rows.some((r) => r.flags.includes("uncategorized"))).toBe(true);
    expect(rows.some((r) => r.flags.includes("possible_card_bill"))).toBe(true);
    expect(rows.some((r) => r.status === "pending")).toBe(true);
    const calBills = rows.filter((r) => r.description.startsWith("כאל חיוב"));
    expect(calBills.length).toBeGreaterThan(5);
    expect(calBills.every((r) => r.flow === "internal")).toBe(true);
    expect(listAccounts(db).filter((a) => a.syncEnabled === false)).toHaveLength(1);
  });

  it("has one bank account whose balance adds up and one with a small gap (spec 24)", () => {
    const db = seeded();
    const checks = balanceChecks(db).filter((c) => c.status !== "unknown");
    expect(checks.map(({ status, gap, window }) => ({ status, gap, window }))).toEqual([
      { status: "matches", gap: 0, window: { from: "2026-11-03", to: "2026-11-07" } },
      { status: "gap", gap: -12_000, window: { from: "2026-11-03", to: "2026-11-07" } },
    ]);
    expect(checks.every((c) => c.rowCount > 0)).toBe(true);
  });

  it("has a cash wallet fed by an ATM withdrawal (spec 20)", () => {
    const db = seeded();
    const wallet = getCashWallet(db);
    expect(wallet?.rowCount).toBe(5);
    const rows = listTransactions(db, { from: "2026-10-25" });
    const cash = rows.filter((r) => r.source === "manual");
    expect(cash.some((r) => r.flow === "income" && r.categoryId === null)).toBe(true);
    expect(cash.some((r) => r.note !== null)).toBe(true);
    const atm = rows.find((r) => r.date === "2026-11-01" && r.description === "משיכת מזומן" && r.amount === -30000);
    expect(atm).toMatchObject({ flow: "internal", movedToCash: true });
  });

  it("has a Bit payment this month paid back for a restaurant purchase (spec 33)", () => {
    for (const today of [TODAY, new Date("2026-12-01T10:00:00Z")]) {
      const db = openDatabase(":memory:");
      seedDemo(db, today);
      const month = today.toISOString().slice(0, 7);
      const linked = listTransactions(db, {}).filter((r) => r.paidBackFor);
      expect(linked).toHaveLength(1);
      const [payBack] = linked;
      const restaurants = listCategories(db).find((c) => c.name === "Restaurants")?.id;
      expect(payBack).toMatchObject({ amount: 12000, flow: "refund", categoryId: restaurants, categorySource: "user" });
      expect(payBack?.date.slice(0, 7)).toBe(month);
      const purchase = listTransactions(db, {}).find((r) => r.id === payBack?.paidBackFor?.id);
      expect(purchase).toMatchObject({ amount: -24000, flow: "spending", categoryId: restaurants });
      expect(purchase?.date.slice(0, 7)).toBe(month);
    }
  });

  it("has budgets this month: one over, one near, one well under (spec 27)", () => {
    for (const today of [TODAY, new Date("2026-11-28T10:00:00Z"), new Date("2026-12-03T10:00:00Z")]) {
      const db = openDatabase(":memory:");
      seedDemo(db, today);
      const day = today.toISOString().slice(0, 10);
      const { lines } = budgetStatus(db, { month: day.slice(0, 7), today: day });
      const shares = lines.map((l) => l.spentMonth / l.monthlyBudget).sort((a, b) => b - a);
      expect(shares).toHaveLength(3);
      expect(shares[0]).toBeGreaterThan(1);
      expect(shares[1]).toBeGreaterThanOrEqual(0.8);
      expect(shares[1]).toBeLessThanOrEqual(1);
      expect(shares[2]).toBeLessThan(0.5);
    }
  });
});
