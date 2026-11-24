// The sync range: each bank's limit in months, the first day asked for,
// the start date the library gets, and quick or full (spec 32).

import { describe, expect, it } from "vitest";
import type { ScrapedAccount, ScrapedTransaction, SyncFrom } from "@shared/types";
import { openDatabase, type Db } from "@core/db";
import { ingest, listTransactions } from "@core/ledger";
import { setSetting } from "@core/settings";
import { planSync, startDateFor, syncRanges } from "./sync-range";
import { effectiveStartDate, requestStart } from "./sync/history";

const NOW = new Date("2026-11-09T10:00:00Z");

function newDb(syncFrom: SyncFrom = "max"): Db {
  const db = openDatabase(":memory:");
  setSetting(db, { key: "syncFrom", value: syncFrom });
  return db;
}

const range = (syncFrom: SyncFrom, provider: string) =>
  syncRanges(newDb(syncFrom), NOW).find((r) => r.provider === provider);

function row(date: string, description: string, status: ScrapedTransaction["status"] = "completed"): ScrapedTransaction {
  return {
    date,
    processedDate: null,
    amount: -1500,
    originalAmount: null,
    originalCurrency: null,
    description,
    memo: null,
    status,
    installment: null,
    identifier: null,
  };
}

const discount = (...transactions: ScrapedTransaction[]): ScrapedAccount[] => [
  { provider: "discount", accountNumber: "100-200300", balance: null, transactions },
];

describe("syncRanges", () => {
  it("knows each bank's limit in whole months", () => {
    const months = Object.fromEntries(syncRanges(newDb(), NOW).map((r) => [r.provider, r.limitMonths]));
    expect(months).toMatchObject({ discount: 12, visaCal: 18, max: 48, leumi: 36, yahav: 3, beinleumi: 12 });
  });

  it("with max, starts at each bank's earliest day", () => {
    expect(range("max", "discount")?.from).toBe("2025-11-11");
    expect(range("max", "max")?.from).toBe("2022-11-09");
  });

  it("with a day, starts there unless the bank cannot go that far", () => {
    expect(range("2026-06-01", "discount")?.from).toBe("2026-06-01");
    expect(range("2020-01-01", "discount")?.from).toBe("2025-11-11");
    expect(range("2024-01-01", "max")?.from).toBe("2024-01-01");
  });

  it("knows the next quick sync's first day, null before the first sync", () => {
    const db = newDb();
    ingest(db, discount(), { now: new Date("2026-11-01T09:00:00Z") });
    const ranges = syncRanges(db, NOW);
    expect(ranges.find((r) => r.provider === "discount")?.quickFrom).toBe("2026-09-02");
    expect(ranges.find((r) => r.provider === "visaCal")?.quickFrom).toBeNull();
  });
});

describe("startDateFor", () => {
  it("max asks for no date: the library's own limit, as before", () => {
    expect(startDateFor("max")).toBeUndefined();
    expect(requestStart("discount", startDateFor("max"), () => NOW).toISOString()).toBe("2000-01-01T00:00:00.000Z");
  });

  it("a day reaches requestStart as that day", () => {
    const start = startDateFor("2026-06-01");
    expect(start?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(requestStart("discount", start, () => NOW)).toEqual(start);
    // A library without its own clamp still gets our floor for an earlier day.
    expect(requestStart("beinleumi", startDateFor("2020-01-01"), () => NOW).toISOString()).toBe("2025-11-10T00:00:00.000Z");
    expect(requestStart("beinleumi", start, () => NOW)).toEqual(start);
  });
});

describe("planSync (spec 32)", () => {
  it("the first sync is full: all the bank allows, or syncFrom", () => {
    expect(planSync(newDb(), "visaCal", "quick", NOW)).toEqual({
      startDate: undefined,
      scope: { mode: "full", months: null, from: null },
    });
    const plan = planSync(newDb("2026-01-15"), "visaCal", "quick", NOW);
    expect(plan.startDate?.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(plan.scope).toEqual({ mode: "full", months: null, from: "2026-01-15" });
  });

  it("a quick sync starts 60 days before the last sync", () => {
    const db = newDb();
    ingest(db, discount(), { now: new Date("2026-11-01T09:00:00Z") });
    const plan = planSync(db, "discount", "quick", NOW);
    expect(plan.startDate?.toISOString()).toBe("2026-09-02T00:00:00.000Z");
    expect(plan.scope).toEqual({ mode: "quick", months: 2, from: "2026-09-02" });
  });

  it("a quick sync never starts before syncFrom", () => {
    const db = newDb("2026-10-01");
    ingest(db, discount(), { now: new Date("2026-11-01T09:00:00Z") });
    const plan = planSync(db, "discount", "quick", NOW);
    expect(plan.startDate?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(plan.scope).toMatchObject({ mode: "quick", from: "2026-10-01" });
  });

  it("full ignores the last sync", () => {
    const db = newDb();
    ingest(db, discount(), { now: new Date("2026-11-01T09:00:00Z") });
    expect(planSync(db, "discount", "full", NOW)).toEqual({
      startDate: undefined,
      scope: { mode: "full", months: null, from: null },
    });
    setSetting(db, { key: "syncFrom", value: "2020-01-01" });
    // The bank's own limit is later than syncFrom: the text names the real first day.
    expect(planSync(db, "discount", "full", NOW).scope.from).toBe("2025-11-11");
  });

  it("refuses any other mode", () => {
    for (const mode of ["fast", "", null, 1, "__proto__"]) {
      expect(() => planSync(newDb(), "discount", mode, NOW), String(mode)).toThrow("BAD_REQUEST");
    }
  });

  it("a pending row before the quick window is not marked gone", () => {
    const db = newDb();
    ingest(db, discount(row("2026-07-01", "old pending", "pending"), row("2026-10-20", "new pending", "pending")), {
      now: new Date("2026-11-01T09:00:00Z"),
    });
    const plan = planSync(db, "discount", "quick", NOW);
    const startDate = plan.startDate ?? new Date(0);
    const since = effectiveStartDate("discount", startDate, NOW);
    expect(since).toBe("2026-09-03");
    // The quick download no longer reaches July, and the newer pending row is gone from the bank.
    ingest(db, discount(row("2026-11-05", "coffee")), { now: NOW, since });
    const status = (d: string) => listTransactions(db).find((t) => t.description === d)?.status;
    expect(status("old pending")).toBe("pending");
    expect(status("new pending")).toBe("gone");
  });
});
