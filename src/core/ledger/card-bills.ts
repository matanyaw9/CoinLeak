// Card bills: a bank line that pays a tracked card is `internal`, because the
// card's own rows are the spending. A card-looking line that matches nothing
// stays spending with the `possible_card_bill` flag. Matching styles follow
// Pocket's REQUIREMENTS section 6 (debit 1:1, credit cycle sum). Gone rows
// take no part: the bank no longer reports them, so they paid nothing.
// Trashed rows take no part either, and their own state is left as it is.
// A line naming one synced card's last 4 digits pays it even when sums differ (spec 32).

import type { CardBillState, CardMode, IsoDate, ProviderId } from "@shared/types";
import { transaction, type Db } from "../db";
import { companyOf, last4, readCardLine, standaloneNumbers, type CardLine } from "./card-patterns";
import { isCashWithdrawal } from "./cash-patterns";
import { daysApart, isIsoDate, israelMonth } from "./dates";
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
  const plan = planCardBills(cards, loadCardRows(db), lines, loadWallet(db));
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
 * Spec 20: a line no card took that looks like an ATM withdrawal, from the
 * wallet's first month on, is money moved into the cash wallet.
 */
function planCardBills(
  cards: CardAccount[],
  cardRows: CardRow[],
  lines: BankLine[],
  wallet: Wallet | null,
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
  const toWallet = (line: BankLine): boolean =>
    wallet !== null && line.date >= wallet.since && isCashWithdrawal(line.description, line.amount);
  for (const { line, info } of open) {
    const named = namedCard(line, info !== null, cards);
    const auto =
      wallet && toWallet(line)
        ? { ...PLAIN, internal: 1 as Bit, card_bill_account_id: wallet.id }
        : named
          ? billByNumber(line, named, rowsByCard.get(named.id) ?? [])
          : info
            ? FLAGGED
            : PLAIN;
    plan.set(line.id, decided.get(line.id) ?? auto);
  }
  return plan;
}

/** How far a numbered bill may be from the card's billing day to point at it. */
const BILL_DAY_WINDOW_DAYS = 10;

/**
 * Spec 32 (F75): money out naming exactly one synced card's last 4 digits
 * pays that card, sums or not. Two cards with those digits decide nothing,
 * and a cash withdrawal is never a card bill (its digits are often an ATM's).
 */
function namedCard(line: BankLine, cardLike: boolean, cards: CardAccount[]): CardAccount | null {
  if (line.amount >= 0 || isCashWithdrawal(line.description, line.amount)) return null;
  // On a line with no card wording, 1990 to 2099 is most likely a year ("ארנונה 2025").
  const numbers = standaloneNumbers(line.description).filter((n) => cardLike || !isLikelyYear(n));
  if (numbers.length === 0) return null;
  const named = cards.filter((c) => c.last4 !== null && numbers.includes(c.last4));
  return named.length === 1 ? (named[0] ?? null) : null;
}

function isLikelyYear(digits: string): boolean {
  const n = Number(digits);
  return n >= 1990 && n <= 2099;
}

/** The line pays the card in its own style. Credit: the nearest billing day within 10 days. Consumes no rows. */
function billByNumber(line: BankLine, card: CardAccount, rows: CardRow[]): MatchState {
  let billDate: IsoDate | null = null;
  if (card.mode === "credit") {
    const days = [...new Set(rows.map((r) => r.billDate))]
      .filter((d) => daysApart(d, line.date) <= BILL_DAY_WINDOW_DAYS)
      .sort((a, b) => daysApart(a, line.date) - daysApart(b, line.date) || a.localeCompare(b));
    billDate = days[0] ?? null;
  }
  return {
    internal: 1,
    possible_card_bill: 0,
    card_bill_account_id: card.id,
    card_bill_style: card.mode,
    card_bill_txn_id: null,
    card_bill_date: billDate,
  };
}

interface Wallet {
  id: number;
  /** First day bank withdrawals move into it. */
  since: IsoDate;
}

/**
 * The cash wallet and the first day withdrawals move into it: the first of
 * the month it started, the earlier of the month it was made and the month
 * of its oldest row. Older withdrawals stay spending, because the cash they
 * took out was never written down here.
 */
function loadWallet(db: Db): Wallet | null {
  const row = db
    .prepare(
      `SELECT a.id, a.created_at, (SELECT MIN(t.date) FROM transactions t WHERE t.account_id = a.id) AS first
       FROM accounts a WHERE a.kind = 'cash'`,
    )
    .get() as { id: number; created_at: string; first: IsoDate | null } | undefined;
  if (!row) return null;
  const made = israelMonth(new Date(row.created_at));
  const firstRow = row.first?.slice(0, 7) ?? made;
  return { id: row.id, since: `${firstRow < made ? firstRow : made}-01` };
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
       WHERE a.kind = 'card' AND t.gone_at IS NULL AND t.trashed_at IS NULL ORDER BY t.id`,
    )
    .all() as unknown as CardRow[];
}

function loadBankLines(db: Db): BankLine[] {
  return db
    .prepare(
      `SELECT t.id, t.date, t.amount, t.description, t.excluded, t.internal_by_user, t.internal,
         t.possible_card_bill, t.card_bill_account_id, t.card_bill_style, t.card_bill_txn_id, t.card_bill_date
       FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE a.kind = 'bank' AND t.gone_at IS NULL AND t.trashed_at IS NULL ORDER BY t.date, t.id`,
    )
    .all() as unknown as BankLine[];
}

// ---- User decisions ----

/**
 * The user's word on whether rows are internal. `null` hands the rows back
 * to the matcher. Either way card bills are recomputed, because freeing or
 * taking a bank line can change what other lines match. `before` holds each
 * named row's state as it was, for Undo (`restoreInternal`).
 */
export function setInternalByUser(
  db: Db,
  ids: number[],
  internal: boolean | null,
  now = new Date(),
): { updated: number; before: CardBillState[] } {
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
    const before = cardBillStatesOf(db, ids);
    let updated = 0;
    for (const id of new Set(ids)) updated += Number(stmt.run(at, id).changes);
    applyCardBills(db);
    return { updated, before };
  });
}

/**
 * Undo of `setInternalByUser`: writes each row back as `before` reported it,
 * then rematches. A row the matcher owned goes back to the matcher. A row the
 * user had marked keeps the mark and the card rows it used up, so no other
 * line can take them.
 */
export function restoreInternal(db: Db, states: CardBillState[], now = new Date()): { updated: number } {
  check(Array.isArray(states) && states.every(isCardBillState));
  check(new Set(states.map((s) => s.id)).size === states.length);
  if (states.length === 0) return { updated: 0 };

  return transaction(db, () => {
    // The subquery leaves the link empty if that card row was deleted for good meanwhile.
    const stmt = db.prepare(
      `UPDATE transactions SET internal = ?, internal_by_user = ?, possible_card_bill = ?, card_bill_account_id = ?,
         card_bill_style = ?, card_bill_txn_id = (SELECT id FROM transactions WHERE id = ?), card_bill_date = ?,
         updated_at = ? WHERE id = ?`,
    );
    let updated = 0;
    for (const s of states) {
      const result = stmt.run(
        s.internal ? 1 : 0,
        s.internalByUser ? 1 : 0,
        s.possibleCardBill ? 1 : 0,
        s.cardBillAccountId,
        s.cardBillStyle,
        s.cardBillTxnId,
        s.cardBillDate,
        now.toISOString(),
        s.id,
      );
      updated += Number(result.changes);
    }
    applyCardBills(db);
    return { updated };
  });
}

function cardBillStatesOf(db: Db, ids: number[]): CardBillState[] {
  const rows = db
    .prepare(
      `SELECT id, internal, internal_by_user, possible_card_bill, card_bill_account_id, card_bill_style,
         card_bill_txn_id, card_bill_date
       FROM transactions WHERE id IN (SELECT value FROM json_each(?)) ORDER BY id`,
    )
    .all(JSON.stringify(ids)) as unknown as (MatchState & { id: number; internal_by_user: Bit })[];
  return rows.map((r) => ({
    id: r.id,
    internal: r.internal === 1,
    internalByUser: r.internal_by_user === 1,
    possibleCardBill: r.possible_card_bill === 1,
    cardBillAccountId: r.card_bill_account_id,
    cardBillStyle: r.card_bill_style,
    cardBillTxnId: r.card_bill_txn_id,
    cardBillDate: r.card_bill_date,
  }));
}

function isCardBillState(value: unknown): value is CardBillState {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<CardBillState>;
  return (
    isId(s.id) &&
    typeof s.internal === "boolean" &&
    typeof s.internalByUser === "boolean" &&
    typeof s.possibleCardBill === "boolean" &&
    (s.cardBillAccountId === null || isId(s.cardBillAccountId)) &&
    (s.cardBillStyle === null || s.cardBillStyle === "credit" || s.cardBillStyle === "debit") &&
    (s.cardBillTxnId === null || isId(s.cardBillTxnId)) &&
    (s.cardBillDate === null || isIsoDate(s.cardBillDate))
  );
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
