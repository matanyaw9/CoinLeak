// Card bills: a bank line that pays a tracked card is `internal`, because the
// card's own rows are the spending. A card-looking line that matches nothing
// stays spending with the `possible_card_bill` flag. Matching styles follow
// Pocket's REQUIREMENTS section 6 (debit 1:1, credit cycle sum).

import type { CardMode, IsoDate, ProviderId } from "@shared/types";
import { transaction, type Db } from "../db";
import { companyOf, last4, readCardLine, type CardLine } from "./card-patterns";
import { daysApart } from "./dates";
import { assertIds, check, isId } from "./validate";

export const MATCH_WINDOW_DAYS = 3;

type Style = CardMode;
type Bit = 0 | 1;

interface CardAccount {
  id: number;
  provider: ProviderId;
  last4: string | null;
  mode: CardMode;
}

interface CardRow {
  id: number;
  accountId: number;
  amount: number;
  /** The day the row hits the bank: processed date, else purchase date. */
  billDate: IsoDate;
}

interface MatchState {
  internal: Bit;
  possible_card_bill: Bit;
  card_bill_account_id: number | null;
  card_bill_style: Style | null;
  card_bill_txn_id: number | null;
  card_bill_date: IsoDate | null;
}

interface BankLine extends MatchState {
  id: number;
  date: IsoDate;
  amount: number;
  description: string;
  excluded: Bit;
  internal_by_user: Bit;
}

interface Candidate {
  line: BankLine;
  card: CardAccount;
  style: Style;
  rows: CardRow[];
  billDate: IsoDate;
  days: number;
  numbered: boolean;
}

const PLAIN: MatchState = {
  internal: 0,
  possible_card_bill: 0,
  card_bill_account_id: null,
  card_bill_style: null,
  card_bill_txn_id: null,
  card_bill_date: null,
};
const FLAGGED: MatchState = { ...PLAIN, possible_card_bill: 1 };
const STATE_KEYS = Object.keys(PLAIN) as (keyof MatchState)[];

export interface CardBillStats {
  matched: number;
  flagged: number;
  changed: number;
}

/** Recomputes every automatic card-bill decision. Safe to run any time. */
export function recomputeCardBills(db: Db): CardBillStats {
  return transaction(db, () => applyCardBills(db));
}

/** Same as `recomputeCardBills`, for callers already inside a transaction. */
export function applyCardBills(db: Db): CardBillStats {
  const cards = loadCards(db);
  const lines = loadBankLines(db);
  const plan = planCardBills(cards, loadCardRows(db), lines);
  const update = db.prepare(
    `UPDATE transactions SET internal = ?, possible_card_bill = ?, card_bill_account_id = ?,
       card_bill_style = ?, card_bill_txn_id = ?, card_bill_date = ? WHERE id = ?`,
  );
  const stats: CardBillStats = { matched: 0, flagged: 0, changed: 0 };
  for (const line of lines) {
    const next = plan.get(line.id);
    if (!next) continue;
    stats.matched += next.internal;
    stats.flagged += next.possible_card_bill;
    if (STATE_KEYS.every((k) => line[k] === next[k])) continue;
    update.run(...STATE_KEYS.map((k) => next[k]), line.id);
    stats.changed++;
  }
  return stats;
}

/**
 * Decides the state of every bank line the matcher may touch. Lines the
 * user excluded or set by hand are left out, but their existing matches
 * still use up card rows. Pass 1 tries each card's own style, pass 2 the
 * other style on what is left. Within a pass the strongest pairing wins:
 * a line naming the card's number, then the closest date.
 */
function planCardBills(
  cards: CardAccount[],
  cardRows: CardRow[],
  lines: BankLine[],
): Map<number, MatchState> {
  const rowsByCard = groupBy(cardRows, (r) => r.accountId);
  const consumed = new Set<number>();
  const isProtected = (l: BankLine): boolean => l.excluded === 1 || l.internal_by_user === 1;

  for (const l of lines.filter(isProtected)) {
    if (l.card_bill_style === "debit" && l.card_bill_txn_id !== null) consumed.add(l.card_bill_txn_id);
    if (l.card_bill_style === "credit" && l.card_bill_account_id !== null) {
      for (const r of rowsByCard.get(l.card_bill_account_id) ?? []) {
        if (r.billDate === l.card_bill_date) consumed.add(r.id);
      }
    }
  }

  const open = lines
    .filter((l) => !isProtected(l))
    .map((line) => ({ line, info: readCardLine(line.description) }));
  const decided = new Map<number, MatchState>();

  for (const pass of [1, 2] as const) {
    const freeByCard = new Map(
      cards.map((card) => [card.id, (rowsByCard.get(card.id) ?? []).filter((r) => !consumed.has(r.id))]),
    );
    const candidates: Candidate[] = [];
    for (const { line, info } of open) {
      if (!info || decided.has(line.id)) continue;
      for (const card of eligibleCards(info, cards)) {
        const style = pass === 1 ? card.mode : otherStyle(card.mode);
        const free = freeByCard.get(card.id) ?? [];
        const numbered = info.numbers.length > 0;
        const found = style === "debit" ? debitMatches(line, free) : cycleMatches(line, free);
        for (const { rows, billDate } of found) {
          candidates.push({ line, card, style, rows, billDate, numbered, days: daysApart(billDate, line.date) });
        }
      }
    }
    candidates.sort(strongestFirst);
    for (const c of candidates) {
      if (decided.has(c.line.id) || c.rows.some((r) => consumed.has(r.id))) continue;
      for (const r of c.rows) consumed.add(r.id);
      decided.set(c.line.id, {
        internal: 1,
        possible_card_bill: 0,
        card_bill_account_id: c.card.id,
        card_bill_style: c.style,
        card_bill_txn_id: c.style === "debit" ? (c.rows[0]?.id ?? null) : null,
        card_bill_date: c.style === "credit" ? c.billDate : null,
      });
    }
  }

  const plan = new Map<number, MatchState>();
  for (const { line, info } of open) plan.set(line.id, decided.get(line.id) ?? (info ? FLAGGED : PLAIN));
  return plan;
}

/** A numbered line can only pay the card with that number. A line naming a
 *  company can only pay that company's cards. Otherwise any card. */
function eligibleCards(info: CardLine, cards: CardAccount[]): CardAccount[] {
  if (info.numbers.length > 0) return cards.filter((c) => c.last4 !== null && info.numbers.includes(c.last4));
  if (info.companies.length > 0) {
    return cards.filter((c) => {
      const company = companyOf(c.provider);
      return company !== null && info.companies.includes(company);
    });
  }
  return cards;
}

function debitMatches(line: BankLine, free: CardRow[]): { rows: CardRow[]; billDate: IsoDate }[] {
  return free
    .filter((r) => r.amount === line.amount && daysApart(r.billDate, line.date) <= MATCH_WINDOW_DAYS)
    .map((r) => ({ rows: [r], billDate: r.billDate }));
}

function cycleMatches(line: BankLine, free: CardRow[]): { rows: CardRow[]; billDate: IsoDate }[] {
  const out: { rows: CardRow[]; billDate: IsoDate }[] = [];
  for (const [billDate, rows] of groupBy(free, (r) => r.billDate)) {
    const sum = rows.reduce((s, r) => s + r.amount, 0);
    if (sum !== 0 && sum === line.amount && daysApart(billDate, line.date) <= MATCH_WINDOW_DAYS) {
      out.push({ rows, billDate });
    }
  }
  return out;
}

function strongestFirst(a: Candidate, b: Candidate): number {
  return (
    Number(b.numbered) - Number(a.numbered) ||
    a.days - b.days ||
    a.line.date.localeCompare(b.line.date) ||
    a.line.id - b.line.id ||
    a.card.id - b.card.id ||
    a.billDate.localeCompare(b.billDate) ||
    (a.rows[0]?.id ?? 0) - (b.rows[0]?.id ?? 0)
  );
}

function otherStyle(mode: CardMode): Style {
  return mode === "debit" ? "credit" : "debit";
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

function loadCards(db: Db): CardAccount[] {
  const rows = db
    .prepare("SELECT id, provider, account_number, card_mode FROM accounts WHERE kind = 'card' ORDER BY id")
    .all() as { id: number; provider: ProviderId; account_number: string; card_mode: CardMode }[];
  return rows.map((r) => ({ id: r.id, provider: r.provider, last4: last4(r.account_number), mode: r.card_mode }));
}

function loadCardRows(db: Db): CardRow[] {
  return db
    .prepare(
      `SELECT t.id, t.account_id AS accountId, t.amount, COALESCE(t.processed_date, t.date) AS billDate
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE a.kind = 'card' ORDER BY t.id`,
    )
    .all() as unknown as CardRow[];
}

function loadBankLines(db: Db): BankLine[] {
  return db
    .prepare(
      `SELECT t.id, t.date, t.amount, t.description, t.excluded, t.internal_by_user, t.internal,
         t.possible_card_bill, t.card_bill_account_id, t.card_bill_style, t.card_bill_txn_id, t.card_bill_date
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE a.kind = 'bank' ORDER BY t.date, t.id`,
    )
    .all() as unknown as BankLine[];
}

// ---- User decisions ----

/**
 * The user's word on whether rows are internal. `null` hands the rows back
 * to the matcher. Either way card bills are recomputed, because freeing or
 * taking a bank line can change what other lines match.
 */
export function setInternalByUser(db: Db, ids: number[], internal: boolean | null, now = new Date()): number {
  assertIds(ids);
  check(internal === null || typeof internal === "boolean");
  const at = now.toISOString();
  return transaction(db, () => {
    const clearMatch = `card_bill_account_id = NULL, card_bill_style = NULL, card_bill_txn_id = NULL,
      card_bill_date = NULL, possible_card_bill = 0, updated_at = ?`;
    const sql =
      internal === null
        ? `UPDATE transactions SET internal = 0, internal_by_user = 0, ${clearMatch} WHERE id = ?`
        : internal
          ? "UPDATE transactions SET internal = 1, internal_by_user = 1, possible_card_bill = 0, updated_at = ? WHERE id = ?"
          : `UPDATE transactions SET internal = 0, internal_by_user = 1, ${clearMatch} WHERE id = ?`;
    const stmt = db.prepare(sql);
    let updated = 0;
    for (const id of new Set(ids)) updated += Number(stmt.run(at, id).changes);
    applyCardBills(db);
    return updated;
  });
}

/** Switches a card between credit and debit style and rematches its bills. */
export function setCardMode(db: Db, accountId: number, mode: CardMode): void {
  check(isId(accountId) && (mode === "credit" || mode === "debit"));
  transaction(db, () => {
    const res = db.prepare("UPDATE accounts SET card_mode = ? WHERE id = ? AND kind = 'card'").run(mode, accountId);
    check(Number(res.changes) === 1);
    applyCardBills(db);
  });
}
