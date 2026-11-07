// Synthetic demo ledger for VITE_DEMO builds and screenshots. Answers every
// channel the way the real app would, from made-up rows, so every total adds
// up. Stands in for core until real data is wired; never used otherwise.

import type {
  Account,
  Agorot,
  Category,
  Flow,
  IsoDate,
  IsoMonth,
  MonthSummary,
  ProviderId,
  ReviewFlag,
  SyncStage,
  TransactionFilter,
  TransactionPatch,
  TransactionRow,
  TrendPoint,
} from "@shared/types";
import type { Args, Channel, EventName, IpcEvents, Res } from "@shared/ipc";
import { ERROR_MESSAGES, type ErrorCode, type Result } from "@shared/errors";
import { daysInMonth, parseMonth, shiftMonth, toIsoDate, toIsoMonth } from "./month";

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
  );

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
      categorySource: d.categoryId == null ? null : "rule",
      note: null,
      excluded: d.excluded ?? false,
      flow: "spending",
      flags: [],
      cardBill: d.cardBill ?? null,
      userInternal: null,
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
        cardBill: "matched",
        userInternal: null,
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
  if (r.status === "gone") flow = "gone";
  else if (r.excluded) flow = "excluded";
  else if (internal) flow = "internal";
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
  rows.forEach(derive);

  const synced = new Date(today.getTime() - 2 * 3600 * 1000).toISOString();
  const accounts: Account[] = [
    { id: BANK, provider: "discount", kind: "bank", accountNumber: "0123456789", name: "Current account", cardMode: null, lastSyncedAt: synced },
    { id: CARD_MAIN, provider: "visaCal", kind: "card", accountNumber: "4821", name: "Everyday card", cardMode: "credit", lastSyncedAt: synced },
    { id: CARD_ONLINE, provider: "visaCal", kind: "card", accountNumber: "7390", name: "Online card", cardMode: "credit", lastSyncedAt: synced },
  ];

  const listeners = new Map<EventName, Set<(p: never) => void>>();
  const emit = <E extends EventName>(event: E, payload: IpcEvents[E]) => {
    listeners.get(event)?.forEach((l) => (l as (p: IpcEvents[E]) => void)(payload));
  };
  let sync: { provider: ProviderId; timers: ReturnType<typeof setTimeout>[]; finish: (r: Result<Res<"sync:start">>) => void } | null = null;

  const fail = (code: ErrorCode): Result<never> => ({ ok: false, error: { code, message: ERROR_MESSAGES[code] } });
  const ok = <T,>(value: T): Result<T> => ({ ok: true, value: structuredClone(value) });
  const publicRow = (r: DemoRow): TransactionRow => {
    const { cardBill, userInternal, ...row } = r;
    void cardBill;
    void userInternal;
    return row;
  };
  const validIds = (ids: unknown): ids is number[] =>
    Array.isArray(ids) && ids.length > 0 && ids.every((id) => Number.isInteger(id) && id > 0);

  function rollUp(cats: Map<number | null, { amount: Agorot; count: number }>): MonthSummary["byParent"] {
    const parents = new Map<number | null, { amount: Agorot; count: number }>();
    for (const [id, c] of cats) {
      const key = id === null ? null : (CATEGORIES.find((x) => x.id === id)?.parentId ?? id);
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

  function list(f: TransactionFilter): TransactionRow[] {
    const q = f.search?.trim().toLowerCase();
    return rows
      .filter(
        (r) =>
          (!f.from || r.date >= f.from) &&
          (!f.to || r.date <= f.to) &&
          (!f.accountIds || f.accountIds.includes(r.accountId)) &&
          (!f.categoryIds || f.categoryIds.includes(r.categoryId)) &&
          (!f.flows || f.flows.includes(r.flow)) &&
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
      if ("categoryId" in patch) {
        r.categoryId = patch.categoryId ?? null;
        r.categorySource = r.categoryId == null ? null : "user";
      }
      if ("note" in patch) r.note = patch.note ?? null;
      if (patch.excluded !== undefined) r.excluded = patch.excluded;
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

  // Demo card bills are fixed in advance, so switching mode only records it.
  function setCardMode(accountId: unknown, mode: unknown): Result<null> {
    const account = accounts.find((a) => a.id === accountId && a.kind === "card");
    if (!account || (mode !== "credit" && mode !== "debit")) return fail("BAD_REQUEST");
    account.cardMode = mode;
    return ok(null);
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
        return ok(CATEGORIES);
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
      case "accounts:setCardMode": {
        const a = args as Args<"accounts:setCardMode">;
        return setCardMode(a?.accountId, a?.mode);
      }
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
