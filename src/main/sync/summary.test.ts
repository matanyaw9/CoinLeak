// The try script's summary prints counts and dates, never bank data.

import { describe, expect, it } from "vitest";
import type { ScrapedAccount, ScrapedTransaction } from "@shared/types";
import { summarize } from "./summary";

function row(date: string, status: ScrapedTransaction["status"] = "completed"): ScrapedTransaction {
  return {
    date,
    processedDate: null,
    amount: -98765,
    originalAmount: null,
    originalCurrency: null,
    description: "SYNTH SECRET SHOP",
    memo: "SYNTH MEMO",
    status,
    installment: null,
    identifier: "55555",
  };
}

const accounts: ScrapedAccount[] = [
  {
    provider: "visaCal",
    accountNumber: "4321",
    balance: -12345,
    transactions: [row("2026-10-05"), row("2026-09-01", "pending"), row("2026-11-02")],
  },
  { provider: "visaCal", accountNumber: "8765", balance: null, transactions: [] },
];

describe("summarize", () => {
  it("prints counts, date range, pending and blocked hosts", () => {
    expect(summarize(accounts, { "www.googletagmanager.com": 3 })).toEqual([
      "Accounts: 2",
      "  card 1: 3 rows, 2026-09-01 to 2026-11-02, 1 pending",
      "  card 2: 0 rows, no dates, 0 pending",
      "Blocked hosts:",
      "  www.googletagmanager.com  3",
    ]);
    expect(summarize([], {})).toEqual(["Accounts: 0", "Blocked hosts: none"]);
  });

  it("never prints descriptions, memos, amounts, identifiers or account numbers", () => {
    const text = summarize(accounts, {}).join("\n");
    for (const secret of ["SYNTH", "98765", "987.65", "55555", "4321", "8765", "12345"]) {
      expect(text).not.toContain(secret);
    }
  });
});
