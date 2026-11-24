// Recognizes bank lines that pay a credit card, reads which card, and knows
// which card company each card provider is. Card-bill patterns ported from
// Spent (github.com/Shaya16/Spent), src/server/lib/transfers.ts.

import type { ProviderId } from "@shared/types";

export type CardCompany = "cal" | "isracard" | "max" | "amex";

// A Hebrew letter on either side means the match is inside another word.
// Without this guard, Spent's Cal pattern also matched names like "מיכאל".
const NOT_IN_WORD_BEFORE = "(?<![\\u0590-\\u05FF])";
const NOT_IN_WORD_AFTER = "(?![\\u0590-\\u05FF])";
// One Hebrew prefix letter may stick to the name, e.g. "לכאל" (to Cal).
const CAL_HEBREW = new RegExp(
  `${NOT_IN_WORD_BEFORE}[ולמבהש]?כ[\\s.\\-־]?א[\\s.\\-־]?ל${NOT_IN_WORD_AFTER}`,
);
// "Amex" in Hebrew, as a word of its own (with one prefix letter at most).
const AMEX_HEBREW = new RegExp(`${NOT_IN_WORD_BEFORE}[ולמבהש]?אמקס${NOT_IN_WORD_AFTER}`);

const COMPANY_PATTERNS: Record<CardCompany, readonly RegExp[]> = {
  cal: [CAL_HEBREW, /דיינרס/, /\bCAL\b/i, /\bDINERS\b/i],
  isracard: [/ישראכרט/, /ישרא[\s־-]?כארד/, /\bISRACARD\b/i],
  // American Express in Israel is its own card provider (`amex`), run by Isracard.
  amex: [/אמריקן\s*אקספרס/, AMEX_HEBREW, /\bAMEX\b/i, /\bAMERICAN\s+EXPRESS\b/i],
  // Max charges appear on bank statements as "מקס איט פיננסים"; Max was Leumi Card.
  max: [/מקסימום/, /מקס\s*איט/, /לאומי\s*קארד/, /\bMAX\b/i, /\bLEUMI\s*CARD\b/i],
};

// Card networks and generic wording: a card bill, but no company named.
const GENERIC_PATTERNS: readonly RegExp[] = [
  /ויזה/,
  /מאסטרקארד/,
  /תשלום\s*אשראי/,
  /כרטיס\s*אשראי/,
  /חיוב\s*כרטיס/,
  /חיוב\s*לכרטיס/,
  /\bVISA\b/i,
  /\bMASTERCARD\b/i,
];

// Bank-side aggregate lines for card activity that has not settled yet, e.g.
// Discount's "חיוב זמני למפתח מזומן". They carry no card number.
const PENDING_AGGREGATE_PATTERNS: readonly RegExp[] = [/חיוב\s*זמני\s*למפתח/];

/** The card company behind each card provider whose bills a bank statement shows. */
const PROVIDER_COMPANY: Partial<Record<ProviderId, CardCompany>> = {
  visaCal: "cal",
  max: "max",
  isracard: "isracard",
  amex: "amex",
};

export interface CardLine {
  /** Last 4 digits of every run of 4 or more digits in the line. */
  numbers: string[];
  /** Card companies the line names. Empty when it names none. */
  companies: CardCompany[];
}

/** `null` when the line does not look like a card bill at all. */
export function readCardLine(description: string): CardLine | null {
  const text = description.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const companies = (Object.keys(COMPANY_PATTERNS) as CardCompany[]).filter((c) =>
    COMPANY_PATTERNS[c].some((p) => p.test(text)),
  );
  const generic = [...GENERIC_PATTERNS, ...PENDING_AGGREGATE_PATTERNS].some((p) => p.test(text));
  if (companies.length === 0 && !generic) return null;
  const numbers = (text.match(/\d{4,}/g) ?? []).map((run) => run.slice(-4));
  return { numbers, companies };
}

// Exactly 4 digits on their own (spec 32): not inside a longer number like
// 98761234, a date like 12/2025 or 2025-12-01, an amount like 1234.50, or a time.
const STANDALONE_4 = /(?<!\d)(?<!\d[/.,:-])\d{4}(?!\d)(?![/.,:-]\d)/g;

/** Every standalone run of exactly 4 digits in the line, for matching a synced card's last 4. */
export function standaloneNumbers(description: string): string[] {
  return description.match(STANDALONE_4) ?? [];
}

export function last4(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export function companyOf(provider: ProviderId): CardCompany | null {
  return PROVIDER_COMPANY[provider] ?? null;
}
