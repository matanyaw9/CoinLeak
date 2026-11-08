// Migration 0007 turns each one-condition rule into a rule with a list of
// conditions. Every old rule must match exactly the rows it matched before.

import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import { migrate } from "../db";
import { MIGRATIONS } from "../db/migrations";
import { applyRules } from "./engine";
import { compileMatcher, normalizeText, prepareRow } from "./match";
import { loadRules } from "./store";

interface OldRule {
  name: string;
  enabled: number;
  match_field: "description" | "memo";
  match_mode: "contains" | "starts_with" | "equals" | "regex";
  match_text: string;
  account_id: number | null;
  amount_min: number | null;
  amount_max: number | null;
  direction: "in" | "out" | null;
  set_category: string | null;
  set_excluded: number | null;
}

interface Row {
  id: number;
  account_id: number;
  amount: number;
  description: string;
  memo: string | null;
}

// Every mode, both fields, each optional condition, an exclude rule and one switched off.
const OLD_RULES: OldRule[] = [
  old("Salary", "description", "equals", "משכורת", { account_id: 1, direction: "in", set_category: "Salary" }),
  old("Savings", "description", "starts_with", "העברה לחיסכון", { set_excluded: 1 }),
  old("Shufersal", "description", "starts_with", "שופרסל", { set_category: "Groceries" }),
  old("Small coffee", "description", "contains", "קפה", { amount_max: 3000, set_category: "Coffee & Cafes" }),
  old("Mid fuel", "description", "contains", "פז", {
    amount_min: 10000,
    amount_max: 40000,
    account_id: 2,
    set_category: "Transport",
  }),
  old("Streaming", "description", "regex", "netflix|spotify", { set_category: "Subscriptions" }),
  old("Standing order", "memo", "equals", "הוראת קבע", { direction: "out", set_category: "Bills & Utilities" }),
  old("Big refunds", "description", "contains", "זיכוי", {
    amount_min: 5000,
    direction: "in",
    set_category: "Shopping",
  }),
  old("Off", "description", "contains", "קפה", { enabled: 0, set_category: "Restaurants" }),
];

const ROWS: Omit<Row, "id">[] = [
  r(1, 1500000, "משכורת"),
  r(2, 1500000, "משכורת"),
  r(1, -200000, "העברה לחיסכון חודשי"),
  r(2, -12000, "שופרסל דיל רמת גן"),
  r(2, -8550, "שופרסל  שלי"),
  r(1, -2400, "קפה גרג"),
  r(1, -4800, "קפה גרג"),
  r(2, -30000, "פז ראשון"),
  r(1, -30000, "פז ראשון"),
  r(2, -5000, "פז ראשון"),
  r(2, -4990, "NETFLIX.COM"),
  r(2, -1990, "Spotify AB"),
  r(1, -25000, "חברת חשמל", "הוראת קבע"),
  r(1, 25000, "חברת חשמל", "הוראת קבע"),
  r(2, 9000, "זיכוי חנות בגדים"),
  r(2, 1000, "זיכוי חנות בגדים"),
  r(2, -9000, "זיכוי חנות בגדים"),
];

function old(
  name: string,
  match_field: OldRule["match_field"],
  match_mode: OldRule["match_mode"],
  match_text: string,
  rest: Partial<OldRule>,
): OldRule {
  return {
    name,
    enabled: 1,
    match_field,
    match_mode,
    match_text,
    account_id: null,
    amount_min: null,
    amount_max: null,
    direction: null,
    set_category: null,
    set_excluded: null,
    ...rest,
  };
}

function r(account_id: number, amount: number, description: string, memo: string | null = null): Omit<Row, "id"> {
  return { account_id, amount, description, memo };
}

/** The spec 07 matcher, written out again from the spec, to compare against. */
function oldMatches(rule: OldRule, row: Row): boolean {
  if (rule.account_id !== null && row.account_id !== rule.account_id) return false;
  if (rule.direction !== null && (row.amount > 0 ? "in" : "out") !== rule.direction) return false;
  const size = Math.abs(row.amount);
  if (rule.amount_min !== null && size < rule.amount_min) return false;
  if (rule.amount_max !== null && size > rule.amount_max) return false;
  const raw = rule.match_field === "description" ? row.description : row.memo;
  if (raw === null) return false;
  const text = normalizeText(raw);
  if (rule.match_mode === "regex") return new RegExp(rule.match_text, "i").test(text);
  const p = normalizeText(rule.match_text);
  if (rule.match_mode === "contains") return text.includes(p);
  if (rule.match_mode === "starts_with") return text.startsWith(p);
  return text === p;
}

/** A database at version 5 (before 0007) with the old rules and the rows. */
function beforeMigration(): Db {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (const m of MIGRATIONS.filter((m) => m.version <= 5)) {
    db.exec(m.sql);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, '')").run(m.version);
  }
  db.exec(`INSERT INTO accounts (id, provider, kind, account_number, card_mode, created_at) VALUES
    (1, 'discount', 'bank', '1', NULL, ''), (2, 'visaCal', 'card', '4321', 'credit', '')`);
  const insertRow = db.prepare(
    `INSERT INTO transactions (account_id, date, amount, description, memo, status, dedup_hash, dedup_seq,
       created_at, updated_at) VALUES (?, '2026-03-01', ?, ?, ?, 'completed', ?, 0, '', '')`,
  );
  ROWS.forEach((row, i) => insertRow.run(row.account_id, row.amount, row.description, row.memo, `h${i}`));
  const insertRule = db.prepare(
    `INSERT INTO rules (name, position, enabled, match_field, match_mode, match_text, account_id, amount_min,
       amount_max, direction, set_category_id, set_excluded, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT id FROM categories WHERE name = ?), ?, '', '')`,
  );
  OLD_RULES.forEach((o, i) =>
    insertRule.run(
      o.name,
      i + 1,
      o.enabled,
      o.match_field,
      o.match_mode,
      o.match_text,
      o.account_id,
      o.amount_min,
      o.amount_max,
      o.direction,
      o.set_category,
      o.set_excluded,
    ),
  );
  return db;
}

const rowsOf = (db: Db) =>
  db
    .prepare("SELECT id, account_id, amount, description, memo FROM transactions ORDER BY id")
    .all() as unknown as Row[];

describe("migration 0007, rule conditions", () => {
  it("keeps every existing rule's matches identical", () => {
    const db = beforeMigration();
    const rows = rowsOf(db);
    const before = OLD_RULES.map((o) => rows.filter((row) => oldMatches(o, row)).map((row) => row.id));
    // The fixture exercises each rule.
    expect(before.every((ids) => ids.length > 0)).toBe(true);

    migrate(db);
    const rules = loadRules(db);
    expect(rules.map((x) => [x.name, x.position, x.enabled, x.join])).toEqual(
      OLD_RULES.map((o, i) => [o.name, i + 1, o.enabled === 1, "all"]),
    );
    const after = rules.map((rule) => {
      const fits = compileMatcher(rule);
      return rows
        .filter((row) =>
          fits(
            prepareRow({ accountId: row.account_id, amount: row.amount, description: row.description, memo: row.memo }),
          ),
        )
        .map((row) => row.id);
    });
    expect(after).toEqual(before);
  });

  it("writes each part of an old rule as its own condition, and keeps the actions", () => {
    const db = beforeMigration();
    migrate(db);
    const [salary, savings, , , fuel] = loadRules(db);
    expect(salary).toMatchObject({
      conditions: [
        { kind: "text", field: "description", mode: "equals", values: ["משכורת"] },
        { kind: "account", accountId: 1 },
        { kind: "direction", direction: "in" },
      ],
      setExcluded: null,
    });
    expect(savings).toMatchObject({ setCategoryId: null, setExcluded: true });
    expect(fuel?.conditions).toEqual([
      { kind: "text", field: "description", mode: "contains", values: ["פז"] },
      { kind: "account", accountId: 2 },
      { kind: "amount", min: 10000, max: 40000 },
    ]);
  });

  it("keeps the rows' links to their rules, so nothing changes when the rules run again", () => {
    const db = beforeMigration();
    // Mark the rows the way the old engine left them: run the rules once on the new schema copy.
    const reference = beforeMigration();
    migrate(reference);
    applyRules(reference, "all");
    const fields = "category_id, category_source, excluded, excluded_source, rule_id";
    const sorted = reference.prepare(`SELECT id, ${fields} FROM transactions ORDER BY id`).all() as unknown as Record<
      string,
      unknown
    >[];
    const write = db.prepare(
      `UPDATE transactions SET category_id = ?, category_source = ?, excluded = ?, excluded_source = ?, rule_id = ?
       WHERE id = ?`,
    );
    for (const s of sorted) {
      write.run(
        s.category_id as number | null,
        s.category_source as string | null,
        s.excluded as number,
        s.excluded_source as string | null,
        s.rule_id as number | null,
        s.id as number,
      );
    }
    const linked = db.prepare(`SELECT id, ${fields} FROM transactions ORDER BY id`).all();
    expect(linked.filter((x) => (x as { rule_id: number | null }).rule_id !== null).length).toBeGreaterThan(5);

    migrate(db);
    expect(db.prepare(`SELECT id, ${fields} FROM transactions ORDER BY id`).all()).toEqual(linked);
    expect(applyRules(db, "all")).toEqual({ changed: 0 });
  });
});
