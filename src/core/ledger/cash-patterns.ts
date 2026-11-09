// Recognizes bank lines that take cash out of an ATM (spec 20). With a cash
// wallet such a line is money moved into the wallet, not spending. The one
// list of patterns lives here, next to the card-bill patterns.

// A Hebrew letter on either side means the match is inside another word.
const NOT_IN_WORD_BEFORE = "(?<![\\u0590-\\u05FF])";
const NOT_IN_WORD_AFTER = "(?![\\u0590-\\u05FF])";

// The word "מזומן" (cash) alone is not enough: Discount's card aggregate
// "חיוב זמני למפתח מזומן" has it and is not a withdrawal. So each pattern
// names the act of withdrawing or the machine itself.
const CASH_WITHDRAWAL_PATTERNS: readonly RegExp[] = [
  // "משיכת מזומן", "משיכת מזומנים": cash withdrawal, most banks.
  /משיכת\s*מזומ[ןנ]/,
  // "משיכה מכספומט", "כספומט": the ATM, Hapoalim, Discount and others.
  /כספומט/,
  // "בנקט": Leumi's ATMs, as a word of its own ("משיכה מבנקט").
  new RegExp(`${NOT_IN_WORD_BEFORE}[ומבהלש]?בנקט${NOT_IN_WORD_AFTER}`),
  /\bATM\b/i,
  /\bCASH\s+WITHDRAWAL\b/i,
];

/** True for money out on a line that looks like an ATM cash withdrawal. */
export function isCashWithdrawal(description: string, amount: number): boolean {
  if (amount >= 0) return false;
  const text = description.replace(/\s+/g, " ").trim();
  return CASH_WITHDRAWAL_PATTERNS.some((p) => p.test(text));
}
