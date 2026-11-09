import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { ScrapedAccount, ScrapedTransaction } from "@shared/types";
import { migrate, type Db } from "../db";
import { MIGRATIONS } from "../db/migrations";
import { BANK_NUMBER, accountId, bank, card, idOf, newDb, txn } from "../testing/ledger";
import { balanceChecks } from "./balance";
import { ingest } from "./ingest";
import { trashTransactions, updateTransactions } from "./queries";

// Sync A on 10 March, sync B on 14 March (Israel time, mid-morning).
const AT_A = new Date("2026-03-10T08:00:00Z");
const AT_B = new Date("2026-03-14T08:00:00Z");
const START = 1_000_000;

const row = (date: string, amount: number, description: string, more: Partial<ScrapedTransaction> = {}) =>
  txn({ date: `2026-03-${date}`, amount, description, ...more });
const withBalance = (balance: number | null, rows: ScrapedTransaction[], number = BANK_NUMBER): ScrapedAccount => ({
  ...bank(rows, number),
  balance,
});

const before = [row("01", 500_000, "משכורת"), row("10", -2000, "עמלה")];
const between = [row("11", -500, "קפה"), row("13", 2000, "החזר")];
const moved = -500 + 2000;

/** Two syncs of one bank account; `extra` is money the bank moved that no row explains. */
function twoSyncs(extra = 0, later: ScrapedTransaction[] = []): Db {
  const db = newDb();
  ingest(db, [withBalance(START, before)], { now: AT_A });
  ingest(db, [withBalance(START + moved + extra, [...before, ...between, ...later])], { now: AT_B });
  return db;
}

const checkOf = (db: Db) => balanceChecks(db).find((c) => c.accountId === accountId(db, "discount", BANK_NUMBER));

describe("balance snapshots", () => {
  it("keeps one per account per sync that sent a balance", () => {
    const db = twoSyncs();
    const rows = db.prepare("SELECT balance, taken_at, sync_run_id FROM balance_snapshots ORDER BY id").all();
    expect(rows).toEqual([
      { balance: START, taken_at: AT_A.toISOString(), sync_run_id: 1 },
      { balance: START + moved, taken_at: AT_B.toISOString(), sync_run_id: 2 },
    ]);
    expect(db.prepare("SELECT balance FROM accounts").get()).toEqual({ balance: START + moved });
  });

  it("keeps none for a sync without a balance, and the sync still succeeds", () => {
    const db = newDb();
    const result = ingest(db, [withBalance(null, before), withBalance(null, [], "100-999999")], { now: AT_A });
    expect(result).toMatchObject({ accounts: 2, newRows: 2 });
    ingest(db, [card("4321", [row("02", -100, "מאפייה")])], { now: AT_A });
    expect(db.prepare("SELECT COUNT(*) AS n FROM balance_snapshots").get()).toEqual({ n: 0 });
    expect(checkOf(db)).toMatchObject({ status: "unknown", unknownReason: "no_balance", balance: null });
  });

  it("an account listed twice in one download keeps one snapshot", () => {
    const db = newDb();
    ingest(db, [withBalance(100, []), withBalance(200, [])], { now: AT_A });
    expect(db.prepare("SELECT balance FROM balance_snapshots").all()).toEqual([{ balance: 200 }]);
  });
});

describe("balanceChecks", () => {
  it("matches when the rows between two balances add up", () => {
    expect(checkOf(twoSyncs())).toEqual({
      accountId: 1,
      balance: START + moved,
      asOf: AT_B.toISOString(),
      status: "matches",
      unknownReason: null,
      window: { from: "2026-03-10", to: "2026-03-14" },
      rowCount: 2,
      gap: 0,
    });
  });

  it("shows a gap of one missing row, exact to the agora", () => {
    expect(checkOf(twoSyncs(-12_000))).toMatchObject({ status: "gap", gap: -12_000, rowCount: 2 });
    expect(checkOf(twoSyncs(1))).toMatchObject({ status: "gap", gap: 1 });
  });

  it("leaves pending rows out: they are not in the bank's balance yet", () => {
    const pending = row("13", -9900, "הוראת קבע עתידית", { status: "pending" });
    const db = twoSyncs(0, [pending]);
    expect(checkOf(db)).toMatchObject({ status: "matches", rowCount: 2 });

    // Counting it would have shown a gap the bank does not have.
    const wrong = twoSyncs(-9900, [pending]);
    expect(checkOf(wrong)).toMatchObject({ status: "gap", gap: -9900 });
  });

  it("counts a pending row once it settles and the bank books it", () => {
    const db = twoSyncs(0, [row("15", -9900, "הוראת קבע", { status: "pending" })]);
    const atC = new Date("2026-03-15T08:00:00Z");
    const all = [...before, ...between, row("15", -9900, "הוראת קבע")];
    ingest(db, [withBalance(START + moved - 9900, all)], { now: atC });
    expect(checkOf(db)).toMatchObject({ status: "matches", rowCount: 1, window: { from: "2026-03-14", to: "2026-03-15" } });
  });

  it("still counts trashed and excluded rows: the bank's money moved either way", () => {
    const db = twoSyncs();
    trashTransactions(db, [idOf(db, "קפה")], AT_B);
    updateTransactions(db, [idOf(db, "החזר")], { excluded: true }, AT_B);
    expect(checkOf(db)).toMatchObject({ status: "matches", rowCount: 2 });
  });

  it("counts a row booked on the older balance's day only if it came after that balance", () => {
    const late = row("10", -700, "חיוב מאוחר");
    const db = twoSyncs(-700, [late]);
    expect(checkOf(db)).toMatchObject({ status: "matches", rowCount: 3 });
  });

  it("leaves out rows saved after the newer balance", () => {
    const db = twoSyncs();
    // A later sync without a balance brings a row for B's day.
    ingest(db, [withBalance(null, [...before, ...between, row("14", -300, "אחרי")])], {
      now: new Date("2026-03-14T15:00:00Z"),
    });
    expect(checkOf(db)).toMatchObject({ status: "matches", rowCount: 2 });
  });

  it("is unknown with one balance, and for a card", () => {
    const db = newDb();
    ingest(db, [withBalance(START, before)], { now: AT_A });
    ingest(db, [{ ...card("4321", [row("02", -100, "מאפייה")]), balance: -25_000 }], { now: AT_A });
    ingest(db, [{ ...card("4321", [row("02", -100, "מאפייה")]), balance: -25_100 }], { now: AT_B });
    const [bankCheck, cardCheck] = balanceChecks(db);
    expect(bankCheck).toMatchObject({ status: "unknown", unknownReason: "one_balance", balance: START, window: null });
    expect(cardCheck).toMatchObject({ status: "unknown", unknownReason: "card", gap: 0 });
  });

  it("leaves the cash wallet out", () => {
    const db = twoSyncs();
    db.exec("INSERT INTO accounts (provider, kind, account_number, created_at, sync_enabled) VALUES ('cash', 'cash', 'cash', 'c', 0)");
    expect(balanceChecks(db)).toHaveLength(1);
  });
});

describe("migration 0011 (balance snapshots)", () => {
  it("keeps every account and row", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
    for (const m of MIGRATIONS.filter((x) => x.version <= 10)) {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '')").run(m.version);
    }
    db.exec(`INSERT INTO accounts (id, provider, kind, account_number, card_mode, balance, last_synced_at, created_at)
      VALUES (3, 'discount', 'bank', '111', NULL, 500, 's', 'c'), (7, 'visaCal', 'card', '4321', 'credit', NULL, 's', 'c')`);
    db.exec(`INSERT INTO sync_runs (id, provider, synced_at) VALUES (1, 'discount', 's')`);
    db.exec(`INSERT INTO transactions (account_id, date, amount, description, status, excluded, trashed_at,
      dedup_hash, dedup_seq, sync_run_id, created_at, updated_at)
      VALUES (3, '2026-03-01', 5000, 'salary', 'completed', 0, NULL, 'h1', 0, 1, 'c', 'u'),
             (7, '2026-03-02', -100, 'coffee', 'pending', 1, 't', 'h2', 0, 1, 'c', 'u')`);
    const all = (sql: string) => db.prepare(sql).all();
    const tables = ["accounts", "transactions", "sync_runs"].map((t) => all(`SELECT * FROM ${t} ORDER BY id`));

    migrate(db);

    expect(["accounts", "transactions", "sync_runs"].map((t) => all(`SELECT * FROM ${t} ORDER BY id`))).toEqual(tables);
    expect(all("SELECT * FROM balance_snapshots")).toEqual([]);
    expect(all("PRAGMA foreign_key_check")).toEqual([]);
    expect(() => db.exec("INSERT INTO balance_snapshots (account_id, balance, taken_at, sync_run_id) VALUES (3, 1.5, 't', 1)")).toThrow();
    expect(() => db.exec("INSERT INTO balance_snapshots (account_id, balance, taken_at, sync_run_id) VALUES (99, 1, 't', 1)")).toThrow();
  });
});
