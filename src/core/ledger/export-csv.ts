// Transactions as a CSV file for Excel (spec 39): every row that counts or is
// ignored (not trashed, not gone), newest first. UTF-8 with a BOM, CRLF and
// RFC 4180 quoting; text that Excel could run as a formula gets a leading '.

import { isProviderId, providerInfo } from "@shared/providers";
import type { Agorot } from "@shared/types";
import type { Db } from "../db";
import { LEDGER_SQL } from "./flow";

const BOM = "\uFEFF";
const CRLF = "\r\n";
const HEADER = [
  "Date",
  "Charged on",
  "Account",
  "Description",
  "Amount",
  "Category",
  "Note",
  "Status",
  "Ignored",
  "Card bill",
  "Paid back",
];

interface Row {
  date: string;
  processed_date: string | null;
  account_id: number;
  description: string;
  amount: Agorot;
  category_id: number | null;
  note: string | null;
  status: string;
  excluded: number;
  internal: number;
  paid_back_for: number | null;
}

export function exportTransactionsCsv(db: Db): { text: string; rows: number } {
  const accounts = accountLabels(db);
  const categories = categoryPaths(db);
  const rows = db
    .prepare(
      `WITH ledger AS (${LEDGER_SQL})
       SELECT date, processed_date, account_id, description, amount, category_id, note, status,
         excluded, internal, paid_back_for
       FROM ledger WHERE flow NOT IN ('trashed', 'gone')
       ORDER BY date DESC, id DESC`,
    )
    .all() as unknown as Row[];
  const lines = rows.map((r) => [
    r.date,
    r.processed_date ?? "",
    safeText(accounts.get(r.account_id) ?? ""),
    safeText(r.description),
    shekels(r.amount),
    safeText(r.category_id === null ? "" : (categories.get(r.category_id) ?? "")),
    safeText(r.note ?? ""),
    r.status,
    r.excluded === 1 ? "yes" : "",
    r.internal === 1 ? "yes" : "",
    r.paid_back_for !== null ? "yes" : "",
  ]);
  const text = [HEADER, ...lines].map((fields) => fields.map(quote).join(",")).join(CRLF);
  return { text: `${BOM}${text}${CRLF}`, rows: rows.length };
}

/** "-45.90": shekels with two decimals and a dot, no ₪, no thousands separator. */
export function shekels(amount: Agorot): string {
  const abs = Math.abs(amount);
  return `${amount < 0 ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Text starting with = + - @, a tab or a carriage return would run as a formula in Excel. */
export function safeText(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** RFC 4180: a field holding a quote, comma or line break goes in quotes, its quotes doubled. */
export function quote(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** "Everyday card ··4821" as the app shows it; the cash wallet is "Cash wallet". */
function accountLabels(db: Db): Map<number, string> {
  const rows = db.prepare("SELECT id, provider, kind, account_number, name FROM accounts").all() as {
    id: number;
    provider: string;
    kind: string;
    account_number: string;
    name: string | null;
  }[];
  return new Map(
    rows.map((a) => {
      if (a.kind === "cash") return [a.id, a.name ?? "Cash wallet"];
      const name = a.name ?? (isProviderId(a.provider) ? providerInfo(a.provider).short : a.provider);
      return [a.id, `${name} ··${a.account_number.slice(-4)}`];
    }),
  );
}

/** "Groceries › Weekly shop": each category's full path, top level first. */
function categoryPaths(db: Db): Map<number, string> {
  const rows = db.prepare("SELECT id, parent_id, name FROM categories").all() as {
    id: number;
    parent_id: number | null;
    name: string;
  }[];
  const byId = new Map(rows.map((c) => [c.id, c]));
  const pathOf = (id: number): string => {
    const names: string[] = [];
    let c = byId.get(id);
    // Three levels at most (spec 34); the limit also stops a loop in broken data.
    while (c && names.length < 3) {
      names.unshift(c.name);
      c = c.parent_id === null ? undefined : byId.get(c.parent_id);
    }
    return names.join(" › ");
  };
  return new Map(rows.map((c) => [c.id, pathOf(c.id)]));
}
