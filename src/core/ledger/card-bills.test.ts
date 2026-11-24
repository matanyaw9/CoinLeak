import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import {
  NOW,
  accountId,
  bank,
  card,
  categoryId,
  charge,
  idOf,
  idsOf,
  newDb,
  snapshot,
  stored,
  txn,
} from "../testing/ledger";
import { recomputeCardBills, setCardMode, setInternalByUser } from "./card-bills";
import { restoreExclusions } from "./exclusions";
import { ingest } from "./ingest";
import { listTransactions, monthSummary, restoreTransactions, trashTransactions, updateTransactions } from "./queries";

const line = (date: string, amount: number, description: string) => txn({ date, amount, description });
const BILL_4321 = "חיוב לכרטיס ויזה 4321";
const BILL_8765 = "חיוב לכרטיס ויזה 8765";
const NUMBERLESS = "חיוב לכרטיס ויזה";
const NUMBERLESS_2 = "ויזה חיוב חודשי";

// A credit card cycle billed on 2026-03-10: three purchases, one bank line.
const cycle = () => [
  charge("2026-02-11", -10000, "סופר הדר", "2026-03-10"),
  charge("2026-02-20", -2550, "קפה הפינה", "2026-03-10"),
  charge("2026-03-01", -7450, "חנות ספרים", "2026-03-10"),
];

function row(db: Db, id: number) {
  const found = listTransactions(db).find((t) => t.id === id);
  if (!found) throw new Error(`row ${id} not listed`);
  return found;
}

function debitCard(db: Db, last4: string): void {
  ingest(db, [card(last4, [])], { now: NOW });
  setCardMode(db, accountId(db, "visaCal", last4), "debit");
}

describe("credit style", () => {
  it("matches one bank line to the sum of the card's rows with that processed date", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-10", -20000, BILL_4321)])], { now: NOW });

    const bill = idOf(db, BILL_4321);
    expect(row(db, bill)).toMatchObject({ flow: "internal", flags: [] });
    expect(stored(db, bill)).toMatchObject({
      internal: 1,
      possible_card_bill: 0,
      card_bill_account_id: accountId(db, "visaCal", "4321"),
      card_bill_style: "credit",
      card_bill_date: "2026-03-10",
      card_bill_txn_id: null,
    });
    for (const id of [...idsOf(db, "סופר הדר"), ...idsOf(db, "קפה הפינה"), ...idsOf(db, "חנות ספרים")]) {
      expect(row(db, id).flow).toBe("spending");
    }
  });

  it("counts the money once: the card rows, not the bill", () => {
    const db = newDb();
    const rows = [
      charge("2026-03-02", -10000, "סופר הדר", "2026-03-10"),
      charge("2026-03-03", -5000, "קפה הפינה", "2026-03-10"),
    ];
    ingest(db, [card("4321", rows)], { now: NOW });
    ingest(db, [bank([line("2026-03-10", -15000, BILL_4321)])], { now: NOW });
    expect(monthSummary(db, "2026-03").spending).toBe(15000);
  });

  it("matches a numberless Cal line by amount and date", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-11", -20000, "כ.א.ל חיוב")])], { now: NOW });
    expect(row(db, idOf(db, "כ.א.ל חיוב")).flow).toBe("internal");
  });

  it("does not match a numberless line that names another card company", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-10", -20000, "ישראכרט")])], { now: NOW });
    expect(row(db, idOf(db, "ישראכרט"))).toMatchObject({ flow: "spending", flags: expect.arrayContaining(["possible_card_bill"]) });
  });

  it("prefers the line that names the card over a numberless one", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-09", -20000, "תשלום אשראי"), line("2026-03-12", -20000, BILL_4321)])], {
      now: NOW,
    });
    expect(row(db, idOf(db, BILL_4321)).flow).toBe("internal");
    expect(row(db, idOf(db, "תשלום אשראי"))).toMatchObject({ flow: "spending", flags: expect.arrayContaining(["possible_card_bill"]) });
  });
});

describe("debit style", () => {
  it("matches each bank line 1:1 to one card purchase", () => {
    const db = newDb();
    debitCard(db, "8765");
    ingest(
      db,
      [
        card("8765", [
          charge("2026-03-03", -4500, "מאפייה", "2026-03-04"),
          charge("2026-03-03", -12000, "תחנת דלק", "2026-03-05"),
        ]),
      ],
      { now: NOW },
    );
    ingest(db, [bank([line("2026-03-05", -4500, BILL_8765), line("2026-03-06", -12000, BILL_8765)])], { now: NOW });

    const [small, big] = idsOf(db, BILL_8765) as [number, number];
    expect(stored(db, small)).toMatchObject({
      internal: 1,
      card_bill_style: "debit",
      card_bill_txn_id: idOf(db, "מאפייה"),
      card_bill_date: null,
    });
    expect(stored(db, big)).toMatchObject({ internal: 1, card_bill_txn_id: idOf(db, "תחנת דלק") });
  });

  it("pairs two identical purchases with two identical bank lines, one each", () => {
    const db = newDb();
    debitCard(db, "8765");
    const coffee = charge("2026-03-03", -1800, "קפה השכונה", "2026-03-04");
    ingest(db, [card("8765", [coffee, coffee])], { now: NOW });
    ingest(db, [bank([line("2026-03-04", -1800, BILL_8765), line("2026-03-04", -1800, BILL_8765)])], { now: NOW });
    const paid = idsOf(db, BILL_8765).map((id) => stored(db, id).card_bill_txn_id);
    expect(new Set(paid)).toEqual(new Set(idsOf(db, "קפה השכונה")));
  });

  it("falls back to the purchase date while a debit purchase is still pending", () => {
    const db = newDb();
    debitCard(db, "8765");
    ingest(db, [card("8765", [txn({ date: "2026-03-20", amount: -3000, description: "מכולת", status: "pending" })])], {
      now: NOW,
    });
    ingest(db, [bank([line("2026-03-21", -3000, "חיוב זמני למפתח מזומן")])], { now: NOW });
    expect(row(db, idOf(db, "חיוב זמני למפתח מזומן")).flow).toBe("internal");
  });

  it("a credit card still matches single purchases 1:1 when no cycle fits", () => {
    const db = newDb();
    const coffee = charge("2026-03-03", -1800, "קפה השכונה", "2026-03-04");
    ingest(db, [card("4321", [coffee, coffee])], { now: NOW });
    ingest(db, [bank([line("2026-03-04", -1800, BILL_4321), line("2026-03-04", -1800, BILL_4321)])], { now: NOW });
    expect(idsOf(db, BILL_4321).map((id) => row(db, id).flow)).toEqual(["internal", "internal"]);
  });
});

describe("untracked and unmatched card bills", () => {
  it("an untracked card bill stays spending and is flagged", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-10", -30000, "חיוב לכרטיס ויזה 5555")])], { now: NOW });
    const id = idOf(db, "חיוב לכרטיס ויזה 5555");
    expect(row(db, id)).toMatchObject({ flow: "spending", flags: ["uncategorized", "possible_card_bill"] });
    expect(monthSummary(db, "2026-03").spending).toBe(30000 + 7450);
  });

  it("with no cards tracked at all, every card bill is flagged spending", () => {
    const db = newDb();
    ingest(db, [bank([line("2026-03-10", -20000, BILL_4321), line("2026-03-11", -500, "כ.א.ל חיוב")])], { now: NOW });
    for (const t of listTransactions(db)) expect(t).toMatchObject({ flow: "spending", flags: expect.arrayContaining(["possible_card_bill"]) });
  });

  it("amounts off by one agora do not match", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    debitCard(db, "8765");
    ingest(db, [card("8765", [charge("2026-03-03", -4500, "מאפייה", "2026-03-04")])], { now: NOW });
    ingest(db, [bank([line("2026-03-10", -20001, NUMBERLESS), line("2026-03-04", -4499, NUMBERLESS_2)])], { now: NOW });
    for (const description of [NUMBERLESS, NUMBERLESS_2]) {
      expect(row(db, idOf(db, description))).toMatchObject({ flow: "spending", flags: expect.arrayContaining(["possible_card_bill"]) });
    }
  });

  it("matches within 3 days of the processed date, not 4", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-14", -20000, NUMBERLESS)])], { now: NOW });
    expect(row(db, idOf(db, NUMBERLESS)).flow).toBe("spending");
    ingest(db, [bank([line("2026-03-13", -20000, NUMBERLESS)])], { now: NOW });
    expect(idsOf(db, NUMBERLESS).map((id) => row(db, id).flow)).toEqual(["spending", "internal"]);
  });

  it("ordinary bank lines are never matched or flagged, even with a fitting amount", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-10", -20000, "העברה למיכאל")])], { now: NOW });
    expect(row(db, idOf(db, "העברה למיכאל"))).toMatchObject({ flow: "spending", flags: ["uncategorized"] });
  });

  it("a card synced later turns its flagged bills internal", () => {
    const db = newDb();
    ingest(db, [bank([line("2026-03-10", -20000, BILL_4321)])], { now: NOW });
    expect(row(db, idOf(db, BILL_4321)).flags).toContain("possible_card_bill");
    ingest(db, [card("4321", cycle())], { now: NOW });
    expect(row(db, idOf(db, BILL_4321))).toMatchObject({ flow: "internal", flags: [] });
  });
});

describe("rerun and user decisions", () => {
  function mixedLedger(): Db {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    debitCard(db, "8765");
    ingest(db, [card("8765", [charge("2026-03-03", -4500, "מאפייה", "2026-03-04")])], { now: NOW });
    ingest(
      db,
      [
        bank([
          line("2026-03-10", -20000, BILL_4321),
          line("2026-03-04", -4500, BILL_8765),
          line("2026-03-15", -9900, "חיוב לכרטיס ויזה 5555"),
          line("2026-03-16", -100, "משכורת"),
        ]),
      ],
      { now: NOW },
    );
    return db;
  }

  it("rerun is idempotent", () => {
    const db = mixedLedger();
    const before = snapshot(db);
    expect(recomputeCardBills(db)).toEqual({ matched: 2, flagged: 1, changed: 0 });
    expect(recomputeCardBills(db).changed).toBe(0);
    expect(snapshot(db)).toEqual(before);
  });

  it("re-ingesting the same downloads changes nothing", () => {
    const db = mixedLedger();
    const before = snapshot(db);
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-10", -20000, BILL_4321)])], { now: NOW });
    expect(snapshot(db)).toEqual(before);
  });

  it("never changes a bank line the user excluded", () => {
    const db = newDb();
    ingest(db, [bank([line("2026-03-10", -20000, BILL_4321)])], { now: NOW });
    const id = idOf(db, BILL_4321);
    updateTransactions(db, [id], { excluded: true });
    const before = stored(db, id);
    ingest(db, [card("4321", cycle())], { now: NOW });
    recomputeCardBills(db);
    expect(stored(db, id)).toEqual(before);
    expect(row(db, id)).toMatchObject({ flow: "excluded", flags: [] });
  });

  it("an excluded bank line keeps the card rows it already matched", () => {
    const db = mixedLedger();
    const id = idOf(db, BILL_4321);
    updateTransactions(db, [id], { excluded: true });
    ingest(db, [bank([line("2026-03-11", -20000, "כ.א.ל חיוב")])], { now: NOW });
    expect(stored(db, id)).toMatchObject({ internal: 1, card_bill_style: "credit" });
    expect(row(db, idOf(db, "כ.א.ל חיוב")).flags).toContain("possible_card_bill");
  });

  it("never changes a line the user re-flowed by hand, and can hand it back", () => {
    const db = mixedLedger();
    const id = idOf(db, BILL_4321);
    setInternalByUser(db, [id], false);
    expect(row(db, id)).toMatchObject({ flow: "spending", flags: ["uncategorized"] });
    ingest(db, [card("4321", cycle())], { now: NOW });
    recomputeCardBills(db);
    expect(stored(db, id)).toMatchObject({ internal: 0, internal_by_user: 1, possible_card_bill: 0 });

    const untracked = idOf(db, "חיוב לכרטיס ויזה 5555");
    setInternalByUser(db, [untracked], true);
    recomputeCardBills(db);
    expect(row(db, untracked)).toMatchObject({ flow: "internal", flags: [] });

    setInternalByUser(db, [id, untracked], null);
    expect(row(db, id).flow).toBe("internal");
    expect(row(db, untracked)).toMatchObject({ flow: "spending", flags: expect.arrayContaining(["possible_card_bill"]) });
  });

  it("a line the user took out frees its card rows for another line", () => {
    const db = mixedLedger();
    ingest(db, [bank([line("2026-03-11", -20000, "כ.א.ל חיוב")])], { now: NOW });
    expect(row(db, idOf(db, "כ.א.ל חיוב")).flow).toBe("spending");
    setInternalByUser(db, [idOf(db, BILL_4321)], false);
    expect(row(db, idOf(db, "כ.א.ל חיוב")).flow).toBe("internal");
  });

  it("a flagged bill the user categorized by hand leaves the review list but still counts", () => {
    const db = mixedLedger();
    const id = idOf(db, "חיוב לכרטיס ויזה 5555");
    updateTransactions(db, [id], { categoryId: categoryId(db, "Bills & Utilities") });
    expect(row(db, id)).toMatchObject({ flow: "spending", flags: [] });
  });

  it("switching the card mode rematches its bills", () => {
    const db = newDb();
    const coffee = charge("2026-03-03", -1800, "קפה השכונה", "2026-03-04");
    const bagel = charge("2026-03-03", -1200, "מאפייה", "2026-03-04");
    ingest(db, [card("8765", [coffee, bagel])], { now: NOW });
    ingest(db, [bank([line("2026-03-04", -3000, NUMBERLESS), line("2026-03-04", -1800, NUMBERLESS)])], { now: NOW });
    // credit first: the 3000 line takes the whole cycle, the 1800 line finds nothing left
    expect(idsOf(db, NUMBERLESS).map((id) => row(db, id).flow)).toEqual(["internal", "spending"]);
    setCardMode(db, accountId(db, "visaCal", "8765"), "debit");
    // debit first: the 1800 line takes the coffee, the 3000 line no longer fits
    expect(idsOf(db, NUMBERLESS).map((id) => row(db, id).flow)).toEqual(["spending", "internal"]);
  });

  it("rejects a card mode for a bank account or an unknown mode", () => {
    const db = mixedLedger();
    const bankId = (db.prepare("SELECT id FROM accounts WHERE kind = 'bank'").get() as { id: number }).id;
    expect(() => setCardMode(db, bankId, "debit")).toThrow("BAD_REQUEST");
    expect(() => setCardMode(db, accountId(db, "visaCal", "4321"), "weekly" as never)).toThrow("BAD_REQUEST");
  });
});

describe("trashed rows (spec 11)", () => {
  it("a trashed card row is not part of a cycle, and the bill goes back to flagged spending", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-10", -20000, NUMBERLESS)])], { now: NOW });
    const bill = idOf(db, NUMBERLESS);
    expect(row(db, bill).flow).toBe("internal");

    trashTransactions(db, [idOf(db, "קפה הפינה")], NOW);
    expect(row(db, bill)).toMatchObject({ flow: "spending", flags: ["uncategorized", "possible_card_bill"] });

    restoreTransactions(db, [idOf(db, "קפה הפינה")], NOW);
    expect(row(db, bill).flow).toBe("internal");
  });

  it("a trashed bank line pays nothing: its card rows are free for another line", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-10", -20000, BILL_4321)])], { now: NOW });
    const first = idOf(db, BILL_4321);
    trashTransactions(db, [first], NOW);
    ingest(db, [bank([line("2026-03-11", -20000, "כ.א.ל חיוב")])], { now: NOW });
    const second = idOf(db, "כ.א.ל חיוב");
    expect(row(db, second).flow).toBe("internal");
    expect(stored(db, first).trashed_at).toBe(NOW.toISOString());
    expect(listTransactions(db, { flows: ["trashed"] }).map((t) => t.id)).toEqual([first]);
  });

  it("matching never sets or clears trashed_at", () => {
    const db = newDb();
    ingest(db, [bank([line("2026-03-10", -20000, BILL_4321)])], { now: NOW });
    const bill = idOf(db, BILL_4321);
    trashTransactions(db, [bill], NOW);
    const before = stored(db, bill);
    ingest(db, [card("4321", cycle())], { now: NOW });
    recomputeCardBills(db);
    expect(stored(db, bill)).toEqual(before);
  });
});

// Spec 28: a line marked "This pays a card I track" and then undone is back
// to automatic: flagged again when no tracked card matches, so one click
// marks it again. A matched line stays internal.
describe("undoing 'This pays a card I track' (spec 28)", () => {
  const UNTRACKED = "מקס איט פיננסים";
  const AUTO = { internal: 0, internal_by_user: 0, possible_card_bill: 1 };

  function untrackedLine(): { db: Db; id: number } {
    const db = newDb();
    ingest(db, [bank([line("2026-03-01", -128460, UNTRACKED)])], { now: NOW });
    const id = idOf(db, UNTRACKED);
    expect(row(db, id).flags).toContain("possible_card_bill");
    return { db, id };
  }

  function markedLine(): { db: Db; id: number } {
    const { db, id } = untrackedLine();
    setInternalByUser(db, [id], true, NOW);
    expect(row(db, id)).toMatchObject({ flow: "internal", flags: [] });
    return { db, id };
  }

  function expectFlagged(db: Db, id: number): void {
    expect(stored(db, id)).toMatchObject(AUTO);
    expect(row(db, id).flow).toBe("spending");
    expect(row(db, id).flags).toContain("possible_card_bill");
  }

  it("the toast's Undo and 'Let CoinLeak decide' hand the line back to the matcher", () => {
    const { db, id } = markedLine();
    setInternalByUser(db, [id], null, NOW);
    expectFlagged(db, id);
  });

  it("Ignore, then Count again, hands a marked line back to the matcher", () => {
    const { db, id } = markedLine();
    updateTransactions(db, [id], { excluded: true }, NOW);
    expect(row(db, id).flow).toBe("excluded");
    updateTransactions(db, [id], { excluded: false }, NOW);
    expectFlagged(db, id);
  });

  it("Ignore on a flagged line, then its Undo, flags it again", () => {
    const { db, id } = untrackedLine();
    const { before } = updateTransactions(db, [id], { excluded: true }, NOW);
    restoreExclusions(db, before ?? [], NOW);
    expectFlagged(db, id);
  });

  it("Trash and Restore bring a flagged line back flagged, and a marked one back as it was", () => {
    const flaggedOne = untrackedLine();
    trashTransactions(flaggedOne.db, [flaggedOne.id], NOW);
    restoreTransactions(flaggedOne.db, [flaggedOne.id], NOW);
    expectFlagged(flaggedOne.db, flaggedOne.id);

    const { db, id } = markedLine();
    trashTransactions(db, [id], NOW);
    restoreTransactions(db, [id], NOW);
    expect(stored(db, id)).toMatchObject({ internal: 1, internal_by_user: 1 });
    setInternalByUser(db, [id], null, NOW);
    expectFlagged(db, id);
  });

  it("a matched line stays internal after each undo path", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-10", -20000, BILL_4321)])], { now: NOW });
    const id = idOf(db, BILL_4321);
    const matched = { internal: 1, internal_by_user: 0, possible_card_bill: 0, card_bill_style: "credit" };

    setInternalByUser(db, [id], false, NOW);
    setInternalByUser(db, [id], null, NOW);
    expect(stored(db, id)).toMatchObject(matched);

    setInternalByUser(db, [id], true, NOW);
    updateTransactions(db, [id], { excluded: true }, NOW);
    updateTransactions(db, [id], { excluded: false }, NOW);
    expect(stored(db, id)).toMatchObject(matched);
  });

  it("'Count it' stays the user's word, through Ignore and Count again too", () => {
    const { db, id } = untrackedLine();
    setInternalByUser(db, [id], false, NOW);
    updateTransactions(db, [id], { excluded: true }, NOW);
    updateTransactions(db, [id], { excluded: false }, NOW);
    expect(stored(db, id)).toMatchObject({ internal: 0, internal_by_user: 1, possible_card_bill: 0 });
    expect(row(db, id).flags).not.toContain("possible_card_bill");
  });
});

// Spec 32 (F75): a bank line naming one synced card's last 4 digits is that
// card's bill, sums or not. Exact matches still run first and win.
describe("bills naming a synced card (spec 32)", () => {
  it("a numbered line that does not equal the card's charges is internal for that card", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-12", -21500, BILL_4321)])], { now: NOW });
    const id = idOf(db, BILL_4321);
    expect(row(db, id)).toMatchObject({ flow: "internal", flags: [] });
    expect(stored(db, id)).toMatchObject({
      internal: 1,
      internal_by_user: 0,
      possible_card_bill: 0,
      card_bill_account_id: accountId(db, "visaCal", "4321"),
      card_bill_style: "credit",
      card_bill_date: "2026-03-10",
      card_bill_txn_id: null,
    });
    // The card rows still count as the spending, and stay free for an exact line.
    for (const id of idsOf(db, "סופר הדר")) expect(row(db, id).flow).toBe("spending");
    ingest(db, [bank([line("2026-03-11", -20000, "כ.א.ל חיוב")])], { now: NOW });
    expect(row(db, idOf(db, "כ.א.ל חיוב")).flow).toBe("internal");
  });

  it("a credit bill far from any billing day has no bill date", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-25", -5000, BILL_4321)])], { now: NOW });
    expect(stored(db, idOf(db, BILL_4321))).toMatchObject({ internal: 1, card_bill_style: "credit", card_bill_date: null });
  });

  it("a debit card's numbered line is internal in debit style, paying no single row", () => {
    const db = newDb();
    debitCard(db, "8765");
    ingest(db, [card("8765", [charge("2026-03-03", -4500, "מאפייה", "2026-03-04")])], { now: NOW });
    ingest(db, [bank([line("2026-03-20", -9999, BILL_8765)])], { now: NOW });
    expect(stored(db, idOf(db, BILL_8765))).toMatchObject({
      internal: 1,
      card_bill_style: "debit",
      card_bill_txn_id: null,
      card_bill_date: null,
    });
  });

  it("exact matches still win and still use up the card rows", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-10", -20000, BILL_4321), line("2026-03-11", -20000, "כ.א.ל חיוב")])], { now: NOW });
    expect(stored(db, idOf(db, BILL_4321))).toMatchObject({ internal: 1, card_bill_date: "2026-03-10" });
    // The cycle is taken, so the numberless line finds nothing and stays flagged.
    expect(row(db, idOf(db, "כ.א.ל חיוב"))).toMatchObject({ flow: "spending", flags: expect.arrayContaining(["possible_card_bill"]) });
  });

  it("two synced cards with the same last 4 decide nothing", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle()), card("55554321", [])], { now: NOW });
    ingest(db, [bank([line("2026-03-12", -21500, BILL_4321)])], { now: NOW });
    expect(row(db, idOf(db, BILL_4321))).toMatchObject({ flow: "spending", flags: expect.arrayContaining(["possible_card_bill"]) });
  });

  it("a line naming an unsynced card's number stays spending and flagged", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-12", -21500, "חיוב לכרטיס ויזה 5555")])], { now: NOW });
    expect(row(db, idOf(db, "חיוב לכרטיס ויזה 5555"))).toMatchObject({
      flow: "spending",
      flags: ["uncategorized", "possible_card_bill"],
    });
  });

  it("a longer number or a date never names a card", () => {
    const db = newDb();
    ingest(db, [card("1234", cycle()), card("2025", [])], { now: NOW });
    const lines = ["אסמכתא 98761234", "הוראת קבע 12/2025", "חיוב לכרטיס ויזה 98761234"];
    ingest(db, [bank(lines.map((d, i) => line(`2026-03-2${i}`, -7700, d)))], { now: NOW });
    expect(stored(db, idOf(db, lines[0] as string))).toMatchObject({ internal: 0, possible_card_bill: 0 });
    expect(stored(db, idOf(db, lines[1] as string))).toMatchObject({ internal: 0, possible_card_bill: 0 });
    expect(stored(db, idOf(db, lines[2] as string))).toMatchObject({ internal: 0, possible_card_bill: 1 });
  });

  it("a standalone 1234 in a line that is not a card pattern names card 1234", () => {
    const db = newDb();
    ingest(db, [card("1234", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-09", -18000, "הוראת קבע 1234")])], { now: NOW });
    expect(stored(db, idOf(db, "הוראת קבע 1234"))).toMatchObject({
      internal: 1,
      card_bill_account_id: accountId(db, "visaCal", "1234"),
      card_bill_date: "2026-03-10",
    });
  });

  it("a year-like number on a line with no card wording names no card", () => {
    const db = newDb();
    ingest(db, [card("2025", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-09", -18000, "ארנונה 2025"), line("2026-03-09", -5000, "ביטוח 1990")])], {
      now: NOW,
    });
    expect(stored(db, idOf(db, "ארנונה 2025"))).toMatchObject({ internal: 0, possible_card_bill: 0 });
    ingest(db, [card("1990", [])], { now: NOW });
    expect(stored(db, idOf(db, "ביטוח 1990"))).toMatchObject({ internal: 0, possible_card_bill: 0 });
  });

  it("a line with card wording keeps a year-like card number", () => {
    const db = newDb();
    ingest(db, [card("2025", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-12", -21500, "חיוב לכרטיס ויזה 2025"), line("2026-03-12", -900, "כאל 2099")])], {
      now: NOW,
    });
    expect(stored(db, idOf(db, "חיוב לכרטיס ויזה 2025"))).toMatchObject({
      internal: 1,
      card_bill_account_id: accountId(db, "visaCal", "2025"),
    });
    ingest(db, [card("2099", [])], { now: NOW });
    expect(stored(db, idOf(db, "כאל 2099"))).toMatchObject({
      internal: 1,
      card_bill_account_id: accountId(db, "visaCal", "2099"),
    });
  });

  it("money in and cash withdrawals are never taken", () => {
    const db = newDb();
    ingest(db, [card("1234", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-09", 18000, "זיכוי 1234"), line("2026-03-09", -20000, "משיכת מזומן 1234")])], {
      now: NOW,
    });
    expect(row(db, idOf(db, "זיכוי 1234")).flow).toBe("income");
    expect(row(db, idOf(db, "משיכת מזומן 1234")).flow).toBe("spending");
  });

  it("the user's word survives every recompute and sync", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-12", -21500, BILL_4321), line("2026-03-13", -900, BILL_8765)])], { now: NOW });
    const notABill = idOf(db, BILL_4321);
    setInternalByUser(db, [notABill], false, NOW);
    const excluded = idOf(db, BILL_8765);
    updateTransactions(db, [excluded], { excluded: true }, NOW);
    ingest(db, [card("8765", [])], { now: NOW });
    ingest(db, [card("4321", cycle())], { now: NOW });
    recomputeCardBills(db);
    expect(stored(db, notABill)).toMatchObject({ internal: 0, internal_by_user: 1, possible_card_bill: 0 });
    expect(row(db, notABill).flow).toBe("spending");
    expect(stored(db, excluded)).toMatchObject({ internal: 0, excluded: 1 });
  });

  it("every line it takes shows in the Card bills filter", () => {
    const db = newDb();
    ingest(db, [card("4321", cycle())], { now: NOW });
    ingest(db, [bank([line("2026-03-12", -21500, BILL_4321)])], { now: NOW });
    expect(listTransactions(db, { flows: ["internal"] }).map((t) => t.id)).toContain(idOf(db, BILL_4321));
  });
});
