// Converting to and from agorot. Floats appear only at the scraper edge.

import type { Agorot } from "./types";

/** Scrapers report shekels as floats (e.g. -123.45). */
export function toAgorot(shekels: number): Agorot {
  if (!Number.isFinite(shekels)) throw new RangeError("amount is not a finite number");
  return Math.round(shekels * 100);
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
