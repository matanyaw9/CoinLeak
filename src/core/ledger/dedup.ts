// Content hash that identifies a downloaded row (REQUIREMENTS section 5).
// Bank reference numbers are not stable, so identity is the row's content;
// identical rows in one download are told apart by a sequence number.
// Hash fields follow Spent (github.com/Shaya16/Spent), src/server/lib/dedup.ts.

import { createHash } from "node:crypto";
import type { ProviderId, ScrapedTransaction } from "@shared/types";

export function dedupHash(
  provider: ProviderId,
  accountNumber: string,
  t: Pick<ScrapedTransaction, "date" | "amount" | "description" | "installment">,
): string {
  const parts = [
    `${provider}/${accountNumber}`,
    t.date,
    String(t.amount),
    t.description.replace(/\s+/g, " ").trim(),
    t.installment ? `${t.installment.number}/${t.installment.total}` : "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
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
