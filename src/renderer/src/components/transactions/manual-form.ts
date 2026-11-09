// The add and edit form for cash rows (spec 20) as plain data: what the
// fields hold, how a typed amount becomes agorot, and what is missing.
// Core checks everything again; this only keeps Save honest.

import type { IsoDate, ManualTransactionInput, TransactionRow } from "@shared/types";

export type Direction = "out" | "in";

export interface ManualForm {
  date: IsoDate;
  /** As typed, in shekels: "45", "12.5", "1,200.90". */
  amount: string;
  direction: Direction;
  description: string;
  categoryId: number | null;
  note: string;
}

export const DESCRIPTION_MAX = 200;
export const NOTE_MAX = 500;

/** Shekels as typed to agorot, without floats. Null unless above zero with at most two decimals. */
export function parseShekels(text: string): number | null {
  const clean = text.replace(/[,\s₪]/g, "");
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(clean);
  if (!match) return null;
  const whole = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  const agorot = whole * 100 + cents;
  return Number.isSafeInteger(agorot) && agorot > 0 ? agorot : null;
}

/** Agorot back to what the amount field shows: "45", "12.50". */
export function shekelsText(agorot: number): string {
  const abs = Math.abs(agorot);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  return cents === 0 ? String(whole) : `${whole}.${String(cents).padStart(2, "0")}`;
}

export function emptyForm(today: IsoDate): ManualForm {
  return { date: today, amount: "", direction: "out", description: "", categoryId: null, note: "" };
}

export function formOf(row: TransactionRow): ManualForm {
  return {
    date: row.date,
    amount: shekelsText(row.amount),
    direction: row.amount > 0 ? "in" : "out",
    description: row.description,
    categoryId: row.categoryId,
    note: row.note ?? "",
  };
}

/** The input to send, or null while the form cannot be saved. */
export function inputOf(form: ManualForm): ManualTransactionInput | null {
  const amount = parseShekels(form.amount);
  const description = form.description.trim();
  if (amount === null || !/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return null;
  if (description.length === 0 || description.length > DESCRIPTION_MAX || form.note.trim().length > NOTE_MAX) return null;
  return {
    date: form.date,
    amount: form.direction === "out" ? -amount : amount,
    description,
    categoryId: form.categoryId,
    note: form.note.trim() || null,
  };
}
