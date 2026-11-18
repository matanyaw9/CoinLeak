// The add and edit form for cash rows (spec 20) as plain data: what the
// fields hold, how a typed amount becomes agorot, and what is missing.
// Core checks everything again; this only keeps Save honest.

import { parseShekels, shekelText } from "@shared/money";
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


export function emptyForm(today: IsoDate): ManualForm {
  return { date: today, amount: "", direction: "out", description: "", categoryId: null, note: "" };
}

export function formOf(row: TransactionRow): ManualForm {
  return {
    date: row.date,
    amount: shekelText(row.amount),
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
  // A cash row moves some money: zero is not an amount here.
  if (amount === null || amount === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return null;
  if (description.length === 0 || description.length > DESCRIPTION_MAX || form.note.trim().length > NOTE_MAX) return null;
  return {
    date: form.date,
    amount: form.direction === "out" ? -amount : amount,
    description,
    categoryId: form.categoryId,
    note: form.note.trim() || null,
  };
}
