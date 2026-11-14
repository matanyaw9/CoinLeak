// The Demo profile's made-up world: its money accounts, the shops its cards
// pay, and the rules a person might have after a few months. All invented;
// only ordinary chain names, no real person, account or statement.

import type { ScrapedAccount } from "@shared/types";

export type DemoAccount = "bank" | "joint" | "everyday" | "online" | "old";

export const ACCOUNTS: Record<DemoAccount, Omit<ScrapedAccount, "transactions">> = {
  bank: { provider: "discount", accountNumber: "0000-123456", balance: 2_345_600 },
  // A second bank account, quiet: interest and fees. Its balance check shows a gap (spec 24).
  joint: { provider: "discount", accountNumber: "0000-778899", balance: 812_340 },
  everyday: { provider: "visaCal", accountNumber: "4821", balance: null },
  online: { provider: "visaCal", accountNumber: "7390", balance: null },
  // A card the user stopped syncing: its rows stay, it shows under Removed.
  old: { provider: "isracard", accountNumber: "5512", balance: null },
};

/** One kind of everyday card purchase: how often a month, and for how much (shekels). */
export interface Spend {
  category: string;
  shops: string[];
  perMonth: [number, number];
  shekels: [number, number];
}

export const CARD_SPENDS: Spend[] = [
  { category: "Groceries", shops: ["שופרסל דיל", "רמי לוי שיווק השקמה", "יוחננוף", "ויקטורי", "AM:PM"], perMonth: [7, 9], shekels: [58, 640] },
  { category: "Coffee & Cafes", shops: ["קפה קפה", "ארומה אספרסו בר", "קופיקס", "לנדוור"], perMonth: [8, 12], shekels: [14, 52] },
  { category: "Restaurants", shops: ["WOLT", "תן ביס", "הבורגר הבא", "פיצה שמש"], perMonth: [4, 6], shekels: [62, 340] },
  { category: "Fuel", shops: ["פז אפליקציה", "דלק מוטורס", "סונול"], perMonth: [2, 3], shekels: [120, 360] },
  { category: "Parking", shops: ["פנגו", "אחוזות החוף"], perMonth: [1, 3], shekels: [12, 48] },
  { category: "Bars", shops: ["בירה בר", "הבר השכונתי"], perMonth: [0, 2], shekels: [48, 180] },
  { category: "Transport", shops: ["רב-קו אונליין", "מוביט"], perMonth: [1, 3], shekels: [30, 110] },
  { category: "Clothes & Shoes", shops: ["ZARA", "קסטרו", "H&M", "ACE"], perMonth: [1, 3], shekels: [79, 520] },
  { category: "Health", shops: ["סופר-פארם", "בי פארם"], perMonth: [1, 2], shekels: [24, 230] },
  { category: "Entertainment", shops: ["סינמה סיטי", "יס פלאנט"], perMonth: [0, 2], shekels: [62, 280] },
  { category: "Personal Care", shops: ["מספרת השכונה"], perMonth: [0, 1], shekels: [80, 180] },
  { category: "Pet Care", shops: ["חיות ושות"], perMonth: [0, 1], shekels: [55, 190] },
];

/** A rule written with names; the seeder turns names into ids. */
export interface DemoRule {
  name: string;
  category?: string;
  exclude?: boolean;
  enabled?: boolean;
  join?: "all" | "any";
  contains?: string[];
  startsWith?: string[];
  equals?: string[];
  regex?: string;
  account?: DemoAccount;
  direction?: "in" | "out";
}

// One list rule per kind of shop, plus a few with several conditions, an
// exclude rule, and one switched off.
export const RULES: DemoRule[] = [
  { name: "Salary", category: "Salary", equals: ["משכורת"], account: "bank", direction: "in" },
  { name: "Savings transfers", exclude: true, startsWith: ["העברה לחשבון חיסכון"] },
  { name: "Rent", category: "Rent", equals: ["שכר דירה"] },
  { name: "Bills", category: "Bills & Utilities", contains: ["פלאפון", "עיריית", "חברת החשמל", "מי אביבים"] },
  { name: "Streaming", category: "Subscriptions", regex: "netflix|spotify|apple\\.com" },
  { name: "Bank fees", category: "Fees & Taxes", startsWith: ["עמלת"] },
  { name: "Cash", category: "Cash & ATM", startsWith: ["משיכת מזומן"] },
  { name: "Home insurance", category: "Insurance", contains: ["הראל ביטוח"] },
  { name: "Savings deposit", category: "Savings", contains: ["פיקדון"] },
  { name: "Investing", category: "Investments", contains: ["מיטב טרייד"] },
  { name: "Side jobs", category: "Freelance & Side Income", startsWith: ["העברה מלקוח"] },
  { name: "Online shopping", category: "Online shopping", join: "any", contains: ["ALIEXPRESS", "AMAZON", "איקאה", "ETSY"] },
  ...CARD_SPENDS.map((s) => ({ name: s.category, category: s.category, contains: s.shops })),
  { name: "Fuel on the everyday card", category: "Fuel", startsWith: ["פז"], account: "everyday" },
  { name: "Bit transfers", category: "Gifts & Donations", startsWith: ["העברה ב-BIT"], direction: "out", enabled: false },
];
