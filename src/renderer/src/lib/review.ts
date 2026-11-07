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

/**
 * What Undo sends to put a row back. A flagged row was CoinLeak's call, so
 * it goes back to automatic. An internal row goes back to internal: the
 * window cannot tell a matched bill from one the user marked, and marking
 * it again restores what was on screen either way.
 */
export function undoInternal(row: TransactionRow): InternalChoice {
  return row.flow === "internal" ? true : null;
}

/** Sends the user's answer about a card bill and returns the matching Undo. */
export async function answerCardBill(row: TransactionRow, internal: InternalChoice): Promise<() => Promise<unknown>> {
  const before = undoInternal(row);
  const ids = [row.id];
  await call("transactions:setInternal", { ids, internal });
  return () => call("transactions:setInternal", { ids, internal: before });
}

export function deleteGone(ids: number[]): Promise<{ deleted: number }> {
  return call("transactions:deleteGone", { ids });
}

/** Switches a card's mode and returns the matching Undo. */
export async function switchCardMode(accountId: number, from: CardMode, to: CardMode): Promise<() => Promise<unknown>> {
  await call("accounts:setCardMode", { accountId, mode: to });
  return () => call("accounts:setCardMode", { accountId, mode: from });
}
