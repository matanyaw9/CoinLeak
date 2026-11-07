// Review actions: each answer calls the right channel with the right
// arguments, and Undo sends the row back to where it was.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TransactionRow } from "@shared/types";
import { answerCardBill, cardBillActions, deleteGone, isGone, switchCardMode, undoInternal } from "./review";

const row = (patch: Partial<TransactionRow>): TransactionRow => ({
  id: 7,
  accountId: 1,
  date: "2026-11-04",
  processedDate: "2026-11-04",
  amount: -128460,
  originalAmount: null,
  originalCurrency: null,
  description: "card bill",
  memo: null,
  status: "completed",
  installment: null,
  categoryId: null,
  categorySource: null,
  note: null,
  excluded: false,
  flow: "spending",
  flags: [],
  ...patch,
});

const flagged = row({ flags: ["uncategorized", "possible_card_bill"] });
const internal = row({ id: 8, flow: "internal" });

let invoke: ReturnType<typeof vi.fn>;
beforeEach(() => {
  invoke = vi.fn().mockResolvedValue({ ok: true, value: { updated: 1, deleted: 1 } });
  vi.stubGlobal("window", { coinleak: { invoke, on: vi.fn() } });
});
afterEach(() => vi.unstubAllGlobals());

describe("card bill answers", () => {
  it("offers 'tracked' and 'spending' on a possible card bill", () => {
    expect(cardBillActions(flagged).map((a) => a.internal)).toEqual([true, false]);
  });

  it("offers 'count it' and 'let CoinLeak decide' on an internal row", () => {
    expect(cardBillActions(internal).map((a) => a.internal)).toEqual([false, null]);
  });

  it("offers nothing on an ordinary row", () => {
    expect(cardBillActions(row({}))).toEqual([]);
  });

  it.each([true, false])("sends setInternal %s for a flagged row, and Undo hands it back to CoinLeak", async (answer) => {
    const undo = await answerCardBill(flagged, answer);
    expect(invoke).toHaveBeenLastCalledWith("transactions:setInternal", { ids: [7], internal: answer });
    await undo();
    expect(invoke).toHaveBeenLastCalledWith("transactions:setInternal", { ids: [7], internal: null });
    expect(undoInternal(flagged)).toBeNull();
  });

  it.each([false, null])("sends setInternal %s for an internal row, and Undo marks it internal again", async (answer) => {
    const undo = await answerCardBill(internal, answer);
    expect(invoke).toHaveBeenLastCalledWith("transactions:setInternal", { ids: [8], internal: answer });
    await undo();
    expect(invoke).toHaveBeenLastCalledWith("transactions:setInternal", { ids: [8], internal: true });
  });

  it("throws the fixed error and offers no Undo when the app refuses", async () => {
    invoke.mockResolvedValueOnce({ ok: false, error: { code: "DATABASE", message: "Could not read or write your data file." } });
    await expect(answerCardBill(flagged, true)).rejects.toMatchObject({ code: "DATABASE" });
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe("gone rows and card mode", () => {
  it("recognizes a gone row by status or flow", () => {
    expect(isGone(row({ status: "gone" }))).toBe(true);
    expect(isGone(row({ flow: "gone" }))).toBe(true);
    expect(isGone(row({ status: "pending" }))).toBe(false);
  });

  it("deletes gone rows through deleteGone", async () => {
    await deleteGone([9]);
    expect(invoke).toHaveBeenCalledWith("transactions:deleteGone", { ids: [9] });
  });

  it("switches card mode, and Undo switches it back", async () => {
    const undo = await switchCardMode(2, "credit", "debit");
    expect(invoke).toHaveBeenLastCalledWith("accounts:setCardMode", { accountId: 2, mode: "debit" });
    await undo();
    expect(invoke).toHaveBeenLastCalledWith("accounts:setCardMode", { accountId: 2, mode: "credit" });
  });
});
