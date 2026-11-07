// Library accounts to ScrapedAccount[]: integer agorot, Israel-local days,
// string identifiers. A malformed row stops the sync with BANK_CHANGED
// instead of being dropped, so no spending silently disappears.

import type { Transaction, TransactionsAccount } from "israeli-bank-scrapers/lib/transactions.js";
import { CodedError } from "@shared/errors";
import { toAgorot } from "@shared/money";
import type { Agorot, IsoDate, ProviderId, ScrapedAccount, ScrapedTransaction } from "@shared/types";

const CARD_PROVIDERS: ReadonlySet<ProviderId> = new Set(["visaCal"]);

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

function transaction(txn: Transaction): ScrapedTransaction {
  const amount = agorot(txn.chargedAmount);
  const origCurrency = currency(txn.originalCurrency) ?? "ILS";
  const origAmount =
    typeof txn.originalAmount === "number" && Number.isFinite(txn.originalAmount)
      ? toAgorot(txn.originalAmount)
      : null;
  // Keep the original only when it says something the charged amount does not.
  const differs = origAmount !== null && (origCurrency !== "ILS" || origAmount !== amount);
  return {
    date: israelDay(txn.date),
    processedDate: txn.processedDate ? israelDay(txn.processedDate) : null,
    amount,
    originalAmount: differs ? origAmount : null,
    originalCurrency: differs ? origCurrency : null,
    description: typeof txn.description === "string" ? txn.description.trim() : "",
    memo: text(txn.memo),
    status: txn.status === "pending" ? "pending" : "completed",
    installment: installment(txn),
    identifier: txn.identifier === undefined || txn.identifier === null ? null : String(txn.identifier),
  };
}

function accountNumber(provider: ProviderId, raw: unknown): string {
  const value = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (value === "") return changed();
  if (!CARD_PROVIDERS.has(provider)) return value;
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
