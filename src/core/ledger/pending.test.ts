import { describe, expect, it } from "vitest";
import type { ScrapedTransaction } from "@shared/types";
import type { Db } from "../db";
import {
  NOW,
  accountId,
  bank,
  card,
  categoryId,
  countRows,
  idOf,
  idsOf,
  newDb,
  snapshot,
  stored,
  txn,
} from "../testing/ledger";
import { setCardMode, setInternalByUser } from "./card-bills";
import { dedupHash } from "./dedup";
import { ingest } from "./ingest";
import { DRIFT_DAYS, DRIFT_FLOOR, deleteGoneRows, planPending, type DriftFacts, type OpenRow } from "./pending";
import { updateTransactions } from "./edits";
import { listTransactions, monthSummary, trend } from "./queries";
import { restoreTransactions, trashTransactions } from "./trash";

const LATER = new Date("2026-04-02T08:00:00Z");
const LATEST = new Date("2026-04-05T08:00:00Z");

const pending = (date: string, amount: number, description: string, extra: Partial<ScrapedTransaction> = {}) =>
  txn({ date, amount, description, status: "pending", ...extra });
const completed = (date: string, amount: number, description: string, extra: Partial<ScrapedTransaction> = {}) =>
  txn({ date, amount, description, processedDate: "2026-04-10", ...extra });

function row(db: Db, id: number) {
  const found = listTransactions(db).find((t) => t.id === id);
  if (!found) throw new Error(`row ${id} not listed`);
  return found;
}

describe("settle with drift", () => {
  it("a foreign-currency pending row that settles 1.5% higher is updated in place and counted once", () => {
    const db = newDb();
    const hotel = pending("2026-03-20", -40000, "HOTEL LISBOA", { originalAmount: -10000, originalCurrency: "EUR" });
    ingest(db, [card("4321", [hotel])], { now: NOW });
    const id = idOf(db, "HOTEL LISBOA");
    const travel = categoryId(db, "Travel");
    updateTransactions(db, [id], { categoryId: travel, note: "spring trip" });

    const settled = completed("2026-03-20", -40600, "HOTEL LISBOA", {
      originalAmount: -10050,
      originalCurrency: "EUR",
      identifier: "77001",
    });
    const result = ingest(db, [card("4321", [settled])], { now: LATER });

    expect(result).toMatchObject({ newRows: 0, updatedRows: 1 });
    expect(idsOf(db, "HOTEL LISBOA")).toEqual([id]);
    expect(stored(db, id)).toMatchObject({
      amount: -40600,
      date: "2026-03-20",
      processed_date: "2026-04-10",
      original_amount: -10050,
      original_currency: "EUR",
      status: "completed",
      identifier: "77001",
      dedup_hash: dedupHash("visaCal", "4321", settled),
      dedup_seq: 0,
      category_id: travel,
      category_source: "user",
      note: "spring trip",
      gone_at: null,
      updated_at: LATER.toISOString(),
    });
    const march = monthSummary(db, "2026-03");
    expect(march.spending).toBe(40600);
    expect(march.byCategory).toEqual([{ categoryId: travel, amount: 40600, count: 1 }]);

    // The next sync finds the completed row already stored under its own key.
    expect(ingest(db, [card("4321", [settled])], { now: LATEST })).toMatchObject({ newRows: 0, updatedRows: 0 });
    expect(countRows(db)).toBe(1);
  });

  it("a pending row whose date moves by 2 days settles with drift", () => {
    const db = newDb();
    ingest(db, [card("4321", [pending("2026-03-20", -5600, "מסעדה בעיר")])], { now: NOW });
    const id = idOf(db, "מסעדה בעיר");
    const result = ingest(db, [card("4321", [completed("2026-03-22", -5600, "מסעדה בעיר")])], { now: LATER });
    expect(result).toMatchObject({ newRows: 0, updatedRows: 1 });
    expect(row(db, id)).toMatchObject({ date: "2026-03-22", status: "completed", amount: -5600, flow: "spending" });
    expect(countRows(db)).toBe(1);
  });

  it("matches the description up to whitespace and keeps the stored text and memo", () => {
    const db = newDb();
    ingest(db, [card("4321", [pending("2026-03-20", -5600, "מסעדה  בעיר", { memo: "first memo" })])], { now: NOW });
    const id = idOf(db, "מסעדה  בעיר");
    ingest(db, [card("4321", [completed("2026-03-21", -5650, " מסעדה בעיר ", { memo: "other memo" })])], { now: LATER });
    expect(countRows(db)).toBe(1);
    expect(stored(db, id)).toMatchObject({ description: "מסעדה  בעיר", memo: "first memo", amount: -5650 });
  });

  it("two pending coffees that settle as two completed coffees pair one to one", () => {
    const db = newDb();
    const coffee = pending("2026-03-02", -1800, "קפה השכונה");
    ingest(db, [card("4321", [coffee, coffee])], { now: NOW });
    const [first, second] = idsOf(db, "קפה השכונה") as [number, number];
    updateTransactions(db, [first], { note: "first" });
    updateTransactions(db, [second], { note: "second" });

    const settled = completed("2026-03-02", -1850, "קפה השכונה");
    const result = ingest(db, [card("4321", [settled, settled])], { now: LATER });

    expect(result).toMatchObject({ newRows: 0, updatedRows: 2 });
    expect(idsOf(db, "קפה השכונה")).toEqual([first, second]);
    const pick = (id: number) => {
      const r = stored(db, id);
      return [r.status, r.amount, r.dedup_seq, r.note];
    };
    expect([pick(first), pick(second)]).toEqual([
      ["completed", -1850, 0, "first"],
      ["completed", -1850, 1, "second"],
    ]);
    expect(monthSummary(db, "2026-03").spending).toBe(3700);
  });

  it("pairs each pending row with its closest completed row", () => {
    const db = newDb();
    const coffee = (amount: number) => pending("2026-03-02", amount, "קפה השכונה");
    const settled = (amount: number) => completed("2026-03-02", amount, "קפה השכונה");
    ingest(db, [card("4321", [coffee(-2000), coffee(-2400)])], { now: NOW });
    const [small, big] = idsOf(db, "קפה השכונה") as [number, number];
    ingest(db, [card("4321", [settled(-2410), settled(-2010)])], { now: LATER });
    expect(countRows(db)).toBe(2);
    expect([stored(db, small).amount, stored(db, big).amount]).toEqual([-2010, -2410]);
  });

  it("one coffee settles while its twin is still pending, and the twin settles later", () => {
    const db = newDb();
    const coffee = pending("2026-03-02", -1800, "קפה השכונה");
    ingest(db, [card("4321", [coffee, coffee])], { now: NOW });
    const [first, second] = idsOf(db, "קפה השכונה") as [number, number];
    const settled = completed("2026-03-02", -1850, "קפה השכונה");

    expect(ingest(db, [card("4321", [coffee, settled])], { now: LATER })).toMatchObject({ newRows: 0, updatedRows: 1 });
    expect([stored(db, first).status, stored(db, second).status]).toEqual(["pending", "completed"]);

    expect(ingest(db, [card("4321", [settled, settled])], { now: LATEST })).toMatchObject({ newRows: 0, updatedRows: 1 });
    expect(idsOf(db, "קפה השכונה")).toEqual([first, second]);
    expect(new Set([stored(db, first).dedup_seq, stored(db, second).dedup_seq])).toEqual(new Set([0, 1]));
    expect(monthSummary(db, "2026-03").spending).toBe(3700);
  });

  it("a completed row that exactly matches a stored row is not used again", () => {
    const db = newDb();
    const shop = completed("2026-03-02", -1800, "קפה השכונה");
    ingest(db, [card("4321", [shop, pending("2026-03-03", -1850, "קפה השכונה")])], { now: NOW });
    const [done, open] = idsOf(db, "קפה השכונה") as [number, number];
    const before = stored(db, done);

    ingest(db, [card("4321", [shop])], { now: LATER, since: "2026-03-01" });

    expect(stored(db, done)).toEqual(before);
    expect(row(db, open)).toMatchObject({ status: "gone", amount: -1850 });
    expect(monthSummary(db, "2026-03").spending).toBe(1800);
  });

  it("a gone row still settles with drift when its completed version shows up", () => {
    const db = newDb();
    ingest(db, [card("4321", [pending("2026-03-20", -10000, "חנות ספורט")])], { now: NOW });
    const id = idOf(db, "חנות ספורט");
    const sports = categoryId(db, "Sports & Hobbies");
    updateTransactions(db, [id], { categoryId: sports });
    ingest(db, [card("4321", [])], { now: LATER, since: "2026-03-01" });
    expect(row(db, id).status).toBe("gone");

    ingest(db, [card("4321", [completed("2026-03-21", -10150, "חנות ספורט")])], { now: LATEST });
    expect(row(db, id)).toMatchObject({ status: "completed", flow: "spending", amount: -10150, categoryId: sports });
    expect(stored(db, id).gone_at).toBeNull();
    expect(countRows(db)).toBe(1);
  });

  it("does not settle across accounts, past the tolerance, or a charge into money in", () => {
    const db = newDb();
    ingest(
      db,
      [
        card("4321", [
          pending("2026-03-20", -10000, "חנות א"),
          pending("2026-03-20", -10000, "חנות ב"),
          pending("2026-03-20", -300, "חנות ג"),
        ]),
      ],
      { now: NOW },
    );
    ingest(
      db,
      [
        card("4321", [completed("2026-03-20", -11100, "חנות ב"), completed("2026-03-20", 200, "חנות ג")]),
        card("8765", [completed("2026-03-20", -10000, "חנות א")]),
      ],
      { now: LATER, since: "2026-03-01" },
    );
    // Each pending row is gone and each completed row is new: every purchase counts once.
    expect(listTransactions(db, { flows: ["gone"] }).map((t) => t.description).sort()).toEqual([
      "חנות א",
      "חנות ב",
      "חנות ג",
    ]);
    expect(countRows(db)).toBe(6);
    const march = monthSummary(db, "2026-03");
    expect([march.spending, march.income]).toEqual([21100, 200]);
  });

  it("a pending row stored in the purchase currency (before spec 06) becomes gone and its completed row is new", () => {
    // Before spec 06 a Cal pending foreign purchase was saved in its own currency
    // (50 USD as -5000) and the completed row comes in shekels: too far apart.
    const db = newDb();
    ingest(db, [card("4321", [pending("2026-03-20", -5000, "AMAZON", { originalCurrency: "USD" })])], { now: NOW });
    ingest(db, [card("4321", [completed("2026-03-20", -18500, "AMAZON", { originalAmount: -5000 })])], { now: LATER });
    expect(listTransactions(db).map((t) => [t.status, t.amount])).toEqual([
      ["completed", -18500],
      ["gone", -5000],
    ]);
    expect(monthSummary(db, "2026-03").spending).toBe(18500);
  });
});

describe("pending foreign purchases (amount 0 until they settle)", () => {
  const usd = (originalAmount: number) => ({ originalAmount, originalCurrency: "USD" });

  it("a pending $50 settles with drift onto the completed row, keeps its category and counts once", () => {
    const db = newDb();
    ingest(db, [card("4321", [pending("2026-03-20", 0, "SYNTH BOOKS", usd(-5000))])], { now: NOW });
    const id = idOf(db, "SYNTH BOOKS");
    const hobbies = categoryId(db, "Sports & Hobbies");
    updateTransactions(db, [id], { categoryId: hobbies, note: "gift" });
    expect(row(db, id)).toMatchObject({ status: "pending", amount: 0, originalAmount: -5000, originalCurrency: "USD" });
    expect(monthSummary(db, "2026-03").spending).toBe(0);

    const settled = completed("2026-03-21", -18650, "SYNTH BOOKS", { ...usd(-5040), identifier: "88001" });
    expect(ingest(db, [card("4321", [settled])], { now: LATER })).toMatchObject({ newRows: 0, updatedRows: 1 });

    expect(idsOf(db, "SYNTH BOOKS")).toEqual([id]);
    expect(stored(db, id)).toMatchObject({
      amount: -18650,
      date: "2026-03-21",
      original_amount: -5040,
      original_currency: "USD",
      status: "completed",
      identifier: "88001",
      dedup_hash: dedupHash("visaCal", "4321", settled),
      category_id: hobbies,
      category_source: "user",
      note: "gift",
      gone_at: null,
    });
    const march = monthSummary(db, "2026-03");
    expect(march.spending).toBe(18650);
    expect(march.byCategory).toEqual([{ categoryId: hobbies, amount: 18650, count: 1 }]);
    expect(ingest(db, [card("4321", [settled])], { now: LATEST })).toMatchObject({ newRows: 0, updatedRows: 0 });
    expect(countRows(db)).toBe(1);
  });

  it("a pending EUR row never pairs with a USD row", () => {
    const db = newDb();
    const eur = { originalAmount: -5000, originalCurrency: "EUR" };
    ingest(db, [card("4321", [pending("2026-03-20", 0, "SYNTH HOTEL", eur)])], { now: NOW });
    ingest(db, [card("4321", [completed("2026-03-20", -18500, "SYNTH HOTEL", usd(-5000))])], { now: LATER });
    expect(listTransactions(db).map((t) => [t.status, t.amount, t.originalCurrency])).toEqual([
      ["completed", -18500, "USD"],
      ["gone", 0, "EUR"],
    ]);
    expect(monthSummary(db, "2026-03").spending).toBe(18500);
  });

  it("two pending foreign purchases at one shop pair by their original amounts", () => {
    const db = newDb();
    const shop = (originalAmount: number) => pending("2026-03-20", 0, "SYNTH SHOP", usd(originalAmount));
    ingest(db, [card("4321", [shop(-1000), shop(-4000)])], { now: NOW });
    const [ten, forty] = idsOf(db, "SYNTH SHOP") as [number, number];
    ingest(
      db,
      [
        card("4321", [
          completed("2026-03-21", -14900, "SYNTH SHOP", usd(-4000)),
          completed("2026-03-21", -3720, "SYNTH SHOP", usd(-1000)),
        ]),
      ],
      { now: LATER },
    );
    expect([stored(db, ten).amount, stored(db, forty).amount]).toEqual([-3720, -14900]);
    expect(countRows(db)).toBe(2);
    expect(monthSummary(db, "2026-03").spending).toBe(18620);
  });
});

describe("gone rows", () => {
  // Card 4321: a completed purchase on 03-01, pending ones on 03-05 and 03-25.
  function synced(): Db {
    const db = newDb();
    ingest(
      db,
      [
        card("4321", [
          completed("2026-03-01", -10000, "חנות בגדים"),
          pending("2026-03-05", -2500, "מאפייה"),
          pending("2026-03-25", -12000, "מסעדה"),
        ]),
      ],
      { now: NOW },
    );
    return db;
  }

  it("a vanished pending row inside the window becomes gone, counts nowhere and needs review", () => {
    const db = synced();
    const id = idOf(db, "מסעדה");
    const restaurants = categoryId(db, "Restaurants");
    updateTransactions(db, [id], { categoryId: restaurants, note: "team dinner" });
    expect(monthSummary(db, "2026-03")).toMatchObject({ spending: 24500, needsReview: 2 });

    const result = ingest(db, [card("4321", [completed("2026-03-15", -3000, "סופר")])], {
      now: LATER,
      since: "2026-03-10",
    });

    expect(result).toMatchObject({ newRows: 1, updatedRows: 1 });
    expect(row(db, id)).toMatchObject({
      status: "gone",
      flow: "gone",
      flags: ["gone"],
      categoryId: restaurants,
      categorySource: "user",
      note: "team dinner",
    });
    expect(stored(db, id)).toMatchObject({ status: "pending", gone_at: LATER.toISOString() });
    expect(listTransactions(db, { needsReview: true }).map((t) => t.id)).toContain(id);
    expect(listTransactions(db, { flows: ["gone"] }).map((t) => t.id)).toEqual([id]);
    expect(monthSummary(db, "2026-03")).toMatchObject({ spending: 15500, needsReview: 4 });
  });

  it("a pending row older than the window is left alone", () => {
    const db = synced();
    const before = stored(db, idOf(db, "מאפייה"));
    ingest(db, [card("4321", [completed("2026-03-15", -3000, "סופר")])], { now: LATER, since: "2026-03-10" });
    expect(stored(db, idOf(db, "מאפייה"))).toEqual(before);
    expect(row(db, idOf(db, "מאפייה"))).toMatchObject({ status: "pending", flow: "spending" });
  });

  it("without a start date the window is the account's earliest downloaded day", () => {
    const db = synced();
    ingest(db, [card("4321", [completed("2026-03-15", -3000, "סופר")])], { now: LATER });
    expect([row(db, idOf(db, "מאפייה")).status, row(db, idOf(db, "מסעדה")).status]).toEqual(["pending", "gone"]);

    ingest(db, [card("4321", [completed("2026-03-01", -10000, "חנות בגדים")])], { now: LATEST });
    expect(row(db, idOf(db, "מאפייה")).status).toBe("gone");
  });

  it("leaves accounts alone that the download does not judge", () => {
    const db = newDb();
    const restaurant = pending("2026-03-25", -12000, "מסעדה");
    ingest(db, [card("4321", [restaurant]), card("8765", [pending("2026-03-25", -900, "חניה")])], { now: NOW });
    const before = snapshot(db);
    // An account with no rows and no start date has no window.
    expect(ingest(db, [card("4321", [])], { now: LATER })).toMatchObject({ updatedRows: 0 });
    expect(snapshot(db)).toEqual(before);
    // A card missing from the download is not judged at all.
    ingest(db, [card("4321", [])], { now: LATER, since: "2026-03-01" });
    expect([row(db, idOf(db, "מסעדה")).status, row(db, idOf(db, "חניה")).status]).toEqual(["gone", "pending"]);
  });

  it("a gone row that reappears in a later download comes back", () => {
    const db = synced();
    const id = idOf(db, "מסעדה");
    updateTransactions(db, [id], { note: "team dinner" });
    const goneBy = (now: Date) => ingest(db, [card("4321", [])], { now, since: "2026-03-10" });
    goneBy(LATER);
    expect(row(db, id).status).toBe("gone");

    const back = ingest(db, [card("4321", [pending("2026-03-25", -12000, "מסעדה")])], { now: LATEST });
    expect(back).toMatchObject({ newRows: 0, updatedRows: 1 });
    expect(row(db, id)).toMatchObject({ status: "pending", flow: "spending", flags: ["uncategorized"], note: "team dinner" });
    expect(stored(db, id).gone_at).toBeNull();

    goneBy(LATER);
    ingest(db, [card("4321", [completed("2026-03-25", -12000, "מסעדה", { identifier: "5501" })])], { now: LATEST });
    expect(row(db, id)).toMatchObject({ status: "completed", flow: "spending", processedDate: "2026-04-10" });
    expect(stored(db, id)).toMatchObject({ identifier: "5501", gone_at: null });
    expect(countRows(db)).toBe(3);
  });

  it("the same download twice marks a row gone once", () => {
    const db = synced();
    const download = [card("4321", [completed("2026-03-15", -3000, "סופר")])];
    ingest(db, download, { now: LATER, since: "2026-03-10" });
    const before = snapshot(db);
    expect(ingest(db, download, { now: LATEST, since: "2026-03-10" })).toMatchObject({ newRows: 0, updatedRows: 0 });
    expect(snapshot(db)).toEqual(before);
  });

  it("keeps every user field through gone and back", () => {
    const db = newDb();
    ingest(db, [bank([pending("2026-03-25", -20000, "העברה לחבר")])], { now: NOW });
    const id = idOf(db, "העברה לחבר");
    updateTransactions(db, [id], { categoryId: categoryId(db, "Transfers"), note: "rent share", excluded: true });
    setInternalByUser(db, [id], false);
    const userFields = () => {
      const r = stored(db, id);
      return [r.category_id, r.category_source, r.note, r.excluded, r.internal_by_user];
    };
    const before = userFields();

    ingest(db, [bank([])], { now: LATER, since: "2026-03-01" });
    expect(row(db, id).flow).toBe("gone");
    expect(userFields()).toEqual(before);
    ingest(db, [bank([pending("2026-03-25", -20000, "העברה לחבר")])], { now: LATEST });
    expect(row(db, id).flow).toBe("excluded");
    expect(userFields()).toEqual(before);
  });

  it("Discount's temporary card aggregate becomes gone when the bank drops it", () => {
    const db = newDb();
    const AGGREGATE = "חיוב זמני למפתח מזומן";
    ingest(db, [bank([completed("2026-03-01", 1500000, "משכורת"), pending("2026-03-21", -3000, AGGREGATE)])], { now: NOW });
    expect(monthSummary(db, "2026-03").spending).toBe(3000);

    ingest(db, [bank([completed("2026-03-01", 1500000, "משכורת"), completed("2026-03-23", -3000, "מכולת בשכונה")])], {
      now: LATER,
    });
    expect(row(db, idOf(db, AGGREGATE))).toMatchObject({ status: "gone", flow: "gone" });
    expect(monthSummary(db, "2026-03")).toMatchObject({ income: 1500000, spending: 3000 });
  });

  it("a gone card row stops counting toward a card bill", () => {
    const db = newDb();
    ingest(db, [card("8765", [])], { now: NOW });
    setCardMode(db, accountId(db, "visaCal", "8765"), "debit");
    ingest(db, [card("8765", [pending("2026-03-20", -3000, "מכולת")])], { now: NOW });
    ingest(db, [bank([completed("2026-03-21", -3000, "חיוב לכרטיס ויזה")])], { now: NOW });
    const line = idOf(db, "חיוב לכרטיס ויזה");
    expect(row(db, line).flow).toBe("internal");

    ingest(db, [card("8765", [])], { now: LATER, since: "2026-03-01" });
    expect(row(db, line)).toMatchObject({ flow: "spending", flags: ["uncategorized", "possible_card_bill"] });
  });

  it("only a pending row can be gone", () => {
    const db = synced();
    expect(() => db.prepare("UPDATE transactions SET gone_at = 'x' WHERE id = ?").run(idOf(db, "חנות בגדים"))).toThrow();
  });

  it("rejects a start date that is not a day and saves nothing", () => {
    const db = newDb();
    expect(() => ingest(db, [card("4321", [])], { now: NOW, since: "2026-02-30" })).toThrow("BAD_REQUEST");
    expect(() => ingest(db, [card("4321", [])], { now: NOW, since: 5 as never })).toThrow("BAD_REQUEST");
    expect(db.prepare("SELECT COUNT(*) AS n FROM sync_runs").get()).toEqual({ n: 0 });
  });
});

describe("completed rows", () => {
  it("a completed row whose amount looks close to a new row is never touched", () => {
    const db = newDb();
    ingest(db, [card("4321", [completed("2026-03-05", -10000, "חנות ספרים")])], { now: NOW });
    const before = snapshot(db);

    const result = ingest(db, [card("4321", [completed("2026-03-06", -10100, "חנות ספרים")])], {
      now: LATER,
      since: "2026-03-01",
    });
    expect(result).toMatchObject({ newRows: 1, updatedRows: 0 });
    expect(snapshot(db)[0]).toEqual(before[0]);

    ingest(db, [card("4321", [pending("2026-03-06", -10050, "חנות ספרים")])], { now: LATEST, since: "2026-03-01" });
    expect(snapshot(db)[0]).toEqual(before[0]);
    expect(listTransactions(db, { flows: ["gone"] })).toEqual([]);
  });
});

describe("totals leave gone rows out", () => {
  it("monthSummary, trend and byParent exclude gone rows", () => {
    const db = newDb();
    ingest(
      db,
      [card("4321", [completed("2026-03-05", -8000, "סופר שכונתי"), pending("2026-03-25", -12000, "מסעדה")])],
      { now: NOW },
    );
    const [groceries, restaurants, food] = ["Groceries", "Restaurants", "Food"].map((n) => categoryId(db, n));
    updateTransactions(db, [idOf(db, "סופר שכונתי")], { categoryId: groceries });
    updateTransactions(db, [idOf(db, "מסעדה")], { categoryId: restaurants });
    expect(monthSummary(db, "2026-03").byParent).toEqual([{ categoryId: food, amount: 20000, count: 2 }]);

    ingest(db, [card("4321", [completed("2026-03-05", -8000, "סופר שכונתי")])], { now: LATER, since: "2026-03-01" });

    const march = monthSummary(db, "2026-03");
    expect(march).toMatchObject({ income: 0, spending: 8000, needsReview: 1 });
    expect(march.byCategory).toEqual([{ categoryId: groceries, amount: 8000, count: 1 }]);
    expect(march.byParent).toEqual([{ categoryId: food, amount: 8000, count: 1 }]);
    expect(march.byDay.at(-1)).toEqual({ date: "2026-03-31", amount: 8000 });
    expect(trend(db, 1, { now: NOW })).toEqual([
      { month: "2026-03", income: 0, spending: 8000, byCategory: [{ categoryId: groceries, amount: 8000 }], byParent: [{ categoryId: food, amount: 8000 }] },
    ]);
  });
});

describe("deleteGoneRows", () => {
  function withGoneRow(): { db: Db; gone: number; open: number; done: number } {
    const db = newDb();
    ingest(
      db,
      [
        card("4321", [
          completed("2026-03-01", -10000, "חנות בגדים"),
          pending("2026-03-05", -2500, "מאפייה"),
          pending("2026-03-25", -12000, "מסעדה"),
        ]),
      ],
      { now: NOW },
    );
    ingest(db, [card("4321", [])], { now: LATER, since: "2026-03-10" });
    return { db, gone: idOf(db, "מסעדה"), open: idOf(db, "מאפייה"), done: idOf(db, "חנות בגדים") };
  }

  it("deletes only gone rows", () => {
    const { db, gone, open, done } = withGoneRow();
    const others = snapshot(db).filter((r) => r.id !== gone);
    expect(deleteGoneRows(db, [gone, open, done, 9999, gone])).toBe(1);
    expect(snapshot(db)).toEqual(others);
    expect(deleteGoneRows(db, [gone, open, done])).toBe(0);
    expect(deleteGoneRows(db, [])).toBe(0);
    expect(snapshot(db)).toEqual(others);
  });

  it("rejects bad ids and deletes nothing", () => {
    const { db, gone } = withGoneRow();
    const before = snapshot(db);
    expect(() => deleteGoneRows(db, [gone, 0])).toThrow("BAD_REQUEST");
    expect(() => deleteGoneRows(db, [1.5])).toThrow("BAD_REQUEST");
    expect(() => deleteGoneRows(db, ["1" as never])).toThrow("BAD_REQUEST");
    expect(() => deleteGoneRows(db, "1" as never)).toThrow("BAD_REQUEST");
    expect(snapshot(db)).toEqual(before);
  });

  it("deletes a gone card row that a hand-decided bank line still points at", () => {
    const db = newDb();
    ingest(db, [card("8765", [])], { now: NOW });
    setCardMode(db, accountId(db, "visaCal", "8765"), "debit");
    ingest(db, [card("8765", [pending("2026-03-20", -3000, "מכולת")])], { now: NOW });
    ingest(db, [bank([completed("2026-03-21", -3000, "חיוב לכרטיס ויזה")])], { now: NOW });
    const purchase = idOf(db, "מכולת");
    const line = idOf(db, "חיוב לכרטיס ויזה");
    setInternalByUser(db, [line], true);
    expect(stored(db, line).card_bill_txn_id).toBe(purchase);

    ingest(db, [card("8765", [])], { now: LATER, since: "2026-03-01" });
    expect(deleteGoneRows(db, [purchase])).toBe(1);
    expect(idsOf(db, "מכולת")).toEqual([]);
    expect(stored(db, line)).toMatchObject({ internal: 1, internal_by_user: 1, card_bill_txn_id: null });
  });
});

describe("planPending", () => {
  const open = (id: number, amount: number, extra: Partial<OpenRow> = {}): OpenRow => ({
    id,
    date: "2026-03-10",
    amount,
    originalAmount: null,
    originalCurrency: null,
    description: "חנות",
    installment: null,
    gone: false,
    ...extra,
  });
  const done = (amount: number, extra: Partial<DriftFacts> = {}): DriftFacts => ({
    date: "2026-03-10",
    amount,
    originalAmount: null,
    originalCurrency: null,
    description: "חנות",
    installment: null,
    ...extra,
  });
  const settles = (o: OpenRow, c: DriftFacts) => planPending([o], [c], null).settle.has(o.id);

  it("accepts an amount change up to 10% or 5 ILS, whichever is larger", () => {
    expect(settles(open(1, -10000), done(-11000))).toBe(true);
    expect(settles(open(1, -10000), done(-8999))).toBe(false);
    expect(settles(open(1, -2000), done(-2000 - DRIFT_FLOOR))).toBe(true);
    expect(settles(open(1, -2000), done(-2001 - DRIFT_FLOOR))).toBe(false);
  });

  it("accepts a date change up to 7 days either way", () => {
    expect(DRIFT_DAYS).toBe(7);
    expect(settles(open(1, -1000), done(-1000, { date: "2026-03-17" }))).toBe(true);
    expect(settles(open(1, -1000), done(-1000, { date: "2026-03-03" }))).toBe(true);
    expect(settles(open(1, -1000), done(-1000, { date: "2026-03-18" }))).toBe(false);
  });

  it("needs the same description up to whitespace, the same installment and the same direction", () => {
    expect(settles(open(1, -1000), done(-1000, { description: " חנות  " }))).toBe(true);
    expect(settles(open(1, -1000), done(-1000, { description: "חנות אחרת" }))).toBe(false);
    const first = { number: 1, total: 3 };
    expect(settles(open(1, -1000, { installment: first }), done(-1000, { installment: first }))).toBe(true);
    expect(settles(open(1, -1000, { installment: first }), done(-1000))).toBe(false);
    expect(settles(open(1, -1000, { installment: first }), done(-1000, { installment: { number: 2, total: 3 } }))).toBe(
      false,
    );
    expect(settles(open(1, -100), done(100))).toBe(false);
    expect(settles(open(1, 100), done(150))).toBe(true);
  });

  it("compares a pending foreign row (amount 0) by its original amount, in the same currency only", () => {
    const usd = (originalAmount: number) => ({ originalAmount, originalCurrency: "USD" });
    const fifty = open(1, 0, usd(-5000));
    expect(settles(fifty, done(-18650, usd(-5040)))).toBe(true);
    expect(settles(fifty, done(-18650, usd(-5500)))).toBe(true);
    expect(settles(fifty, done(-18650, usd(-5501)))).toBe(false);
    expect(settles(open(1, 0, usd(-2000)), done(-7400, usd(-2000 - DRIFT_FLOOR)))).toBe(true);
    expect(settles(fifty, done(-18650, { originalAmount: -5040, originalCurrency: "EUR" }))).toBe(false);
    // A completed row with no original amount is in shekels only: never this row.
    expect(settles(fifty, done(-5000))).toBe(false);
    expect(settles(fifty, done(0))).toBe(false);
  });

  it("takes a pending foreign row's direction from its original amount", () => {
    const refund = open(1, 0, { originalAmount: 2000, originalCurrency: "USD" });
    expect(settles(refund, done(7400, { originalAmount: 2000, originalCurrency: "USD" }))).toBe(true);
    expect(settles(refund, done(-7400, { originalAmount: -2000, originalCurrency: "USD" }))).toBe(false);
  });

  it("compares a shekel row with an original amount (an installment) by its shekel amount", () => {
    const plan = { originalAmount: -30000, originalCurrency: "ILS", installment: { number: 1, total: 3 } };
    expect(settles(open(1, -10000, plan), done(-10100, { ...plan, originalAmount: -90000 }))).toBe(true);
  });

  it("pairs closest first: amount change, then days, then id", () => {
    const plan = planPending(
      [open(5, -1000), open(3, -1000), open(4, -1000, { date: "2026-03-12" })],
      [done(-1000, { date: "2026-03-12" }), done(-1010), done(-1000)],
      null,
    );
    // Zero change beats a ten agorot change; on a tie the closer date, then the lower id.
    expect(plan.settle).toEqual(
      new Map([
        [3, 2],
        [4, 0],
        [5, 1],
      ]),
    );
  });

  it("marks gone only unpaired rows inside the window that are not gone already", () => {
    const plan = planPending(
      [open(1, -1000), open(2, -500, { date: "2026-03-01" }), open(3, -700, { gone: true }), open(4, -900)],
      [done(-1000)],
      "2026-03-05",
    );
    expect(plan).toEqual({ settle: new Map([[1, 0]]), gone: [4] });
    expect(planPending([open(4, -900)], [], null).gone).toEqual([]);
  });
});

describe("trashed rows and sync (spec 11)", () => {
  it("a sync of the same download never adds a trashed row again", () => {
    const db = newDb();
    const rows = [completed("2026-03-05", -2500, "קיוסק"), pending("2026-03-20", -1800, "מכולת")];
    ingest(db, [card("4321", rows)], { now: NOW });
    const ids = [idOf(db, "קיוסק"), idOf(db, "מכולת")];
    trashTransactions(db, ids, NOW);
    const before = snapshot(db);

    expect(ingest(db, [card("4321", rows)], { now: LATER })).toMatchObject({ newRows: 0, updatedRows: 0 });
    expect(snapshot(db)).toEqual(before);
    expect(listTransactions(db)).toEqual([]);
    expect(listTransactions(db, { flows: ["trashed"] })).toHaveLength(2);
  });

  it("a trashed pending row stays trashed when it settles with drift or exactly", () => {
    const db = newDb();
    ingest(db, [card("4321", [pending("2026-03-20", -40000, "HOTEL LISBOA"), pending("2026-03-21", -900, "קפה")])], {
      now: NOW,
    });
    const hotel = idOf(db, "HOTEL LISBOA");
    const coffee = idOf(db, "קפה");
    trashTransactions(db, [hotel, coffee], NOW);

    ingest(db, [card("4321", [completed("2026-03-20", -40600, "HOTEL LISBOA"), txn({ date: "2026-03-21", amount: -900, description: "קפה" })])], {
      now: LATER,
    });
    expect(idsOf(db, "HOTEL LISBOA")).toEqual([hotel]);
    expect(stored(db, hotel)).toMatchObject({ status: "completed", amount: -40600, trashed_at: NOW.toISOString() });
    expect(stored(db, coffee)).toMatchObject({ status: "completed", trashed_at: NOW.toISOString() });
    expect(monthSummary(db, "2026-03").spending).toBe(0);

    restoreTransactions(db, [hotel], LATEST);
    expect(row(db, hotel)).toMatchObject({ flow: "spending", status: "completed", amount: -40600 });
  });

  it("a trashed pending row the bank drops stays trashed, not in review", () => {
    const db = newDb();
    ingest(db, [card("4321", [pending("2026-03-20", -1800, "מכולת"), completed("2026-03-19", -100, "x")])], { now: NOW });
    const id = idOf(db, "מכולת");
    trashTransactions(db, [id], NOW);
    ingest(db, [card("4321", [completed("2026-03-19", -100, "x")])], { now: LATER, since: "2026-03-01" });
    expect(listTransactions(db, { flows: ["trashed"] }).map((t) => [t.id, t.flags])).toEqual([[id, []]]);
    expect(monthSummary(db, "2026-03").needsReview).toBe(1);
  });
});
