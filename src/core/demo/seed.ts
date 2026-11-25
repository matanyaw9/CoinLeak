// Fills a database with about six months of made-up money for the Demo
// profile, through the real core: ingest() for the downloads, createRule()
// and createCategory() for the setup, then a few hand edits and a cash
// wallet (spec 20), and a pizza half paid back by a friend (spec 33). The
// bank syncs twice, so its two accounts have balances to check (spec 24):
// one adds up, one has a small gap. Same date in, same data out.

import type { Agorot, IsoDate, RuleCondition, RuleInput, ScrapedAccount, ScrapedTransaction } from "@shared/types";
import { openDatabase, type Db } from "../db";
import {
  addManualTransaction,
  budgetPlan,
  createCategory,
  ingest,
  listAccounts,
  listCategories,
  listTransactions,
  markPaidBack,
  setAccountsSyncing,
  setBudget,
  setBudgetTotal,
  trashTransactions,
  updateTransactions,
} from "../ledger";
import { addMonths, dayNumber, daysOfMonth, monthBounds, toIsoDate } from "../ledger/dates";
import { israelToday, spendingUnder } from "../ledger/period";
import { createRule } from "../rules";
import { ACCOUNTS, CARD_SPENDS, RULES, type DemoAccount, type DemoRule } from "./shops";

const MONTHS = 6;
/** spec 24: the bank's earlier sync, and a fee its second account's rows miss. */
const EARLIER_SYNC_DAYS = 4;
const MISSING_FEE: Agorot = -12_000;

interface Draft {
  account: DemoAccount;
  date: IsoDate;
  amount: Agorot;
  description: string;
  memo?: string;
  pending?: boolean;
  installment?: { number: number; total: number };
  original?: { amount: Agorot; currency: string };
}

/** Creates the file at `path` and fills it. The caller makes sure no old file is there. */
export function createDemoDatabase(path: string, today: Date): void {
  const db = openDatabase(path);
  try {
    seedDemo(db, today);
  } finally {
    db.close();
  }
}

export function seedDemo(db: Db, today: Date): void {
  const now = today;
  const todayIso = israelToday(today);
  // About six months of history up to today, card bills included.
  const drafts = makeDrafts(todayIso);

  createCategory(db, { name: "Rent", kind: "expense", parentId: categoryId(db, "Home & Bills"), emoji: "🔑", color: "#9CBF7C" });

  // A pending bank line the next download no longer has turns "gone".
  const firstDay = `${todayIso.slice(0, 7)}-01`;
  const gone: Draft = { account: "bank", date: firstDay, amount: -35000, description: "חיוב זמני למפתח מזומן", pending: true };
  // spec 24: the bank synced four days ago too, so each bank account has two
  // balances to compare. The first one's adds up; the second one's bank
  // charged a ₪120 fee CoinLeak never got, a small gap.
  const earlier = new Date(today.getTime() - EARLIER_SYNC_DAYS * 86_400_000);
  const upToEarlier = drafts.filter((d) => d.date <= israelToday(earlier));
  ingest(
    db,
    [
      scraped("bank", [...upToEarlier, gone], balanceBefore("bank", drafts, upToEarlier, 0)),
      scraped("joint", upToEarlier, balanceBefore("joint", drafts, upToEarlier, MISSING_FEE)),
    ],
    { now: earlier },
  );
  ingest(db, [scraped("bank", drafts), scraped("joint", drafts)], { now });
  ingest(db, [scraped("everyday", drafts), scraped("online", drafts)], { now });
  ingest(db, [scraped("old", drafts)], { now });

  for (const rule of RULES) createRule(db, ruleInput(db, rule), now);

  // Sorted by hand: Bit transfers to friends, and one big dentist bill.
  const byText = (text: string) => listTransactions(db, { search: text }).map((r) => r.id);
  const bits = byText("העברה ב-BIT").filter((id, i) => i > 0);
  if (bits.length > 0) updateTransactions(db, bits, { categoryId: categoryId(db, "Gifts & Donations") }, now);
  updateTransactions(db, byText("מרפאת שיניים"), { categoryId: categoryId(db, "Health") }, now);
  // spec 34: rows on level 3 categories. Big supermarket trips are the weekly
  // shop, AM:PM is a top-up, Rav-Kav loads are the bus; the rest stay on Groceries.
  const weekly = [...listTransactions(db, { search: "שופרסל" }), ...listTransactions(db, { search: "רמי לוי" })]
    .filter((r) => r.amount <= -30_000)
    .map((r) => r.id);
  for (const [ids, name] of [
    [weekly, "Weekly shop"],
    [byText("AM:PM"), "Top-up"],
    [byText("רב-קו"), "Bus"],
  ] as const) {
    if (ids.length > 0) updateTransactions(db, [...ids], { categoryId: categoryId(db, name) }, now);
  }
  // Two small lines the user already put in Trash.
  trashTransactions(db, [...byText("עמלת פעולה בערוץ ישיר"), ...byText("החזר עמלה")], now);
  const old = listAccounts(db).filter((a) => a.accountNumber === ACCOUNTS.old.accountNumber);
  setAccountsSyncing(db, old.map((a) => a.id), false);

  // spec 20: a cash wallet, spent from after this week's ATM withdrawal.
  for (const c of CASH) {
    const date = toIsoDate(dayNumber(todayIso) - c.daysAgo);
    const category = c.category ? categoryId(db, c.category) : null;
    addManualTransaction(db, { date, amount: c.amount, description: c.description, categoryId: category, note: c.note ?? null }, now);
  }

  // spec 33: the friend's Bit payment is marked as paid back for that pizza.
  const pizza = listTransactions(db, { search: PIZZA_MEMO })[0];
  const payBack = listTransactions(db, { search: "העברה מ-BIT" })[0];
  if (pizza && payBack) markPaidBack(db, { rowId: payBack.id, purchaseId: pizza.id }, now);

  addBudgets(db, todayIso);
}

/**
 * spec 27: budgets on this month's three biggest spending subcategories (not bills), set
 * from what they spent so far: the first over budget, the second near it,
 * the third well under. Round ₪10 amounts, like a person would type.
 * spec 37: then nested budgets and a total, as the Budgets page would have
 * them: two level 3 budgets inside the first, each subcategory's group and
 * Home & Bills at their usual month (at least what sits inside), and a
 * total that leaves about a sixth still to split.
 */
function addBudgets(db: Db, today: IsoDate): void {
  const { from, until } = monthBounds(today.slice(0, 7));
  // Rent and bills are fixed amounts, a poor show for a budget.
  const bills = categoryId(db, "Home & Bills");
  // Level 2 only (spec 34): none sits inside another, so no budget holds a bigger one.
  const all = listCategories(db);
  const topLevel = new Set(all.filter((c) => c.parentId === null).map((c) => c.id));
  const subcategories = new Set(
    all
      .filter((c) => c.kind === "expense" && c.parentId !== null && topLevel.has(c.parentId) && c.parentId !== bills)
      .map((c) => c.id),
  );
  // Budgets count everything under a category (spec 34), so pick by the same totals.
  const [over, near, under] = spendingUnder(db, from, until).filter(
    (r) => subcategories.has(r.categoryId) && r.amount > 0,
  );
  const round = (agorot: number, step: Agorot, how: (x: number) => number): Agorot => Math.max(1, how(agorot / step)) * step;
  const tens = (agorot: number, how: (x: number) => number): Agorot => round(agorot, 1000, how);
  if (!over) return;
  const overBudget = tens(over.amount * 0.85, Math.floor);
  setBudget(db, over.categoryId, overBudget);
  if (near) setBudget(db, near.categoryId, tens(near.amount / 0.9, Math.ceil));
  if (under) setBudget(db, under.categoryId, tens(under.amount * 3, Math.ceil));

  // spec 37: two level 3 budgets inside the first one, leaving some of it unsplit.
  const inner = all.filter((c) => c.parentId === over.categoryId);
  [0.4, 0.25].forEach((share, i) => {
    const c = inner[i];
    if (c) setBudget(db, c.id, tens(overBudget * share, Math.floor));
  });
  // The groups at their usual month, rounded up to ₪100, and never less than what sits inside.
  const month = today.slice(0, 7);
  const groups = new Set([bills]);
  for (const r of [over, near, under]) {
    const parentId = r && all.find((c) => c.id === r.categoryId)?.parentId;
    if (parentId) groups.add(parentId);
  }
  for (const line of budgetPlan(db, { month, today }).lines.filter((l) => groups.has(l.categoryId))) {
    setBudget(db, line.categoryId, round(Math.max(line.usual ?? 0, line.inside), 10_000, Math.ceil));
  }
  // The total: the top budgets are about 85% of it, rounded up to ₪1,000.
  setBudgetTotal(db, round(budgetPlan(db, { month, today }).split / 0.85, 100_000, Math.ceil));
}

/** spec 33: the memo that finds the pizza a friend paid half of back. */
const PIZZA_MEMO = "ערב פיצה עם נועה";

/** The later of two days. */
const later = (a: IsoDate, b: IsoDate): IsoDate => (a > b ? a : b);

/** Rows typed into the cash wallet, the days after the ATM withdrawal (`ATM_DAYS_AGO`). */
const ATM_DAYS_AGO = 6;
const CASH: { daysAgo: number; amount: Agorot; description: string; category?: string; note?: string }[] = [
  { daysAgo: 5, amount: -1800, description: "קפה ברחוב", category: "Coffee & Cafes" },
  { daysAgo: 4, amount: -6400, description: "שוק הכרמל", category: "Groceries", note: "Fruit and vegetables for the week" },
  { daysAgo: 3, amount: -3200, description: "פלאפל", category: "Restaurants", note: "Lunch with Noa" },
  { daysAgo: 2, amount: 20000, description: "מזומן מסבתא", note: "Birthday money" },
  { daysAgo: 1, amount: -1000, description: "חניה ברחוב", category: "Parking" },
];

function makeDrafts(today: IsoDate): Draft[] {
  const rand = mulberry32(20261107);
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
  const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)] as T;
  const shekels = (lo: number, hi: number): Agorot => -Math.round(between(lo, hi) * 100);

  const current = today.slice(0, 7);
  const drafts: Draft[] = [];
  for (let i = 0; i < MONTHS; i++) {
    const month = addMonths(current, i - MONTHS + 1);
    const days = daysOfMonth(month).filter((d) => d <= today);
    const share = days.length / daysOfMonth(month).length;
    const day = (d: number): IsoDate | null => days[d - 1] ?? null;
    const randomDay = (): IsoDate => days[int(0, days.length - 1)] as IsoDate;
    const add = (date: IsoDate | null, d: Omit<Draft, "date">) => {
      if (date) drafts.push({ ...d, date });
    };

    // The bank: salary, rent, bills, fees, cash, savings.
    add(day(1), { account: "bank", amount: 1_845_000, description: "משכורת", memo: "אקמי תוכנה בע״מ" });
    add(day(1), { account: "bank", amount: -580_000, description: "שכר דירה", memo: "הוראת קבע" });
    add(day(2), { account: "bank", amount: -150_000, description: "הפקדה לפיקדון", memo: "הוראת קבע" });
    add(day(3), { account: "bank", amount: -5990, description: "פלאפון תקשורת", memo: "הוראת קבע" });
    if (i % 2 === 1) add(day(2), { account: "bank", amount: -64230, description: "עיריית תל אביב-יפו", memo: "ארנונה" });
    if (i % 2 === 1) add(day(15), { account: "bank", amount: shekels(380, 520), description: "חברת החשמל לישראל" });
    if (i % 2 === 0) add(day(20), { account: "bank", amount: shekels(140, 190), description: "מי אביבים" });
    if (i % 3 !== 2) add(day(11), { account: "bank", amount: -100_000, description: "מיטב טרייד", memo: "קניית ני״ע" });
    if (i % 3 === 1) add(day(int(8, 18)), { account: "bank", amount: 320_000, description: "העברה מלקוח", memo: "סטודיו נגה" });
    if (i === 1) add(day(20), { account: "bank", amount: 400_000, description: "משיכה מפיקדון" });
    // One month a dentist bill puts spending beyond income.
    if (i === 3) add(day(16), { account: "bank", amount: -1_200_000, description: "מרפאת שיניים", memo: "טיפול שורש וכתר" });
    add(day(25), { account: "bank", amount: -1290, description: "עמלת פעולות" });
    for (let k = 0; k < Math.round(int(0, 2) * share); k++) {
      add(randomDay(), { account: "bank", amount: -40_000, description: "משיכת מזומן", memo: "כספומט" });
    }
    add(randomDay(), { account: "bank", amount: -int(5, 30) * 1000, description: "העברה ב-BIT", memo: "דנה" });

    // The second bank account (spec 24): interest in, a fee out.
    add(day(1), { account: "joint", amount: 850, description: "ריבית זכות" });
    add(day(4), { account: "joint", amount: -990, description: "עמלת ניהול חשבון" });

    // The everyday card.
    for (const spend of CARD_SPENDS) {
      const n = Math.round(int(spend.perMonth[0], spend.perMonth[1]) * share);
      for (let k = 0; k < n; k++) {
        add(randomDay(), { account: "everyday", amount: shekels(...spend.shekels), description: pick(spend.shops) });
      }
    }
    add(day(5), { account: "everyday", amount: -18640, description: "הראל ביטוח", memo: "ביטוח דירה" });
    add(day(6), { account: "everyday", amount: -5490, description: "NETFLIX.COM" });
    if (i >= 2) {
      add(day(14), { account: "everyday", amount: -39900, description: "איקאה נתניה", memo: "תשלומים", installment: { number: i - 1, total: 6 } });
    }
    if (i === 2) add(day(22), { account: "everyday", amount: 15990, description: "ZARA", memo: "זיכוי" });

    // The online card: subscriptions and shopping abroad.
    add(day(12), { account: "online", amount: -2190, description: "SPOTIFY" });
    add(day(18), { account: "online", amount: -1190, description: "APPLE.COM/BILL" });
    const usd = int(900, 4800);
    add(randomDay(), {
      account: "online",
      amount: -Math.round(usd * 3.72),
      description: pick(["ALIEXPRESS", "AMAZON MKTPLACE"]),
      original: { amount: -usd, currency: "USD" },
    });

    // The old card, used only at the start.
    if (i < 2) add(day(9), { account: "old", amount: shekels(90, 300), description: "המשביר לצרכן" });
  }

  // This month: rows waiting for a look, an excluded savings move, a card
  // bill from a card CoinLeak does not track, a purchase abroad whose shekel
  // amount is not known yet, and two lines for the Trash.
  const first = `${current}-01`;
  drafts.push(
    { account: "bank", date: first, amount: -200_000, description: "העברה לחשבון חיסכון", memo: "פיקדון" },
    { account: "bank", date: first, amount: -128_460, description: "מקס איט פיננסים", memo: "חיוב כרטיס" },
    { account: "bank", date: first, amount: -1500, description: "עמלת פעולה בערוץ ישיר" },
    { account: "bank", date: first, amount: 4000, description: "החזר עמלה" },
    { account: "everyday", date: first, amount: -8500, description: "PAYBOX" },
    { account: "everyday", date: first, amount: -24900, description: "ח.י. שיווק בע״מ" },
    // spec 33: a pizza on the first, half paid back by a friend over Bit a few days later.
    { account: "everyday", date: first, amount: -24000, description: "פיצה שמש", memo: PIZZA_MEMO },
    { account: "bank", date: later(first, toIsoDate(dayNumber(today) - 3)), amount: 12000, description: "העברה מ-BIT", memo: "נועה" },
    { account: "online", date: today, amount: 0, description: "ETSY.COM", pending: true, original: { amount: -5000, currency: "USD" } },
    // spec 20: the cash the wallet's rows are spent from.
    { account: "bank", date: toIsoDate(dayNumber(today) - ATM_DAYS_AGO), amount: -30000, description: "משיכת מזומן", memo: "כספומט" },
    // spec 24: rows since the bank's earlier sync, so both balance checks have some.
    { account: "bank", date: toIsoDate(dayNumber(today) - 1), amount: -4500, description: "העברה ב-BIT", memo: "יואב" },
    { account: "joint", date: toIsoDate(dayNumber(today) - 2), amount: -1500, description: "עמלת פעולה בסניף" },
  );

  // Statements name the branch, so one chain reads a few ways.
  const branches = ["שופרסל דיל רמת אביב", "שופרסל דיל דיזנגוף", "שופרסל דיל פלורנטין"];
  let b = 0;
  for (const d of drafts) if (d.description === "שופרסל דיל") d.description = branches[b++ % branches.length] as string;

  // Card purchases from the last two days are still pending.
  const pendingFrom = toIsoDate(dayNumber(today) - 1);
  for (const d of drafts) if (d.account !== "bank" && d.date >= pendingFrom) d.pending = true;

  drafts.push(...cardBills(drafts, today));
  return drafts;
}

/** Card rows are billed on the 10th of the next month: the bank pays one line per card and cycle. */
function cardBills(drafts: Draft[], today: IsoDate): Draft[] {
  const bills: Draft[] = [];
  for (const card of ["everyday", "online"] as const) {
    const cycles = new Map<IsoDate, Agorot>();
    for (const d of drafts) {
      const billed = billDate(d);
      if (d.account === card && billed) cycles.set(billed, (cycles.get(billed) ?? 0) + d.amount);
    }
    for (const [date, total] of cycles) {
      const number = ACCOUNTS[card].accountNumber;
      if (date <= today) bills.push({ account: "bank", date, amount: total, description: `כאל חיוב לכרטיס ${number}` });
    }
  }
  return bills;
}

function billDate(d: Draft): IsoDate | null {
  if (d.pending) return null;
  return d.account === "bank" ? d.date : `${addMonths(d.date.slice(0, 7), 1)}-10`;
}

/** spec 24: the balance at the earlier sync, worked back from today's.
 *  `unseen` is money the bank moved since then that no row shows. */
function balanceBefore(account: DemoAccount, drafts: Draft[], upToEarlier: Draft[], unseen: Agorot): Agorot {
  const today = ACCOUNTS[account].balance ?? 0;
  const since = drafts.filter((d) => d.account === account && !d.pending && !upToEarlier.includes(d));
  return today - since.reduce((t, d) => t + d.amount, 0) - unseen;
}

function scraped(account: DemoAccount, drafts: Draft[], balance = ACCOUNTS[account].balance): ScrapedAccount {
  const transactions: ScrapedTransaction[] = drafts
    .filter((d) => d.account === account)
    .map((d) => ({
      date: d.date,
      processedDate: billDate(d),
      amount: d.amount,
      originalAmount: d.original?.amount ?? null,
      originalCurrency: d.original?.currency ?? null,
      description: d.description,
      memo: d.memo ?? null,
      status: d.pending ? "pending" : "completed",
      installment: d.installment ?? null,
      identifier: null,
    }));
  return { ...ACCOUNTS[account], balance, transactions };
}

function ruleInput(db: Db, rule: DemoRule): RuleInput {
  const text = (mode: "contains" | "starts_with" | "equals" | "regex", values: string[] | undefined): RuleCondition[] =>
    values ? [{ kind: "text", field: "description", mode, values }] : [];
  const conditions: RuleCondition[] = [
    ...text("contains", rule.contains),
    ...text("starts_with", rule.startsWith),
    ...text("equals", rule.equals),
    ...text("regex", rule.regex ? [rule.regex] : undefined),
  ];
  if (rule.account) conditions.push({ kind: "account", accountId: accountId(db, rule.account) });
  if (rule.direction) conditions.push({ kind: "direction", direction: rule.direction });
  return {
    name: rule.name,
    enabled: rule.enabled ?? true,
    join: rule.join ?? "all",
    conditions,
    setCategoryId: rule.category ? categoryId(db, rule.category) : null,
    setExcluded: rule.exclude ? true : null,
  };
}

function categoryId(db: Db, name: string): number {
  const found = listCategories(db).find((c) => c.name === name);
  if (!found) throw new Error(`demo: no category ${name}`);
  return found.id;
}

function accountId(db: Db, account: DemoAccount): number {
  const { provider, accountNumber } = ACCOUNTS[account];
  const found = listAccounts(db).find((a) => a.provider === provider && a.accountNumber === accountNumber);
  if (!found) throw new Error(`demo: no account ${account}`);
  return found.id;
}

/** A small seeded random number generator, so the same seed gives the same rows. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
