// Content hash that identifies a downloaded row (REQUIREMENTS section 5).
// Bank reference numbers are not stable, so identity is the row's content;
// identical rows in one download are told apart by a sequence number.
// Hash fields follow Spent (github.com/Shaya16/Spent), src/server/lib/dedup.ts.

import { createHash } from "node:crypto";
import type { ProviderId, ScrapedTransaction } from "@shared/types";

export function dedupHash(
  provider: ProviderId,
  accountNumber: string,
  t: Pick<ScrapedTransaction, "date" | "amount" | "description" | "installment"> &
    Partial<Pick<ScrapedTransaction, "originalAmount" | "originalCurrency">>,
): string {
  const parts = [
    `${provider}/${accountNumber}`,
    t.date,
    String(t.amount),
    normalizeDescription(t.description),
    t.installment ? `${t.installment.number}/${t.installment.total}` : "",
  ];
  // A pending foreign row has amount 0 until it settles; its original amount
  // is what tells two same-day purchases at one shop apart.
  if (t.amount === 0 && t.originalCurrency && t.originalAmount != null) {
    parts.push(`${t.originalCurrency}:${t.originalAmount}`);
  }
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

/** Bank text with runs of whitespace collapsed, for comparing descriptions. */
export function normalizeDescription(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Gives the n-th copy of a hash within one download the sequence n. */
export class SequenceCounter {
  private readonly seen = new Map<string, number>();

  next(key: string): number {
    const seq = this.seen.get(key) ?? 0;
    this.seen.set(key, seq + 1);
    return seq;
  }
}
