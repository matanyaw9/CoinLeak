// Synthetic, library-shaped input. No real data.

import type { Transaction, TransactionsAccount } from "israeli-bank-scrapers/lib/transactions.js";
import { describe, expect, it } from "vitest";
import { israelDay, normalizeAccounts } from "./normalize";

function txn(overrides: Partial<Transaction> = {}): Transaction {
  return {
    type: "normal" as Transaction["type"],
    identifier: 1001,
    date: "2026-03-09T22:00:00.000Z",
    processedDate: "2026-03-09T22:00:00.000Z",
    originalAmount: -50,
    originalCurrency: "ILS",
    chargedAmount: -50,
    description: "SYNTH GROCERY",
    status: "completed" as Transaction["status"],
    ...overrides,
  };
}

function account(txns: Transaction[], overrides: Partial<TransactionsAccount> = {}): TransactionsAccount {
  return { accountNumber: "12-345-678901", balance: 1234.56, txns, ...overrides };
}

function one(t: Transaction, provider: "discount" | "visaCal" = "discount") {
  const [acc] = normalizeAccounts(provider, [account([t], provider === "visaCal" ? { accountNumber: "4580123412349876" } : {})]);
  const [row] = acc?.transactions ?? [];
  if (!row) throw new Error("no row");
  return row;
}

describe("israelDay", () => {
  it.each([
    // Israel winter time (UTC+2): 22:00Z is already the next day.
    ["2026-01-31T22:00:00.000Z", "2026-02-01"],
    ["2026-01-31T21:59:59.000Z", "2026-01-31"],
    // Israel summer time (UTC+3), the night the month changes.
    ["2026-03-31T21:30:00.000Z", "2026-04-01"],
    ["2026-06-30T20:59:00.000Z", "2026-06-30"],
    ["2026-06-30T21:00:00.000Z", "2026-07-01"],
    ["2026-11-07", "2026-11-07"],
  ])("%s is %s in Israel", (iso, day) => {
    expect(israelDay(iso)).toBe(day);
  });

  it.each([["not a date"], [""], [undefined], [12345]])("rejects %s with BANK_CHANGED", (value) => {
    expect(() => israelDay(value)).toThrow(expect.objectContaining({ code: "BANK_CHANGED" }));
  });
});

describe("normalizeAccounts", () => {
  it("converts a plain bank row to agorot and Israel days", () => {
    const [acc] = normalizeAccounts("discount", [account([txn()])]);
    expect(acc).toEqual({
      provider: "discount",
      accountNumber: "12-345-678901",
      balance: 123456,
      transactions: [
        {
          date: "2026-03-10",
          processedDate: "2026-03-10",
          amount: -5000,
          originalAmount: null,
          originalCurrency: null,
          description: "SYNTH GROCERY",
          memo: null,
          status: "completed",
          installment: null,
          identifier: "1001",
        },
      ],
    });
  });

  it("keeps pending rows pending", () => {
    expect(one(txn({ status: "pending" as Transaction["status"], identifier: undefined }))).toMatchObject({
      status: "pending",
      identifier: null,
    });
  });

  it("takes a pending shekel refund's direction from its original amount", () => {
    const refund = txn({ status: "pending" as Transaction["status"], chargedAmount: -40, originalAmount: 40 });
    expect(one(refund, "visaCal")).toMatchObject({ amount: 4000, originalAmount: null, originalCurrency: null });
    const charge = txn({ status: "pending" as Transaction["status"], chargedAmount: -40, originalAmount: -40 });
    expect(one(charge, "visaCal")).toMatchObject({ amount: -4000 });
  });

  it("keeps the original amount and currency for a foreign purchase", () => {
    const row = one(txn({ originalAmount: -19.99, originalCurrency: "USD", chargedAmount: -74.37 }), "visaCal");
    expect(row).toMatchObject({ amount: -7437, originalAmount: -1999, originalCurrency: "USD" });
  });

  describe("a foreign row still pending", () => {
    const pendingTxn = (overrides: Partial<Transaction>) =>
      txn({ status: "pending" as Transaction["status"], identifier: undefined, ...overrides });

    it("a pending USD row becomes amount 0 with original amount and currency (Cal's shape)", () => {
      // visa-cal.js L183-184: both fields hold the purchase-currency amount.
      const row = one(pendingTxn({ chargedAmount: -50, originalAmount: -50, originalCurrency: "USD" }), "visaCal");
      expect(row).toMatchObject({ status: "pending", amount: 0, originalAmount: -5000, originalCurrency: "USD" });
    });

    it("ignores a shekel estimate or a missing charged amount", () => {
      const estimate = one(pendingTxn({ chargedAmount: -185.5, originalAmount: -50, originalCurrency: "$" }));
      expect(estimate).toMatchObject({ amount: 0, originalAmount: -5000, originalCurrency: "USD" });
      const noCharge = { chargedAmount: undefined as unknown as number };
      const missing = one(pendingTxn({ ...noCharge, originalAmount: -12.4, originalCurrency: "€" }));
      expect(missing).toMatchObject({ amount: 0, originalAmount: -1240, originalCurrency: "EUR" });
    });

    it("keeps the sign of the original amount, so a pending refund stays money in", () => {
      // Cal makes chargedAmount negative even for a credit; originalAmount carries the sign.
      const row = one(pendingTxn({ chargedAmount: -20, originalAmount: 20, originalCurrency: "USD" }), "visaCal");
      expect(row).toMatchObject({ amount: 0, originalAmount: 2000, originalCurrency: "USD" });
    });

    it("a completed USD row keeps its charged ILS amount", () => {
      const row = one(txn({ chargedAmount: -185.5, originalAmount: -50, originalCurrency: "USD" }), "visaCal");
      expect(row).toMatchObject({ status: "completed", amount: -18550, originalAmount: -5000, originalCurrency: "USD" });
    });

    it("a pending ILS row is unchanged", () => {
      for (const originalCurrency of ["ILS", "₪", 'ש"ח', ""]) {
        expect(one(pendingTxn({ chargedAmount: -42.9, originalAmount: -42.9, originalCurrency }))).toMatchObject({
          status: "pending",
          amount: -4290,
          originalAmount: null,
          originalCurrency: null,
        });
      }
    });

    it("stops with BANK_CHANGED when the original amount is missing", () => {
      expect(() =>
        normalizeAccounts("visaCal", [
          account([pendingTxn({ originalAmount: Number.NaN, originalCurrency: "USD" })], { accountNumber: "9876" }),
        ]),
      ).toThrow(expect.objectContaining({ code: "BANK_CHANGED" }));
    });
  });

  it("maps currency symbols and spellings of the shekel to ILS", () => {
    expect(one(txn({ originalCurrency: "₪" }))).toMatchObject({ originalAmount: null, originalCurrency: null });
    expect(one(txn({ originalCurrency: " nis " }))).toMatchObject({ originalAmount: null, originalCurrency: null });
    expect(one(txn({ originalCurrency: 'ש"ח' }))).toMatchObject({ originalAmount: null, originalCurrency: null });
    expect(one(txn({ originalCurrency: "$", originalAmount: -10, chargedAmount: -37 }))).toMatchObject({
      originalCurrency: "USD",
    });
  });

  it("keeps installment n of m and the full purchase amount", () => {
    const row = one(
      txn({
        type: "installments" as Transaction["type"],
        installments: { number: 2, total: 3 },
        originalAmount: -300,
        chargedAmount: -100,
      }),
      "visaCal",
    );
    expect(row).toMatchObject({
      installment: { number: 2, total: 3 },
      amount: -10000,
      originalAmount: -30000,
      originalCurrency: "ILS",
    });
  });

  it("treats a 1 of 1 plan as a plain purchase", () => {
    expect(one(txn({ installments: { number: 1, total: 1 } })).installment).toBeNull();
  });

  it("keeps refunds as money in", () => {
    expect(one(txn({ chargedAmount: 89.9, originalAmount: 89.9 }), "visaCal")).toMatchObject({
      amount: 8990,
      originalAmount: null,
    });
  });

  it("rounds float noise to whole agorot", () => {
    expect(one(txn({ chargedAmount: -0.1 - 0.2, originalAmount: -0.3 })).amount).toBe(-30);
  });

  it("trims text, keeps a memo, and drops an empty memo", () => {
    expect(one(txn({ description: "  SYNTH  CAFE ", memo: " table 4 " }))).toMatchObject({
      description: "SYNTH  CAFE",
      memo: "table 4",
    });
    expect(one(txn({ memo: "" })).memo).toBeNull();
  });

  it("allows a missing processed date", () => {
    expect(one(txn({ processedDate: "" })).processedDate).toBeNull();
  });

  it("uses the last 4 digits as the card account number", () => {
    const [acc] = normalizeAccounts("visaCal", [account([], { accountNumber: "4580-1234-1234-9876" })]);
    expect(acc?.accountNumber).toBe("9876");
    const [short] = normalizeAccounts("visaCal", [account([], { accountNumber: "1234" })]);
    expect(short?.accountNumber).toBe("1234");
  });

  it("leaves a missing balance as null", () => {
    const [acc] = normalizeAccounts("visaCal", [account([], { accountNumber: "9876", balance: undefined })]);
    expect(acc?.balance).toBeNull();
  });

  it.each([
    ["an amount that is not a number", { chargedAmount: Number.NaN }],
    ["a missing amount", { chargedAmount: undefined as unknown as number }],
    ["a broken date", { date: "31/12/2026" }],
  ])("stops with BANK_CHANGED on %s instead of dropping the row", (_label, overrides) => {
    expect(() => normalizeAccounts("discount", [account([txn(overrides)])])).toThrow(
      expect.objectContaining({ code: "BANK_CHANGED" }),
    );
  });

  it("stops with BANK_CHANGED when a card number has no digits or rows are missing", () => {
    expect(() => normalizeAccounts("visaCal", [account([], { accountNumber: "card" })])).toThrow(
      expect.objectContaining({ code: "BANK_CHANGED" }),
    );
    expect(() =>
      normalizeAccounts("discount", [{ accountNumber: "1", txns: undefined } as unknown as TransactionsAccount]),
    ).toThrow(expect.objectContaining({ code: "BANK_CHANGED" }));
  });
});
