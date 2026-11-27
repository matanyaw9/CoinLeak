// The review actions a row offers (card bills and gone rows) and the calls
// they make. No React here, so the wiring is easy to test on its own.

import type { CardMode, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { call } from "./api";

/** The user's word on a card bill: true internal, false spending, null automatic. */
export type InternalChoice = boolean | null;

export interface CardBillAction {
  internal: InternalChoice;
  label: string;
  hint?: string;
}

export const isGone = (row: TransactionRow): boolean => row.status === "gone" || row.flow === "gone";

export const isPossibleCardBill = (row: TransactionRow): boolean => row.flags.includes("possible_card_bill");

/** The two answers a row offers about being a card bill, or none. */
export function cardBillActions(row: TransactionRow): CardBillAction[] {
  if (isPossibleCardBill(row)) {
    return [
      { internal: true, label: s.review.tracked },
      { internal: false, label: s.review.spending },
    ];
  }
  if (row.flow === "internal") {
    return [
      { internal: false, label: s.review.countIt, hint: s.review.countItHint },
      { internal: null, label: s.review.letDecide, hint: s.review.letDecideHint },
    ];
  }
  return [];
}

/** Sends the user's answer about a card bill. Undo puts the row back exactly as it was (spec 44 A). */
export async function answerCardBill(row: TransactionRow, internal: InternalChoice): Promise<() => Promise<unknown>> {
  const ids = [row.id];
  const { before } = await call("transactions:setInternal", { ids, internal });
  return () => call("transactions:restoreInternal", { states: before });
}

export function deleteGone(ids: number[]): Promise<{ deleted: number }> {
  return call("transactions:deleteGone", { ids });
}

/** Switches a card's mode and returns the matching Undo. */
export async function switchCardMode(accountId: number, from: CardMode, to: CardMode): Promise<() => Promise<unknown>> {
  await call("accounts:setCardMode", { accountId, mode: to });
  return () => call("accounts:setCardMode", { accountId, mode: from });
}
