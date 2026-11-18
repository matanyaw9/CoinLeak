// Converting to and from agorot. Floats appear only at the scraper edge;
// amounts the user types are read digit by digit.

import type { Agorot } from "./types";

/** Scrapers report shekels as floats (e.g. -123.45). */
export function toAgorot(shekels: number): Agorot {
  if (!Number.isFinite(shekels)) throw new RangeError("amount is not a finite number");
  return Math.round(shekels * 100);
}

/**
 * Shekels as typed ("45", "12.5", "₪1,200.90") to agorot, without floats.
 * Null unless it is a plain amount, zero or more, with at most two decimals.
 * Callers decide whether zero is allowed.
 */
export function parseShekels(text: string): Agorot | null {
  const clean = text.replace(/[,\s₪]/g, "");
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(clean);
  if (!match) return null;
  const agorot = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(agorot) ? agorot : null;
}

/** Agorot as an amount to edit, without a sign: "45", "12.50", "0.07". */
export function shekelText(amount: Agorot): string {
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / 100);
  const rest = abs % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0")}`;
}

export function formatIls(amount: Agorot, opts: { sign?: boolean; decimals?: boolean } = {}): string {
  const fmt = new Intl.NumberFormat("en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: opts.decimals === false ? 0 : 2,
    maximumFractionDigits: opts.decimals === false ? 0 : 2,
    signDisplay: opts.sign ? "exceptZero" : "auto",
  });
  return fmt.format(amount / 100);
}
