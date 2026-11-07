// A data-free summary of a download for the try script: counts and date
// ranges only. Never descriptions, amounts or account numbers.

import type { ProviderId, ScrapedAccount } from "@shared/types";

const KIND: Record<ProviderId, string> = { discount: "bank account", visaCal: "card" };

export function summarize(accounts: readonly ScrapedAccount[], blockedHosts: Record<string, number>): string[] {
  const lines = [`Accounts: ${accounts.length}`];
  accounts.forEach((acc, i) => {
    const dates = acc.transactions.map((t) => t.date).sort();
    const pending = acc.transactions.filter((t) => t.status === "pending").length;
    const range = dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : "no dates";
    lines.push(`  ${KIND[acc.provider]} ${i + 1}: ${acc.transactions.length} rows, ${range}, ${pending} pending`);
  });
  const blocked = Object.entries(blockedHosts);
  lines.push(`Blocked hosts: ${blocked.length ? "" : "none"}`.trimEnd());
  for (const [host, count] of blocked) lines.push(`  ${host}  ${count}`);
  return lines;
}
