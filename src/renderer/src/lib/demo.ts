// Synthetic demo ledger for VITE_DEMO builds and screenshots. Answers every
// channel the way the real app would, from made-up rows, so every total adds
// up, and keeps a few rules that really sort them. Never used otherwise.

import type {
  Account,
  Agorot,
  AppSettings,
  Category,
  CategoryCurve,
  CategoryProblem,
  Flow,
  IsoDate,
  IsoMonth,
  MoneyFlow,
  MonthSummary,
  ProviderId,
  ReviewFlag,
  Rule,
  RuleInput,
  SyncStage,
  TransactionFilter,
  TransactionPatch,
  TransactionRow,
  TrendPoint,
} from "@shared/types";
import type { Args, Channel, EventName, IpcEvents, Res } from "@shared/ipc";
import { ERROR_MESSAGES, type ErrorCode, type Result } from "@shared/errors";
import { isEnabledProvider } from "@shared/providers";
import { daysInMonth, parseMonth, shiftMonth, toIsoDate, toIsoMonth } from "./month";
import { applyRules, cleanConditions, cleanRule, matcher, suggest } from "./demo-rules";

export interface Demo {
  invoke<C extends Channel>(channel: C, args: Args<C>): Promise<Result<Res<C>>>;
  on<E extends EventName>(event: E, listener: (payload: IpcEvents[E]) => void): () => void;
}

export interface DemoOptions {
  /** Delay before each answer, to make loading states visible. */
  latencyMs?: number;
  /** Time between sync stages. */
  syncStepMs?: number;
}

// ---- Fixed reference data ----

const CATEGORIES: Category[] = [
  cat(1, null, "Food", "🍔", "#E7A875"),
  cat(11, 1, "Groceries", "🛒", "#81B482"),
  cat(12, 1, "Restaurants", "🍽️", "#E89B80"),
  cat(13, 1, "Coffee & Cafes", "☕", "#C9A27E"),
  cat(2, null, "Transportation", "🚗", "#7D90CA"),
  cat(21, 2, "Fuel & Parking", "⛽", "#8E9BD8"),
  cat(22, 2, "Public Transport", "🚌", "#65AFD2"),
  cat(3, null, "Home & Bills", "🏠", "#A4C386"),
  cat(31, 3, "Rent", "🔑", "#9CBF7C"),
  cat(32, 3, "Bills & Utilities", "🧾", "#B8A98F"),
  cat(33, 3, "Subscriptions", "🔁", "#AB9DDB"),
  cat(34, 3, "Insurance", "🛡️", "#E59A99"),
  cat(4, null, "Lifestyle", "✨", "#D692BF"),
  cat(41, 4, "Shopping", "🛍️", "#DCB87A"),
  cat(42, 4, "Entertainment", "🎬", "#E499A4"),
  cat(43, 4, "Personal Care", "💇", "#D5A4D7"),
  cat(5, null, "Health & Family", "🩷", "#65C1D1"),
  cat(51, 5, "Health", "🩺", "#75BCA3"),
  cat(52, 5, "Pet Care", "🐾", "#6FC3C0"),
  cat(6, null, "Money Movement", "🔄", "#A2ABBB"),
  cat(61, 6, "Cash & ATM", "🏧", "#DBC27F"),
  cat(62, 6, "Fees & Taxes", "🏛️", "#B1AA9C"),
  cat(63, 6, "Gifts & Donations", "🎁", "#E3A6B4"),
  cat(7, null, "Salary", "💼", "#8FBC8A", "income"),
  cat(8, null, "Side Income", "🧑‍💻", "#7FB8A6", "income"),
  cat(9, null, "Other Income", "💵", "#B5C98E", "income"),
  // spec 14: money moved to savings, neither spending nor income.
  cat(10, null, "Savings & Investments", "🏦", "#8FB8C9", "transfer"),
  cat(101, 10, "Savings", "🐷", "#86BFA8", "transfer"),
  cat(102, 10, "Investments", "📊", "#8E9BD0", "transfer"),
];

function cat(
  id: number,
  parentId: number | null,
  name: string,
  emoji: string,
  color: string,
  kind: Category["kind"] = "expense",
): Category {
  return { id, parentId, name, kind, emoji, color, archived: false };
}

const BANK = 1;
const CARD_MAIN = 2;
const CARD_ONLINE = 3;

type CardBill = "matched" | "untracked" | null;
interface DemoRow extends TransactionRow {
  /** What the matcher found: a tracked card's bill, an untracked one, or nothing. */
  cardBill: CardBill;
  /** The user's word on card bills (setInternal); null leaves it to the matcher. */
  userInternal: boolean | null;
  /** Who excluded the row, as in core: rules never undo the user's choice. */
  excludedSource: "user" | "rule" | null;
  /** In Trash (spec 11): counts nowhere, rules skip it, until restored. */
  trashed: boolean;
}

// The rules a person might have after a few months: every match mode, each
// condition, an exclude rule, and one switched off.
const SEED_RULES: RuleInput[] = [
  seedRule("Salary", "equals", "משכורת", { accountId: BANK, direction: "in", setCategoryId: 7 }),
  seedRule("Savings transfers", "starts_with", "העברה לחשבון חיסכון", { setExcluded: true }),
  seedRule("Shufersal", "starts_with", "שופרסל", { setCategoryId: 11 }),
  seedRule("Coffee on the go", "contains", "קפה", { amountMax: 6000, setCategoryId: 13 }),
  seedRule("Wolt", "contains", "wolt", { setCategoryId: 12 }),
  seedRule("Fuel at Paz", "starts_with", "פז", { accountId: CARD_MAIN, setCategoryId: 21 }),
  seedRule("Streaming", "regex", "netflix|spotify", { setCategoryId: 33 }),
  seedRule("Bit transfers", "starts_with", "העברה ב-BIT", { direction: "out", setCategoryId: 63, enabled: false }),
];

function seedRule(name: string, matchMode: RuleInput["matchMode"], matchText: string, rest: Partial<RuleInput>): RuleInput {
  return {
    name,
    enabled: true,
    matchField: "description",
    matchMode,
    matchText,
    accountId: null,
    amountMin: null,
    amountMax: null,
    direction: null,
    setCategoryId: null,
    setExcluded: null,
    ...rest,
  };
}

// ---- Deterministic randomness ----

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

// ---- Generating twelve months of history ----

interface Draft {
  accountId: number;
  date: IsoDate;
  amount: Agorot;
  description: string;
  memo?: string | null;
  categoryId: number | null;
  status?: TransactionRow["status"];
  installment?: { number: number; total: number } | null;
  original?: { amount: Agorot; currency: string };
  excluded?: boolean;
  cardBill?: CardBill;
  trashed?: boolean;
}

interface Spend {
  categoryId: number;
  merchants: string[];
  perMonth: [number, number];
  shekels: [number, number];
  account?: number;
}

const CARD_SPENDS: Spend[] = [
  { categoryId: 11, merchants: ["שופרסל דיל", "רמי לוי שיווק השקמה", "יוחננוף", "ויקטורי", "טיב טעם", "AM:PM"], perMonth: [7, 9], shekels: [58, 640] },
  { categoryId: 13, merchants: ["קפה קפה", "ארומה אספרסו בר", "קופיקס", "גרג קפה", "לנדוור"], perMonth: [8, 12], shekels: [14, 52] },
  { categoryId: 12, merchants: ["WOLT", "תן ביס", "הבורגר הבא", "מסעדת הסלון", "פיצה שמש"], perMonth: [4, 6], shekels: [62, 340] },
  { categoryId: 21, merchants: ["פז אפליקציה", "דלק מוטורס", "סונול", "פנגו", "אחוזות החוף"], perMonth: [3, 5], shekels: [12, 360] },
  { categoryId: 22, merchants: ["רב-קו אונליין", "מוביט"], perMonth: [1, 3], shekels: [30, 110] },
  { categoryId: 41, merchants: ["ZARA", "קסטרו", "H&M", "המשביר לצרכן", "ACE"], perMonth: [1, 3], shekels: [79, 520] },
  { categoryId: 51, merchants: ["סופר-פארם", "בי פארם", "מכבי פארם"], perMonth: [1, 2], shekels: [24, 230] },
  { categoryId: 42, merchants: ["סינמה סיטי", "יס פלאנט", "זאפה גני יהושע"], perMonth: [0, 2], shekels: [62, 280] },
  { categoryId: 43, merchants: ["מספרת רון", "ניצה קוסמטיקה"], perMonth: [0, 1], shekels: [80, 180] },
  { categoryId: 52, merchants: ["חיות ושות", "פט פוינט"], perMonth: [0, 1], shekels: [55, 190] },
];

function generate(today: Date): DemoRow[] {
  const rand = mulberry32(20261107);
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
  const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)] as T;
  const shekels = (lo: number, hi: number): Agorot => -Math.round(between(lo, hi) * 100);

  const todayIso = toIsoDate(today);
  const current = toIsoMonth(today);
  const first = shiftMonth(current, -11);
  const drafts: Draft[] = [];

  for (let i = 0; i < 12; i++) {
    const month = shiftMonth(first, i);
    const isCurrent = month === current;
    const lastDay = isCurrent ? today.getDate() : daysInMonth(month);
    const share = lastDay / daysInMonth(month);
    const day = (d: number): IsoDate | null => (d <= lastDay ? `${month}-${String(d).padStart(2, "0")}` : null);
    const randomDay = () => day(int(1, lastDay)) as IsoDate;
    const add = (d: IsoDate | null, draft: Omit<Draft, "date">) => {
      if (d) drafts.push({ ...draft, date: d });
    };
    const { month: m } = parseMonth(month);

    // Bank: salary, rent, bills, fees, cash.
    add(day(1), { accountId: BANK, amount: 1845000 + (m === 12 ? 250000 : 0), description: "משכורת", memo: "אקמי תוכנה בע״מ", categoryId: 7 });
    add(day(1), { accountId: BANK, amount: -580000, description: "שכר דירה", memo: "הוראת קבע", categoryId: 31 });
    add(day(3), { accountId: BANK, amount: -5990, description: "פלאפון תקשורת", memo: "הוראת קבע", categoryId: 32 });
    if (m % 2 === 1) add(day(2), { accountId: BANK, amount: -64230, description: "עיריית תל אביב-יפו", memo: "ארנונה", categoryId: 32 });
    if (m % 2 === 1) add(day(15), { accountId: BANK, amount: shekels(380, 520), description: "חברת החשמל לישראל", memo: null, categoryId: 32 });
    if (m % 2 === 0) add(day(20), { accountId: BANK, amount: shekels(140, 190), description: "מי אביבים", memo: null, categoryId: 32 });
    add(day(25), { accountId: BANK, amount: -1290, description: "עמלת פעולות", memo: null, categoryId: 62 });
    add(day(5), { accountId: CARD_MAIN, amount: -18640, description: "הראל ביטוח", memo: "ביטוח דירה", categoryId: 34 });
    for (let k = 0; k < Math.round(int(0, 2) * share); k++) {
      add(randomDay(), { accountId: BANK, amount: -40000, description: "משיכת מזומן", memo: "כספומט דיסקונט", categoryId: 61 });
    }
    if (i % 3 === 1) add(day(int(8, 18)), { accountId: BANK, amount: 320000, description: "העברה מלקוח", memo: "סטודיו נגה", categoryId: 8 });
    // spec 14: a standing order to savings, investing most months, and once a
    // year some money comes back out of savings.
    add(day(2), { accountId: BANK, amount: -150000, description: "הפקדה לפיקדון", memo: "הוראת קבע", categoryId: 101 });
    if (i % 3 !== 2) add(day(11), { accountId: BANK, amount: -100000, description: "מיטב טרייד", memo: "קניית ני״ע", categoryId: 102 });
    if (i === 4) add(day(20), { accountId: BANK, amount: 400000, description: "משיכה מפיקדון", memo: null, categoryId: 101 });

    // Everyday card purchases.
    for (const spend of CARD_SPENDS) {
      const n = Math.round(int(spend.perMonth[0], spend.perMonth[1]) * share);
      for (let k = 0; k < n; k++) {
        add(randomDay(), {
          accountId: spend.account ?? CARD_MAIN,
          amount: shekels(spend.shekels[0], spend.shekels[1]),
          description: pick(spend.merchants),
          categoryId: spend.categoryId,
        });
      }
    }
    add(day(6), { accountId: CARD_MAIN, amount: -5490, description: "NETFLIX.COM", memo: null, categoryId: 33 });
    if (i >= 6 && i <= 11) {
      add(day(14), {
        accountId: CARD_MAIN, amount: -39900, description: "איקאה נתניה", memo: "תשלומים", categoryId: 41,
        installment: { number: i - 5, total: 6 },
      });
    }
    if (i % 4 === 2) add(day(int(10, 26)), { accountId: CARD_MAIN, amount: 15990, description: "ZARA", memo: "זיכוי", categoryId: 41 });
    if (i % 2 === 0 && !isCurrent) {
      add(randomDay(), { accountId: BANK, amount: -Math.round(int(5, 30) * 1000), description: "העברה ב-BIT", memo: null, categoryId: 63 });
    }

    // The online card: subscriptions and shopping abroad.
    add(day(12), { accountId: CARD_ONLINE, amount: -2190, description: "SPOTIFY", memo: null, categoryId: 33 });
    add(day(18), { accountId: CARD_ONLINE, amount: -1190, description: "APPLE.COM/BILL", memo: null, categoryId: 33 });
    const usd = int(900, 4800);
    add(randomDay(), {
      accountId: CARD_ONLINE, amount: -Math.round(usd * 3.72), description: pick(["ALIEXPRESS", "AMAZON MKTPLACE PMTS"]),
      memo: null, categoryId: 41, original: { amount: -usd, currency: "USD" },
    });
  }

  // This month: a few rows waiting for a human, one excluded, one untracked
  // card bill, one pending line the bank stopped reporting (gone), and one
  // pending purchase abroad whose shekel amount is not known yet (amount 0).
  const cur = (d: number) => (d <= today.getDate() ? `${current}-${String(d).padStart(2, "0")}` : null);
  const firstOr = (d: number) => cur(d) ?? `${current}-01`;
  drafts.push(
    { accountId: BANK, date: firstOr(2), amount: -200000, description: "העברה לחשבון חיסכון", memo: "פיקדון", categoryId: null, excluded: true },
    { accountId: BANK, date: firstOr(4), amount: -128460, description: "מקס איט פיננסים", memo: "חיוב כרטיס", categoryId: null, cardBill: "untracked" },
    { accountId: BANK, date: firstOr(5), amount: -12000, description: "העברה ב-BIT", memo: "דנה", categoryId: null },
    { accountId: BANK, date: firstOr(3), amount: -35000, description: "חיוב זמני למפתח מזומן", memo: null, categoryId: null, status: "gone" },
    { accountId: CARD_MAIN, date: firstOr(6), amount: -8500, description: "PAYBOX", memo: null, categoryId: null },
    { accountId: CARD_MAIN, date: firstOr(3), amount: -24900, description: "ח.י. שיווק בע״מ", memo: null, categoryId: null },
    {
      accountId: CARD_ONLINE, date: toIsoDate(today), amount: 0, description: "ETSY.COM", memo: null, categoryId: 41,
      status: "pending", original: { amount: -5000, currency: "USD" },
    },
    // Two lines the user already put in Trash (spec 11).
    { accountId: BANK, date: firstOr(4), amount: -1500, description: "עמלת פעולה בערוץ ישיר", memo: null, categoryId: null, trashed: true },
    { accountId: BANK, date: firstOr(1), amount: 4000, description: "החזר עמלה", memo: null, categoryId: null, trashed: true },
  );

  // Real statements name the branch, so one chain reads a few ways.
  const branches = ["שופרסל דיל רמת אביב", "שופרסל דיל דיזנגוף", "שופרסל אקספרס פלורנטין"];
  let branch = 0;
  for (const d of drafts) if (d.description === "שופרסל דיל") d.description = branches[branch++ % branches.length] as string;

  // Card rows are billed on the 10th of the next month; the last two days are still pending.
  const pendingFrom = toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1));
  const rows: DemoRow[] = drafts.map((d) => {
    const isCard = d.accountId !== BANK;
    const status = d.status ?? (isCard && d.date >= pendingFrom ? "pending" : "completed");
    return {
      id: 0,
      accountId: d.accountId,
      date: d.date,
      processedDate: status !== "completed" ? null : isCard ? `${shiftMonth(d.date.slice(0, 7), 1)}-10` : d.date,
      amount: d.amount,
      originalAmount: d.original?.amount ?? null,
      originalCurrency: d.original?.currency ?? null,
      description: d.description,
      memo: d.memo ?? null,
      status,
      installment: d.installment ?? null,
      categoryId: d.categoryId,
      // Sorted by hand, until a demo rule claims the row (see createDemo).
      categorySource: d.categoryId == null ? null : "user",
      note: null,
      excluded: d.excluded ?? false,
      flow: "spending",
      flags: [],
      ruleId: null,
      cardBill: d.cardBill ?? null,
      userInternal: null,
      excludedSource: d.excluded ? "user" : null,
      trashed: d.trashed ?? false,
    };
  });

  // The bank pays each card's bill: one line, the sum of that cycle's rows.
  for (const card of [CARD_MAIN, CARD_ONLINE]) {
    const cycles = new Map<IsoDate, Agorot>();
    for (const r of rows) {
      if (r.accountId === card && r.processedDate) cycles.set(r.processedDate, (cycles.get(r.processedDate) ?? 0) + r.amount);
    }
    for (const [date, total] of cycles) {
      if (date > todayIso) continue;
      rows.push({
        id: 0,
        accountId: BANK,
        date,
        processedDate: date,
        amount: total,
        originalAmount: null,
        originalCurrency: null,
        description: "כאל חיוב לכרטיס",
        memo: `כרטיס ${card === CARD_MAIN ? "4821" : "7390"}`,
        status: "completed",
        installment: null,
        categoryId: null,
        categorySource: null,
        note: null,
        excluded: false,
        flow: "internal",
        flags: [],
        ruleId: null,
        cardBill: "matched",
        userInternal: null,
        excludedSource: null,
        trashed: false,
      });
    }
  }

  rows.sort((a, b) => (a.date === b.date ? a.accountId - b.accountId : a.date < b.date ? -1 : 1));
  rows.forEach((r, i) => {
    r.id = i + 1;
  });
  return rows;
}

// ---- The money model, same table as REQUIREMENTS section 4 ----

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));
const COUNTED: Flow[] = ["spending", "refund"];

function derive(r: DemoRow): void {
  const internal = r.userInternal ?? r.cardBill === "matched";
  let flow: Flow;
  if (r.trashed) flow = "trashed";
  else if (r.status === "gone") flow = "gone";
  else if (r.excluded) flow = "excluded";
  else if (internal) flow = "internal";
  else if (r.categoryId != null && byId.get(r.categoryId)?.kind === "transfer") flow = "transfer";
  else if (r.amount > 0) flow = r.categoryId != null && byId.get(r.categoryId)?.kind === "expense" ? "refund" : "income";
  else flow = "spending";
  // Like core: only counted rows need a look, and the user's answer settles a card bill.
  const counted = flow === "spending" || flow === "income";
  const flags: ReviewFlag[] = [];
  if (flow === "gone") flags.push("gone");
  if (counted && r.categoryId == null) flags.push("uncategorized");
  if (counted && r.cardBill === "untracked" && r.userInternal === null && r.categorySource !== "user") {
    flags.push("possible_card_bill");
  }
  r.flow = flow;
  r.flags = flags;
}

// ---- The demo app ----

export function createDemo(today: Date = new Date(), opts: DemoOptions = {}): Demo {
  const latency = opts.latencyMs ?? 0;
  const step = opts.syncStepMs ?? 900;
  const current = toIsoMonth(today);
  const rows = generate(today);

  // Rules: rows a seeded rule fits are the rule's, every other sorted row the user's.
  let rules: Rule[] = SEED_RULES.map((r, i) => ({ ...r, id: i + 1, position: i + 1 }));
  let nextRuleId = rules.length + 1;
  for (const rule of rules.filter((r) => r.enabled)) {
    const fits = matcher(rule);
    for (const r of rows.filter(fits)) {
      if (rule.setCategoryId !== null) [r.categoryId, r.categorySource] = [null, null];
      if (rule.setExcluded !== null) [r.excluded, r.excludedSource] = [false, null];
    }
  }
  const reapply = () => {
    applyRules(rows.filter((r) => !r.trashed), rules);
    rows.forEach(derive);
  };
  reapply();

  const synced = new Date(today.getTime() - 2 * 3600 * 1000).toISOString();
  const accounts: Account[] = [
    { id: BANK, provider: "discount", kind: "bank", accountNumber: "0123456789", name: "Current account", cardMode: null, lastSyncedAt: synced },
    { id: CARD_MAIN, provider: "visaCal", kind: "card", accountNumber: "4821", name: "Everyday card", cardMode: "credit", lastSyncedAt: synced },
    { id: CARD_ONLINE, provider: "visaCal", kind: "card", accountNumber: "7390", name: "Online card", cardMode: "credit", lastSyncedAt: synced },
    // spec 15: a card the user removed from syncing, shown in the Removed group.
    { id: 4, provider: "isracard", kind: "card", accountNumber: "5512", name: "Old card", cardMode: "credit", lastSyncedAt: new Date(today.getTime() - 95 * 86400 * 1000).toISOString() },
  ];
  for (const a of accounts) a.syncEnabled = a.id !== 4;
  // spec 15: categories the editor can change, and the settings table.
  const catList: Category[] = CATEGORIES.map((c) => ({ ...c }));
  let nextCategoryId = 100;
  const settings: AppSettings = { addedProviders: ["max"] };

  const listeners = new Map<EventName, Set<(p: never) => void>>();
  const emit = <E extends EventName>(event: E, payload: IpcEvents[E]) => {
    listeners.get(event)?.forEach((l) => (l as (p: IpcEvents[E]) => void)(payload));
  };
  let sync: { provider: ProviderId; timers: ReturnType<typeof setTimeout>[]; finish: (r: Result<Res<"sync:start">>) => void } | null = null;

  const fail = (code: ErrorCode): Result<never> => ({ ok: false, error: { code, message: ERROR_MESSAGES[code] } });
  const ok = <T,>(value: T): Result<T> => ({ ok: true, value: structuredClone(value) });
  const publicRow = (r: DemoRow): TransactionRow => {
    const { cardBill, userInternal, excludedSource, trashed, ...row } = r;
    void cardBill;
    void userInternal;
    void excludedSource;
    void trashed;
    return row;
  };
  const validIds = (ids: unknown): ids is number[] =>
    Array.isArray(ids) && ids.length > 0 && ids.every((id) => Number.isInteger(id) && id > 0);

  function rollUp(cats: Map<number | null, { amount: Agorot; count: number }>): MonthSummary["byParent"] {
    const parents = new Map<number | null, { amount: Agorot; count: number }>();
    for (const [id, c] of cats) {
      const key = id === null ? null : (catList.find((x) => x.id === id)?.parentId ?? id);
      const p = parents.get(key) ?? { amount: 0, count: 0 };
      p.amount += c.amount;
      p.count += c.count;
      parents.set(key, p);
    }
    return [...parents].map(([categoryId, p]) => ({ categoryId, ...p })).sort((a, b) => b.amount - a.amount);
  }

  function summary(month: IsoMonth): MonthSummary {
    const inMonth = rows.filter((r) => r.date.startsWith(month));
    const counted = inMonth.filter((r) => COUNTED.includes(r.flow));
    const cats = new Map<number | null, { amount: Agorot; count: number }>();
    for (const r of counted) {
      const c = cats.get(r.categoryId) ?? { amount: 0, count: 0 };
      c.amount -= r.amount;
      c.count += 1;
      cats.set(r.categoryId, c);
    }
    const lastDay = month === current ? today.getDate() : month > current ? 0 : daysInMonth(month);
    const byDay: MonthSummary["byDay"] = [];
    let running = 0;
    for (let d = 1; d <= lastDay; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      for (const r of counted) if (r.date === date) running -= r.amount;
      byDay.push({ date, amount: running });
    }
    return {
      month,
      income: inMonth.filter((r) => r.flow === "income").reduce((a, r) => a + r.amount, 0),
      spending: -counted.reduce((a, r) => a + r.amount, 0),
      transfers: -inMonth.filter((r) => r.flow === "transfer").reduce((a, r) => a + r.amount, 0),
      byCategory: [...cats]
        .map(([categoryId, c]) => ({ categoryId, ...c }))
        .sort((a, b) => b.amount - a.amount),
      byParent: rollUp(cats),
      byDay,
      needsReview: inMonth.filter((r) => r.flags.length > 0).length,
    };
  }

  function trend(months: number): TrendPoint[] {
    const n = Math.max(1, Math.min(60, Math.floor(months)));
    return Array.from({ length: n }, (_, i) => {
      const { month, income, spending, byCategory } = summary(shiftMonth(current, i - n + 1));
      return { month, income, spending, byCategory: byCategory.map(({ categoryId, amount }) => ({ categoryId, amount })) };
    });
  }

  // spec 12: the same curves core draws, from the demo rows.
  function curves(month: IsoMonth, ids: (number | null)[]): CategoryCurve[] {
    const parentOf = (id: number | null) => (id === null ? null : catList.find((c) => c.id === id)?.parentId);
    const curve = (id: number | null, m: IsoMonth) => {
      const mine = rows.filter(
        (r) => r.date.startsWith(m) && COUNTED.includes(r.flow) && (r.categoryId === id || (id !== null && parentOf(r.categoryId) === id)),
      );
      let running = 0;
      return Array.from({ length: daysInMonth(m) }, (_, i) => {
        const date = `${m}-${String(i + 1).padStart(2, "0")}`;
        for (const r of mine) if (r.date === date) running -= r.amount;
        return { date, amount: running };
      });
    };
    return ids.map((categoryId) => ({ categoryId, byDay: curve(categoryId, month), previousByDay: curve(categoryId, shiftMonth(month, -1)) }));
  }

  // spec 14: the same flow core draws (ledger/money-flow.ts), from the demo rows.
  function moneyFlow(month: IsoMonth): MoneyFlow {
    const sm = summary(month);
    const rootOf = (id: number | null) => (id === null ? null : (byId.get(id)?.parentId ?? id));
    const net = (flow: Flow, sign: 1 | -1) => {
      const by = new Map<number | null, Agorot>();
      for (const r of rows) {
        if (!r.date.startsWith(month) || r.flow !== flow) continue;
        by.set(rootOf(r.categoryId), (by.get(rootOf(r.categoryId)) ?? 0) + sign * r.amount);
      }
      return [...by].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount);
    };
    const sum = (xs: { amount: Agorot }[]) => xs.reduce((a, x) => a + x.amount, 0);
    const income = net("income", 1);
    const transfers = net("transfer", -1);
    const refunds = sm.byParent.filter((p) => p.amount < 0).map((p) => ({ categoryId: p.categoryId, amount: -p.amount }));
    const outSpending = sm.byParent.filter((p) => p.amount > 0);
    const outTransfers = transfers.filter((p) => p.amount > 0);
    const back = -sum(transfers.filter((p) => p.amount < 0));
    const have = sum(income) + sum(refunds) + back;
    const need = sum(outSpending) + sum(outTransfers);
    const fromSavings = back + Math.max(0, need - have);
    const left = Math.max(0, have - need);
    type Kind = MoneyFlow["nodes"][number]["kind"];
    const node = (kind: Kind) => (p: { categoryId: number | null; amount: Agorot }) => ({ kind, categoryId: p.categoryId, amount: p.amount });
    const sources = [
      ...income.map(node("income")),
      ...refunds.map(node("refund")),
      ...(fromSavings > 0 ? [node("from_savings")({ categoryId: null, amount: fromSavings })] : []),
    ];
    const targets = [
      ...outSpending.map(node("spending")),
      ...outTransfers.map(node("transfer")),
      ...(left > 0 ? [node("left")({ categoryId: null, amount: left })] : []),
    ];
    const base = { month, income: sm.income, spending: sm.spending, transfers: sm.transfers };
    const total = sum(sources);
    if (total === 0) return { ...base, nodes: [], links: [] };
    const hub = sources.length;
    return {
      ...base,
      nodes: [...sources, node("hub")({ categoryId: null, amount: total }), ...targets],
      links: [
        ...sources.map((n, i) => ({ source: i, target: hub, amount: n.amount })),
        ...targets.map((n, i) => ({ source: hub, target: hub + 1 + i, amount: n.amount })),
      ],
    };
  }

  function list(f: TransactionFilter): TransactionRow[] {
    const q = f.search?.trim().toLowerCase();
    return rows
      .filter(
        (r) =>
          (!f.from || r.date >= f.from) &&
          (!f.to || r.date <= f.to) &&
          (!f.accountIds || f.accountIds.includes(r.accountId)) &&
          (!f.categoryIds || f.categoryIds.includes(r.categoryId)) &&
          (!f.flows?.length || f.flows.includes(r.flow)) &&
          (r.flow !== "trashed" || Boolean(f.flows?.includes("trashed"))) &&
          (!f.hideInternal || r.flow !== "internal") &&
          (!f.needsReview || r.flags.length > 0) &&
          (!q || [r.description, r.memo, r.note].some((t) => t?.toLowerCase().includes(q))),
      )
      .sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1))
      .map(publicRow);
  }

  function update(ids: number[], patch: TransactionPatch): Result<{ updated: number }> {
    if (!Array.isArray(ids) || ids.length === 0) return fail("BAD_REQUEST");
    if (patch.categoryId != null && !byId.has(patch.categoryId)) return fail("BAD_REQUEST");
    let updated = 0;
    for (const r of rows) {
      if (!ids.includes(r.id)) continue;
      // Like core: even clearing a category is the user's word, so rules leave it.
      if ("categoryId" in patch) {
        r.categoryId = patch.categoryId ?? null;
        r.categorySource = "user";
      }
      if ("note" in patch) r.note = patch.note ?? null;
      if (patch.excluded !== undefined) {
        r.excluded = patch.excluded;
        r.excludedSource = "user";
      }
      derive(r);
      updated++;
    }
    return ok({ updated });
  }

  function setInternal(ids: unknown, internal: unknown): Result<{ updated: number }> {
    if (!validIds(ids) || !(internal === null || typeof internal === "boolean")) return fail("BAD_REQUEST");
    let updated = 0;
    for (const r of rows) {
      if (!ids.includes(r.id)) continue;
      r.userInternal = internal;
      derive(r);
      updated++;
    }
    return ok({ updated });
  }

  function deleteGone(ids: unknown): Result<{ deleted: number }> {
    if (!validIds(ids)) return fail("BAD_REQUEST");
    let deleted = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i];
      if (r && r.status === "gone" && ids.includes(r.id)) {
        rows.splice(i, 1);
        deleted++;
      }
    }
    return ok({ deleted });
  }

  // ---- Trash, as in core: a user field that sync and rules never touch ----

  function setTrashed(ids: unknown, trashed: boolean): Result<{ updated: number }> {
    if (!validIds(ids)) return fail("BAD_REQUEST");
    let updated = 0;
    for (const r of rows) {
      if (!ids.includes(r.id) || r.trashed === trashed) continue;
      r.trashed = trashed;
      updated++;
    }
    reapply();
    return ok({ updated });
  }

  function emptyTrash(): Result<{ deleted: number }> {
    let deleted = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i]?.trashed) {
        rows.splice(i, 1);
        deleted++;
      }
    }
    return ok({ deleted });
  }

  // ---- Rules, answered like core: every change reapplies all rules ----

  const accountIds = () => new Set(accounts.map((a) => a.id));
  const categoryIds = new Set(catList.map((c) => c.id));
  const ordered = () => [...rules].sort((a, b) => a.position - b.position);
  const renumber = (list: Rule[]) => {
    rules = list.map((r, i) => ({ ...r, position: i + 1 }));
  };

  function createRule(input: unknown): Result<Rule> {
    const rule = cleanRule(input, accountIds(), categoryIds);
    if (!rule) return fail("BAD_REQUEST");
    const saved: Rule = { ...rule, id: nextRuleId++, position: rules.length + 1 };
    rules.push(saved);
    reapply();
    return ok(saved);
  }

  function updateRule(id: unknown, input: unknown): Result<Rule> {
    const rule = cleanRule(input, accountIds(), categoryIds);
    const old = rules.find((r) => r.id === id);
    if (!rule || !old) return fail("BAD_REQUEST");
    const saved: Rule = { ...rule, id: old.id, position: old.position };
    rules = rules.map((r) => (r.id === old.id ? saved : r));
    reapply();
    return ok(saved);
  }

  function deleteRule(id: unknown): Result<null> {
    if (!rules.some((r) => r.id === id)) return fail("BAD_REQUEST");
    renumber(ordered().filter((r) => r.id !== id));
    reapply();
    return ok(null);
  }

  function reorderRules(ids: unknown): Result<null> {
    const byRule = new Map(rules.map((r) => [r.id, r]));
    if (!Array.isArray(ids) || ids.length !== rules.length || new Set(ids).size !== ids.length) return fail("BAD_REQUEST");
    if (!ids.every((id) => byRule.has(id))) return fail("BAD_REQUEST");
    renumber(ids.map((id) => byRule.get(id) as Rule));
    reapply();
    return ok(null);
  }

  /** Every row the conditions fit, whoever sorted it, newest first. */
  function previewRule(input: unknown): Result<Res<"rules:preview">> {
    const conditions = cleanConditions(input, accountIds());
    if (!conditions) return fail("BAD_REQUEST");
    const fits = matcher(conditions);
    const all = list({}).filter(fits);
    return ok({ matches: all.length, sample: all.slice(0, 20) });
  }

  function suggestRule(ids: unknown): Result<RuleInput> {
    if (!validIds(ids)) return fail("BAD_REQUEST");
    const draft = suggest(rows.filter((r) => ids.includes(r.id)).sort((a, b) => a.id - b.id));
    return draft ? ok(draft) : fail("BAD_REQUEST");
  }

  // Demo card bills are fixed in advance, so switching mode only records it.
  function setCardMode(accountId: unknown, mode: unknown): Result<null> {
    const account = accounts.find((a) => a.id === accountId && a.kind === "card");
    if (!account || (mode !== "credit" && mode !== "debit")) return fail("BAD_REQUEST");
    account.cardMode = mode;
    return ok(null);
  }

  // ---- spec 15: categories editor, answered like core ----

  function listCats(): Category[] {
    return catList.map((c) => ({
      ...c,
      rowCount: rows.filter((r) => r.categoryId === c.id).length,
      ruleCount: rules.filter((r) => r.setCategoryId === c.id).length,
    }));
  }

  type CatChange = Res<"categories:create">;
  const refuse = (problem: CategoryProblem): Result<CatChange> => ok({ ok: false, problem });
  const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");
  const taken = (parentId: number | null, name: string, self: number | null) =>
    catList.some((c) => c.parentId === parentId && c.id !== self && c.name.toLowerCase() === name.toLowerCase());
  const parentProblem = (parentId: number, kind: Category["kind"]): CategoryProblem | "bad" | null => {
    const parent = catList.find((c) => c.id === parentId);
    if (!parent) return "bad";
    if (parent.parentId !== null) return "parent_not_top_level";
    return parent.kind !== kind ? "parent_other_kind" : null;
  };
  const okColor = (v: unknown) => v === null || (typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v));
  const okEmoji = (v: unknown) => v === null || (typeof v === "string" && v.length <= 16);
  const withCounts = (id: number) => listCats().find((c) => c.id === id) as Category;
  /** Children follow their parent, as in core's order. */
  const place = (c: Category) => {
    const p = c.parentId;
    const after = p === null ? catList.length - 1 : catList.map((x) => x.id === p || x.parentId === p).lastIndexOf(true);
    catList.splice(after + 1, 0, c);
  };

  function createCat(input: Args<"categories:create">): Result<CatChange> {
    const name = cleanName(input?.name);
    if (!name || name.length > 60 || !okColor(input.color) || !okEmoji(input.emoji)) return fail("BAD_REQUEST");
    if (input.kind !== "expense" && input.kind !== "income") return fail("BAD_REQUEST");
    if (input.parentId !== null) {
      const problem = parentProblem(input.parentId, input.kind);
      if (problem === "bad") return fail("BAD_REQUEST");
      if (problem) return refuse(problem);
    }
    if (taken(input.parentId, name, null)) return refuse("name_taken");
    const c: Category = {
      id: nextCategoryId++,
      parentId: input.parentId,
      name,
      kind: input.kind,
      emoji: input.emoji || null,
      color: input.color,
      archived: false,
    };
    place(c);
    categoryIds.add(c.id);
    return ok({ ok: true, category: withCounts(c.id) });
  }

  function updateCat(id: unknown, patch: Args<"categories:update">["patch"]): Result<CatChange> {
    const c = catList.find((x) => x.id === id);
    if (!c) return fail("BAD_REQUEST");
    const name = patch.name === undefined ? c.name : cleanName(patch.name);
    if (!name || name.length > 60) return fail("BAD_REQUEST");
    if (patch.color !== undefined && !okColor(patch.color)) return fail("BAD_REQUEST");
    if (patch.emoji !== undefined && !okEmoji(patch.emoji)) return fail("BAD_REQUEST");
    const parentId = patch.parentId === undefined ? c.parentId : patch.parentId;
    const moving = parentId !== c.parentId;
    if (moving && parentId !== null) {
      if (parentId === c.id) return fail("BAD_REQUEST");
      const problem = parentProblem(parentId, c.kind);
      if (problem === "bad") return fail("BAD_REQUEST");
      if (problem) return refuse(problem);
      if (catList.some((x) => x.parentId === c.id)) return refuse("has_children");
    }
    if (taken(parentId, name, c.id)) return refuse("name_taken");
    c.name = name;
    if (patch.emoji !== undefined) c.emoji = patch.emoji || null;
    if (patch.color !== undefined) c.color = patch.color;
    if (moving) {
      catList.splice(catList.indexOf(c), 1);
      c.parentId = parentId;
      place(c);
    }
    return ok({ ok: true, category: withCounts(c.id) });
  }

  function deleteCat(id: unknown, moveTo: number | null): Result<Res<"categories:delete">> {
    const c = catList.find((x) => x.id === id);
    if (!c || moveTo === id) return fail("BAD_REQUEST");
    if (catList.some((x) => x.parentId === c.id)) return ok({ ok: false, problem: "has_children" });
    const mine = rows.filter((r) => r.categoryId === c.id);
    const ruled = rules.filter((r) => r.setCategoryId === c.id);
    if (mine.length + ruled.length > 0) {
      if (moveTo === null) return ok({ ok: false, problem: "in_use" });
      const target = catList.find((x) => x.id === moveTo);
      if (!target) return fail("BAD_REQUEST");
      if (target.kind !== c.kind) return ok({ ok: false, problem: "target_other_kind" });
      mine.forEach((r) => (r.categoryId = moveTo));
      rules = rules.map((r) => (r.setCategoryId === c.id ? { ...r, setCategoryId: moveTo } : r));
    }
    catList.splice(catList.indexOf(c), 1);
    categoryIds.delete(c.id);
    return ok({ ok: true, movedRows: mine.length, movedRules: ruled.length });
  }

  /** Spec 13's known places, until its own demo answer lands: each category rule's text. */
  function knownPlaces(): { categoryId: number; ruleId: number; names: string[] }[] {
    return ordered()
      .filter((r) => r.setCategoryId !== null && r.matchMode !== "regex")
      .map((r) => ({ categoryId: r.setCategoryId as number, ruleId: r.id, names: [r.matchText] }));
  }

  function startSync(provider: ProviderId): Promise<Result<Res<"sync:start">>> {
    if (sync) return Promise.resolve(fail("SYNC_IN_PROGRESS"));
    return new Promise((resolve) => {
      const stages: SyncStage[] = ["opening_browser", "waiting_for_login", "downloading", "saving", "done"];
      // Logging in takes the longest, as it does at a real bank.
      const at = [0, 1, 6, 7, 8];
      const timers = stages.map((stage, i) =>
        setTimeout(() => {
          emit("sync:progress", { provider, stage });
          if (stage !== "done") return;
          const now = new Date().toISOString();
          const mine = accounts.filter((a) => a.provider === provider);
          mine.forEach((a) => (a.lastSyncedAt = now));
          sync = null;
          resolve(ok({ provider, accounts: mine.length, newRows: 0, updatedRows: 0 }));
        }, (at[i] ?? 0) * step),
      );
      sync = { provider, timers, finish: resolve };
    });
  }

  function cancelSync(): Result<null> {
    if (sync) {
      const { provider, timers, finish } = sync;
      timers.forEach(clearTimeout);
      sync = null;
      emit("sync:progress", { provider, stage: "failed" });
      finish(fail("LOGIN_CANCELLED"));
    }
    return ok(null);
  }

  async function answer(channel: Channel, args: unknown): Promise<Result<unknown>> {
    switch (channel) {
      case "app:info":
        return ok({ version: "0.0.1", dataDir: "~/.config/CoinLeak-dev/data", dev: true });
      case "accounts:list":
        return ok(accounts);
      case "categories:list":
        return ok(listCats());
      case "transactions:list":
        return ok(list((args ?? {}) as TransactionFilter));
      case "transactions:update": {
        const a = args as Args<"transactions:update">;
        return update(a?.ids, a?.patch ?? {});
      }
      case "summary:month": {
        const month = (args as Args<"summary:month">)?.month;
        return /^\d{4}-\d{2}$/.test(month ?? "") ? ok(summary(month)) : fail("BAD_REQUEST");
      }
      case "summary:trend":
        return ok(trend((args as Args<"summary:trend">)?.months ?? 12));
      case "summary:curves": {
        const a = args as Args<"summary:curves">;
        const valid = /^\d{4}-\d{2}$/.test(a?.month ?? "") && Array.isArray(a?.categoryIds);
        return valid ? ok(curves(a.month, a.categoryIds)) : fail("BAD_REQUEST");
      }
      case "summary:flow": {
        const month = (args as Args<"summary:flow">)?.month;
        return /^\d{4}-\d{2}$/.test(month ?? "") ? ok(moneyFlow(month)) : fail("BAD_REQUEST");
      }
      case "sync:start":
        return startSync((args as Args<"sync:start">).provider);
      case "sync:cancel":
        return cancelSync();
      case "transactions:setInternal": {
        const a = args as Args<"transactions:setInternal">;
        return setInternal(a?.ids, a?.internal);
      }
      case "transactions:deleteGone":
        return deleteGone((args as Args<"transactions:deleteGone">)?.ids);
      case "transactions:trash":
        return setTrashed((args as Args<"transactions:trash">)?.ids, true);
      case "transactions:restore":
        return setTrashed((args as Args<"transactions:restore">)?.ids, false);
      case "transactions:emptyTrash":
        return emptyTrash();
      case "accounts:setCardMode": {
        const a = args as Args<"accounts:setCardMode">;
        return setCardMode(a?.accountId, a?.mode);
      }
      case "rules:list":
        return ok(ordered());
      case "rules:create":
        return createRule(args);
      case "rules:update": {
        const a = args as Args<"rules:update">;
        return updateRule(a?.id, a?.rule);
      }
      case "rules:delete":
        return deleteRule((args as Args<"rules:delete">)?.id);
      case "rules:reorder":
        return reorderRules((args as Args<"rules:reorder">)?.ids);
      case "rules:preview":
        return previewRule(args);
      case "rules:suggest":
        return suggestRule((args as Args<"rules:suggest">)?.ids);
      case "categories:create":
        return createCat(args as Args<"categories:create">);
      case "categories:update": {
        const a = args as Args<"categories:update">;
        return updateCat(a?.id, a?.patch ?? {});
      }
      case "categories:delete": {
        const a = args as Args<"categories:delete">;
        return deleteCat(a?.id, a?.moveTo ?? null);
      }
      case "accounts:setSyncing": {
        const a = args as Args<"accounts:setSyncing">;
        if (!validIds(a?.ids) || typeof a.enabled !== "boolean") return fail("BAD_REQUEST");
        const mine = accounts.filter((x) => a.ids.includes(x.id));
        if (mine.length !== new Set(a.ids).size) return fail("BAD_REQUEST");
        const changed = mine.filter((x) => x.syncEnabled !== a.enabled);
        changed.forEach((x) => (x.syncEnabled = a.enabled));
        return ok({ updated: changed.length });
      }
      case "settings:get": {
        const key = (args as Args<"settings:get">)?.key;
        return key === "addedProviders" ? ok(settings[key]) : fail("BAD_REQUEST");
      }
      case "settings:set": {
        const a = args as Args<"settings:set">;
        const value: unknown = a?.value;
        if (a?.key !== "addedProviders" || !Array.isArray(value) || !value.every(isEnabledProvider)) return fail("BAD_REQUEST");
        settings.addedProviders = [...new Set(value)];
        return ok(null);
      }
      default:
        // Spec 13's known places channel, answered here until it lands.
        if ((channel as string) === "rules:knownPlaces") return ok(knownPlaces());
        return fail("NOT_IMPLEMENTED");
    }
  }

  return {
    async invoke(channel, args) {
      if (latency > 0) await new Promise((r) => setTimeout(r, latency));
      return (await answer(channel, args)) as Result<Res<typeof channel>>;
    },
    on(event, listener) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener as (p: never) => void);
      listeners.set(event, set);
      return () => set.delete(listener as (p: never) => void);
    },
  };
}
