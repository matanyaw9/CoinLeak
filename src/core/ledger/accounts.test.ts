import { describe, expect, it } from "vitest";
import { CodedError } from "@shared/errors";
import { NOW, accountId, bank, card, charge, newDb, snapshot, txn } from "../testing/ledger";
import { setAccountsSyncing } from "./accounts";
import { ingest } from "./ingest";
import { listAccounts, listTransactions, monthSummary, trend } from "./queries";

function ledger() {
  const db = newDb();
  ingest(
    db,
    [
      bank([
        txn({ date: "2026-03-01", amount: 1_500_000, description: "SYNTH SALARY" }),
        txn({ date: "2026-03-05", amount: -40_000, description: "SYNTH RENT" }),
      ]),
    ],
    { now: NOW },
  );
  ingest(db, [card("4321", [charge("2026-03-03", -8_000, "SYNTH MARKET", "2026-04-10")])], { now: NOW });
  return db;
}

describe("setAccountsSyncing", () => {
  it("removes an account from syncing and keeps every row and every total", () => {
    const db = ledger();
    const cardId = accountId(db, "visaCal", "4321");
    const rows = snapshot(db);
    const month = monthSummary(db, "2026-03");
    const months = trend(db, 3, { now: NOW });
    const listed = listTransactions(db);

    expect(setAccountsSyncing(db, [cardId], false)).toEqual({ updated: 1 });
    expect(listAccounts(db).find((a) => a.id === cardId)?.syncEnabled).toBe(false);
    expect(snapshot(db)).toEqual(rows);
    expect(monthSummary(db, "2026-03")).toEqual(month);
    expect(trend(db, 3, { now: NOW })).toEqual(months);
    expect(listTransactions(db)).toEqual(listed);
  });

  it("adds it back", () => {
    const db = ledger();
    const ids = listAccounts(db).map((a) => a.id);
    expect(setAccountsSyncing(db, ids, false)).toEqual({ updated: 2 });
    expect(setAccountsSyncing(db, ids, false)).toEqual({ updated: 0 });
    expect(setAccountsSyncing(db, ids, true)).toEqual({ updated: 2 });
    expect(listAccounts(db).every((a) => a.syncEnabled)).toBe(true);
  });

  it("new accounts sync by default", () => {
    expect(listAccounts(ledger()).map((a) => a.syncEnabled)).toEqual([true, true]);
  });

  it("rejects unknown ids, empty lists and non-boolean flags, changing nothing", () => {
    const db = ledger();
    const id = accountId(db, "discount", "100-200300");
    expect(() => setAccountsSyncing(db, [id, 9999], false)).toThrow(CodedError);
    expect(() => setAccountsSyncing(db, [], false)).toThrow(CodedError);
    expect(() => setAccountsSyncing(db, [id], "no" as never)).toThrow(CodedError);
    expect(() => setAccountsSyncing(db, [-1], false)).toThrow(CodedError);
    expect(listAccounts(db).every((a) => a.syncEnabled)).toBe(true);
  });
});
