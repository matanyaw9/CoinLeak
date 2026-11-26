// Restore, choose what to keep (spec 41 B): each choice leaves its parts and
// nothing of the others, categories always stay, rule-sorted rows keep what a
// rule gave them, and nothing removed is left in the file's bytes.

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { seedDemo } from "@core/demo";
import { setBudget, updateTransactions } from "@core/ledger";
import { applyAllRules, createRule } from "@core/rules";
import { getSetting } from "@core/settings";
import { categoryId, NOW } from "@core/testing/ledger";
import { ruleInput } from "@core/testing/rules";
import type { RestoreKeep } from "@shared/types";
import { checkBackup, openDatabase, trimRestored, writeBackup, type Db } from "./index";

const dirs: string[] = [];
const open: Db[] = [];
afterEach(() => {
  for (const db of open.splice(0)) if (db.isOpen) db.close();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const NOTE = "פתק סודי מאוד";

/** The Demo profile plus an exception, a note, a tombstone, an ignoring rule and a Groceries budget. */
function fullDatabase(): { db: Db; path: string } {
  const dir = mkdtempSync(join(process.env["TMPDIR"] ?? tmpdir(), "coinleak-restore-"));
  dirs.push(dir);
  const path = join(dir, "profile.db");
  const db = openDatabase(path);
  open.push(db);
  seedDemo(db, NOW);
  createRule(db, ruleInput({ matchText: "ארומה", setExcluded: true }), NOW);
  const [first, second] = column(db, "SELECT id FROM transactions ORDER BY id LIMIT 2") as number[];
  updateTransactions(db, [first as number], { note: NOTE });
  db.prepare("INSERT INTO rule_exceptions (rule_id, transaction_id) SELECT MIN(id), ? FROM rules").run(second as number);
  db.exec("INSERT INTO trash_tombstones SELECT account_id, 'gone-for-good', 0, '2026-01-01' FROM transactions LIMIT 1");
  setBudget(db, categoryId(db, "Groceries"), 150_000, { raiseParents: true });
  applyAllRules(db, NOW);
  return { db, path };
}

/** The first column of every row. */
const column = (db: Db, sql: string): unknown[] => db.prepare(sql).all().map((r) => Object.values(r)[0]);
const count = (db: Db, from: string): number => column(db, `SELECT COUNT(*) FROM ${from}`)[0] as number;

const categories = (db: Db) =>
  db.prepare("SELECT id, parent_id, name, kind, emoji, color, archived, sort_order, essential FROM categories ORDER BY id").all();

/** What a row shows of the rules' work, without who did it. */
const outcomes = (db: Db) =>
  db.prepare("SELECT id, category_id, excluded, internal, note, trashed_at FROM transactions ORDER BY id").all();

/** How much of each part a database holds. */
function parts(db: Db) {
  return {
    transactions: count(db, "transactions"),
    accounts: count(db, "accounts WHERE kind <> 'cash'"),
    ruleAccounts: count(db, "accounts WHERE id IN (SELECT account_id FROM rule_conditions)"),
    balances: count(db, "balance_snapshots"),
    syncRuns: count(db, "sync_runs"),
    tombstones: count(db, "trash_tombstones"),
    exceptions: count(db, "rule_exceptions"),
    rules: count(db, "rules"),
    conditions: count(db, "rule_conditions"),
    categoryBudgets: count(db, "categories WHERE monthly_budget IS NOT NULL"),
    total: getSetting(db, "budgetTotal"),
  };
}

const CHOICES: RestoreKeep[] = [true, false]
  .flatMap((transactions) =>
    [true, false].flatMap((rules) => [true, false].map((budgets) => ({ transactions, rules, budgets }))),
  )
  .filter((k) => k.transactions || k.rules || k.budgets);

describe("trimRestored", () => {
  it.each(CHOICES)("transactions $transactions, rules $rules, budgets $budgets", (keep) => {
    const { db } = fullDatabase();
    const before = parts(db);
    for (const [part, n] of Object.entries(before)) expect(n, part).toBeTruthy();
    const cats = categories(db);
    const wallet = db.prepare("SELECT id, name FROM accounts WHERE kind = 'cash'").get();
    expect(wallet).toBeDefined();
    const shown = count(db, "transactions WHERE trashed_at IS NULL");

    const brought = trimRestored(db, keep);

    const t = keep.transactions;
    const r = keep.rules;
    expect(brought).toEqual({ transactions: t ? shown : null, rules: r ? before.rules : null, budgets: keep.budgets });
    expect(parts(db)).toEqual({
      transactions: t ? before.transactions : 0,
      // The Demo has rules limited to one account: those accounts stay with the rules.
      accounts: t ? before.accounts : r ? before.ruleAccounts : 0,
      ruleAccounts: r ? before.ruleAccounts : 0,
      balances: t ? before.balances : 0,
      syncRuns: t ? before.syncRuns : 0,
      tombstones: t ? before.tombstones : 0,
      exceptions: t && r ? before.exceptions : 0,
      rules: r ? before.rules : 0,
      conditions: r ? before.conditions : 0,
      categoryBudgets: keep.budgets ? before.categoryBudgets : 0,
      total: keep.budgets ? before.total : null,
    });
    expect(categories(db)).toEqual(cats);
    expect(db.prepare("SELECT id, name FROM accounts WHERE kind = 'cash'").get()).toEqual(wallet);
    expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
  });

  it("without rules, rows a rule sorted or ignored stay so, as the user's, and a rule run changes nothing", () => {
    const { db } = fullDatabase();
    const sorted = column(db, "SELECT id FROM transactions WHERE category_source = 'rule'") as number[];
    const ignored = column(db, "SELECT id FROM transactions WHERE excluded_source = 'rule' AND excluded = 1") as number[];
    expect(sorted.length).toBeGreaterThan(0);
    expect(ignored.length).toBeGreaterThan(0);
    const before = outcomes(db);

    trimRestored(db, { transactions: true, rules: false, budgets: true });

    expect(outcomes(db)).toEqual(before);
    const source = (id: number, field: string) => column(db, `SELECT ${field} FROM transactions WHERE id = ${id}`)[0];
    for (const id of sorted) expect(source(id, "category_source")).toBe("user");
    for (const id of ignored) expect(source(id, "excluded_source")).toBe("user");
    expect(count(db, "transactions WHERE rule_id IS NOT NULL")).toBe(0);
    expect(applyAllRules(db, NOW)).toEqual({ changed: 0, sorted: 0 });
    expect(outcomes(db)).toEqual(before);
  });

  it("without transactions, an account a kept rule is limited to stays, emptied", () => {
    const { db } = fullDatabase();
    const named = "SELECT account_id FROM rule_conditions WHERE kind = 'account' ORDER BY rule_id";
    const conditions = column(db, named);
    expect(conditions.length).toBeGreaterThan(0);
    expect(count(db, "accounts WHERE kind <> 'cash'")).toBeGreaterThan(new Set(conditions).size);

    trimRestored(db, { transactions: false, rules: true, budgets: false });

    expect(column(db, named)).toEqual(conditions);
    expect(column(db, "SELECT id FROM accounts WHERE kind <> 'cash' ORDER BY id")).toEqual(
      [...new Set(conditions as number[])].sort((a, b) => a - b),
    );
    expect(count(db, "accounts WHERE balance IS NOT NULL OR last_synced_at IS NOT NULL")).toBe(0);
  });

  it("leaves no removed text in the file or beside it, and the file still checks out", () => {
    const { db, path } = fullDatabase();
    // Without rules too: a kept rule rightly holds the shop names it looks for.
    const gone = column(
      db,
      "SELECT description FROM transactions UNION SELECT memo FROM transactions WHERE memo IS NOT NULL",
    ) as string[];
    gone.push(NOTE);
    expect(gone.length).toBeGreaterThan(20);
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    expect(readFileSync(path).includes(NOTE)).toBe(true);

    trimRestored(db, { transactions: false, rules: false, budgets: true });

    const bytes = Buffer.concat([path, `${path}-wal`].filter((p) => existsSync(p)).map((p) => readFileSync(p)));
    expect(gone.filter((text) => bytes.includes(text))).toEqual([]);
    const backup = join(path, "..", "again.coinleak");
    writeBackup(db, backup);
    expect(checkBackup(backup)).toBeUndefined();
  });
});
