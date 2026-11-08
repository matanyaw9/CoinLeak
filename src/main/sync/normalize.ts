// Library accounts to ScrapedAccount[]: integer agorot, Israel-local days,
// string identifiers, and no shekel amount for a foreign row still pending.
// A malformed row stops the sync with BANK_CHANGED instead of being dropped.

import type { Transaction, TransactionsAccount } from "israeli-bank-scrapers/lib/transactions.js";
import { CodedError } from "@shared/errors";
import { toAgorot } from "@shared/money";
import { providerKind } from "@shared/providers";
import type { Agorot, IsoDate, ProviderId, ScrapedAccount, ScrapedStatus, ScrapedTransaction } from "@shared/types";

const ISRAEL_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const CURRENCY_ALIASES: Readonly<Record<string, string>> = {
  "₪": "ILS",
  NIS: "ILS",
  ILS: "ILS",
  'ש"ח': "ILS",
  "ש״ח": "ILS",
  $: "USD",
  "€": "EUR",
  "£": "GBP",
};

function changed(): never {
  throw new CodedError("BANK_CHANGED");
}

/** The calendar day in Israel for a library timestamp (the library reports UTC). */
export function israelDay(value: unknown): IsoDate {
  if (typeof value !== "string" || value === "") return changed();
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return changed();
  const parts = Object.fromEntries(ISRAEL_DAY.formatToParts(time).map((p) => [p.type, p.value]));
  return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
}

function agorot(value: unknown): Agorot {
  if (typeof value !== "number" || !Number.isFinite(value)) return changed();
  return toAgorot(value);
}

function optionalAgorot(value: unknown): Agorot | null {
  return typeof value === "number" && Number.isFinite(value) ? toAgorot(value) : null;
}

function currency(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const code = value.trim().toUpperCase();
  return CURRENCY_ALIASES[code] ?? code;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function installment(txn: Transaction): ScrapedTransaction["installment"] {
  const i = txn.installments;
  if (!i || !Number.isInteger(i.number) || !Number.isInteger(i.total)) return null;
  // A "1 of 1" plan is a plain purchase.
  if (i.total < 2 || i.number < 1) return null;
  return { number: i.number, total: i.total };
}

/**
 * The shekel amount and the original one. A foreign row that is still pending
 * has no shekel amount yet. Cal puts the purchase-currency amount in both
 * `chargedAmount` and `originalAmount` (visa-cal.js L183-184), so $50 would
 * count as 50 ILS; another bank may send a shekel estimate or nothing. Either
 * way the row gets amount 0 and keeps the original amount until it settles.
 */
function amounts(
  txn: Transaction,
  status: ScrapedStatus,
): Pick<ScrapedTransaction, "amount" | "originalAmount" | "originalCurrency"> {
  const origCurrency = currency(txn.originalCurrency) ?? "ILS";
  const origAmount = optionalAgorot(txn.originalAmount);
  if (status === "pending" && origCurrency !== "ILS") {
    // Without the original amount the row would say nothing at all.
    return { amount: 0, originalAmount: origAmount ?? changed(), originalCurrency: origCurrency };
  }
  let amount = agorot(txn.chargedAmount);
  // Cal signs every pending charged amount as money out (visa-cal.js L183),
  // even a refund; the original amount carries the real direction.
  if (status === "pending" && origAmount !== null && origAmount === -amount && origAmount !== 0) {
    amount = origAmount;
  }
  // Keep the original only when it says something the charged amount does not.
  const differs = origAmount !== null && (origCurrency !== "ILS" || origAmount !== amount);
  return { amount, originalAmount: differs ? origAmount : null, originalCurrency: differs ? origCurrency : null };
}

function transaction(txn: Transaction): ScrapedTransaction {
  const status: ScrapedStatus = txn.status === "pending" ? "pending" : "completed";
  return {
    date: israelDay(txn.date),
    processedDate: txn.processedDate ? israelDay(txn.processedDate) : null,
    ...amounts(txn, status),
    description: typeof txn.description === "string" ? txn.description.trim() : "",
    memo: text(txn.memo),
    status,
    installment: installment(txn),
    identifier: txn.identifier === undefined || txn.identifier === null ? null : String(txn.identifier),
  };
}

function accountNumber(provider: ProviderId, raw: unknown): string {
  const value = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (value === "") return changed();
  if (providerKind(provider) !== "card") return value;
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : changed();
}

export function normalizeAccounts(provider: ProviderId, accounts: readonly TransactionsAccount[]): ScrapedAccount[] {
  return accounts.map((acc) => ({
    provider,
    accountNumber: accountNumber(provider, acc.accountNumber),
    balance: typeof acc.balance === "number" && Number.isFinite(acc.balance) ? toAgorot(acc.balance) : null,
    transactions: (Array.isArray(acc.txns) ? acc.txns : changed()).map(transaction),
  }));
}
