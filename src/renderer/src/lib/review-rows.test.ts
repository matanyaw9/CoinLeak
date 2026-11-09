// Row menu calls and their Undo, the rule offer once per merchant, and the
// rule chip.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Category, TransactionRow } from "@shared/types";
import {
  allIgnored,
  menuTargets,
  resetOffers,
  restoreRows,
  ruleChipId,
  setIgnored,
  shouldOfferRule,
  suggestFor,
  trashRows,
} from "./review-rows";

const row = (patch: Partial<TransactionRow>): TransactionRow => ({
  id: 7,
  accountId: 1,
  date: "2026-11-04",
  processedDate: "2026-11-04",
  amount: -4500,
  originalAmount: null,
  originalCurrency: null,
  description: "שופרסל דיל",
  memo: null,
  status: "completed",
  installment: null,
  categoryId: null,
  categorySource: null,
  note: null,
  excluded: false,
  flow: "spending",
  flags: [],
  ruleId: null,
  ...patch,
});

const groceries: Category = { id: 11, parentId: 1, name: "Groceries", kind: "expense", emoji: null, color: null, archived: false };

let invoke: ReturnType<typeof vi.fn>;
beforeEach(() => {
  invoke = vi.fn().mockResolvedValue({ ok: true, value: { updated: 2 } });
  vi.stubGlobal("window", { coinleak: { invoke, on: vi.fn() } });
  resetOffers();
});
afterEach(() => vi.unstubAllGlobals());

describe("menu targets", () => {
  const rows = [row({ id: 1 }), row({ id: 2 }), row({ id: 3 })];

  it("acts on the whole selection when the clicked row is in it", () => {
    expect(menuTargets(rows[0] as TransactionRow, new Set([1, 3]), rows).map((r) => r.id)).toEqual([1, 3]);
  });

  it("acts on the clicked row alone otherwise", () => {
    expect(menuTargets(rows[1] as TransactionRow, new Set([1, 3]), rows).map((r) => r.id)).toEqual([2]);
  });

  it("offers Count again only when every target is ignored", () => {
    expect(allIgnored([row({ excluded: true }), row({ excluded: true })])).toBe(true);
    expect(allIgnored([row({ excluded: true }), row({})])).toBe(false);
  });
});

describe("calls with Undo", () => {
  it("trash, and Undo restores", async () => {
    const { undo } = await trashRows([1, 2]);
    expect(invoke).toHaveBeenLastCalledWith("transactions:trash", { ids: [1, 2] });
    await undo();
    expect(invoke).toHaveBeenLastCalledWith("transactions:restore", { ids: [1, 2] });
  });

  it("restore, and Undo trashes again", async () => {
    const { undo } = await restoreRows([4]);
    expect(invoke).toHaveBeenLastCalledWith("transactions:restore", { ids: [4] });
    await undo();
    expect(invoke).toHaveBeenLastCalledWith("transactions:trash", { ids: [4] });
  });

  it("ignore touches only rows that change, and Undo flips only those back", async () => {
    const { undo } = await setIgnored([row({ id: 1 }), row({ id: 2, excluded: true })], true);
    expect(invoke).toHaveBeenLastCalledWith("transactions:update", { ids: [1], patch: { excluded: true } });
    await undo();
    expect(invoke).toHaveBeenLastCalledWith("transactions:update", { ids: [1], patch: { excluded: false } });
  });

  it("Undo of Ignore puts back each row's exclusion and who set it, in one call (spec 25)", async () => {
    const before = [
      { id: 1, excluded: false, excludedSource: null },
      { id: 3, excluded: false, excludedSource: "user" },
      { id: 4, excluded: false, excludedSource: "rule" },
    ];
    invoke.mockResolvedValueOnce({ ok: true, value: { updated: 3, before } });
    const { undo } = await setIgnored([row({ id: 1 }), row({ id: 3 }), row({ id: 4 })], true);
    invoke.mockClear();
    await undo();
    expect(invoke.mock.calls).toEqual([["transactions:restoreExclusions", { states: before }]]);
  });

  it("suggests a rule that sets the chosen category", async () => {
    invoke.mockResolvedValueOnce({ ok: true, value: { name: "שופרסל", setCategoryId: null } });
    expect(await suggestFor([7], groceries)).toMatchObject({ name: "שופרסל", setCategoryId: 11 });
    expect(invoke).toHaveBeenLastCalledWith("rules:suggest", { ids: [7] });
  });
});

describe("rule offer after a hand categorization", () => {
  it("asks once per merchant per session, ignoring case and spaces", () => {
    expect(shouldOfferRule(row({}), groceries)).toBe(true);
    expect(shouldOfferRule(row({ id: 8, description: "  שופרסל   דיל " }), groceries)).toBe(false);
    expect(shouldOfferRule(row({ id: 9, description: "רמי לוי" }), groceries)).toBe(true);
  });

  it("does not ask for a row a rule sorted, a cleared category, or no change", () => {
    expect(shouldOfferRule(row({ categorySource: "rule", categoryId: 13 }), groceries)).toBe(false);
    expect(shouldOfferRule(row({}), null)).toBe(false);
    expect(shouldOfferRule(row({ categoryId: 11, categorySource: "user" }), groceries)).toBe(false);
    expect(shouldOfferRule(row({}), groceries)).toBe(true);
  });
});

describe("rule chip", () => {
  it("shows for a rule's category or exclusion only", () => {
    expect(ruleChipId(row({ ruleId: 3, categorySource: "rule" }))).toBe(3);
    expect(ruleChipId(row({ ruleId: 3, excluded: true }))).toBe(3);
    expect(ruleChipId(row({ ruleId: 3, categorySource: "user" }))).toBeNull();
    expect(ruleChipId(row({ categorySource: "rule" }))).toBeNull();
  });
});
