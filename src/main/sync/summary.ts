// A data-free summary of a download for the try script: counts and date
// ranges only. Never descriptions, amounts or account numbers.

import { providerKind } from "@shared/providers";
import type { ScrapedAccount } from "@shared/types";

export function summarize(accounts: readonly ScrapedAccount[], blockedHosts: Record<string, number>): string[] {
  const lines = [`Accounts: ${accounts.length}`];
  accounts.forEach((acc, i) => {
    const kind = providerKind(acc.provider) === "bank" ? "bank account" : "card";
    const dates = acc.transactions.map((t) => t.date).sort();
    const pending = acc.transactions.filter((t) => t.status === "pending").length;
    const range = dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : "no dates";
    lines.push(`  ${kind} ${i + 1}: ${acc.transactions.length} rows, ${range}, ${pending} pending`);
  });
  const blocked = Object.entries(blockedHosts);
  lines.push(`Blocked hosts: ${blocked.length ? "" : "none"}`.trimEnd());
  for (const [host, count] of blocked) lines.push(`  ${host}  ${count}`);
  return lines;
}
