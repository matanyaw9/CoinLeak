// Quick sync's first day (spec 32), from each syncing account's last save.

import { describe, expect, it } from "vitest";
import { BANK_NUMBER, accountId, bank, newDb, txn } from "../testing/ledger";
import { setAccountsSyncing } from "./accounts";
import { ingest } from "./ingest";
import { quickSyncStart } from "./sync-window";

const SECOND = "100-999888";

describe("quickSyncStart", () => {
  it("is null before the provider's first sync, so that sync is full", () => {
    const db = newDb();
    expect(quickSyncStart(db, "discount", "2026-03-31")).toBeNull();
  });

  it("starts 60 days before the last successful sync day", () => {
    const db = newDb();
    ingest(db, [bank([])], { now: new Date("2026-01-10T09:00:00Z") });
    ingest(db, [bank([])], { now: new Date("2026-03-20T09:00:00Z") });
    expect(quickSyncStart(db, "discount", "2026-03-31")).toBe("2026-01-19");
  });

  it("counts the last sync day in Israel time", () => {
    const db = newDb();
    // 23:30 UTC on 19 March is already 20 March in Israel.
    ingest(db, [bank([])], { now: new Date("2026-03-19T23:30:00Z") });
    expect(quickSyncStart(db, "discount", "2026-03-31")).toBe("2026-01-19");
  });

  it("looks only at the same provider", () => {
    const db = newDb();
    ingest(db, [bank([txn({ date: "2026-03-01", amount: -100, description: "קפה" })])], {
      now: new Date("2026-03-20T09:00:00Z"),
    });
    expect(quickSyncStart(db, "visaCal", "2026-03-31")).toBeNull();
  });

  it("never counts from a day after today", () => {
    const db = newDb();
    ingest(db, [bank([])], { now: new Date("2026-05-01T09:00:00Z") });
    expect(quickSyncStart(db, "discount", "2026-03-31")).toBe("2026-01-30");
  });

  // Review 2026-11-25: the start follows each account's own last save.
  it("an account added back to syncing pulls the start back to its own last save", () => {
    const db = newDb();
    ingest(db, [bank([]), bank([], SECOND)], { now: new Date("2026-01-10T09:00:00Z") });
    setAccountsSyncing(db, [accountId(db, "discount", SECOND)], false);
    ingest(db, [bank([]), bank([], SECOND)], { now: new Date("2026-06-20T09:00:00Z") });
    // While it is off, it does not hold the start back.
    expect(quickSyncStart(db, "discount", "2026-06-30")).toBe("2026-04-21");
    setAccountsSyncing(db, [accountId(db, "discount", SECOND)], true);
    // Added back: the next quick sync reaches back to its last save, so the gap is downloaded.
    expect(quickSyncStart(db, "discount", "2026-06-30")).toBe("2025-11-11");
    ingest(db, [bank([]), bank([], SECOND)], { now: new Date("2026-06-30T09:00:00Z") });
    expect(quickSyncStart(db, "discount", "2026-06-30")).toBe("2026-05-01");
  });

  it("a download that saved no accounts does not move the start", () => {
    const db = newDb();
    ingest(db, [bank([])], { now: new Date("2026-01-10T09:00:00Z") });
    ingest(db, [], { now: new Date("2026-03-20T09:00:00Z"), provider: "discount" });
    expect(quickSyncStart(db, "discount", "2026-03-31")).toBe("2025-11-11");
  });

  it("is null when every account of the provider is off, so the sync is full", () => {
    const db = newDb();
    ingest(db, [bank([])], { now: new Date("2026-01-10T09:00:00Z") });
    setAccountsSyncing(db, [accountId(db, "discount", BANK_NUMBER)], false);
    expect(quickSyncStart(db, "discount", "2026-03-31")).toBeNull();
  });
});
