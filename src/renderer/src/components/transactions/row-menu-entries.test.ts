import { describe, expect, it, vi } from "vitest";
import type { Category, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { indexCategories } from "@/lib/categories";
import { rowMenu, type RowMenuActions } from "./row-menu-entries";

const groceries = { id: 2, parentId: null, name: "Groceries", kind: "expense", emoji: null, color: null, archived: false } as Category;
const index = indexCategories([groceries]);
const row = (id: number, more: Partial<TransactionRow> = {}) =>
  ({ id, description: " Shop ", amount: -1000, categoryId: null, note: null, source: "sync", excluded: false, ...more }) as TransactionRow;

function actions(): RowMenuActions {
  return {
    makeRule: vi.fn(),
    addKnownPlace: vi.fn(),
    openNote: vi.fn(),
    editCash: vi.fn(),
    openPaidBack: vi.fn(),
    setIgnored: vi.fn(),
    trash: vi.fn(),
    clearSelection: vi.fn(),
  };
}

const keys = (m: ReturnType<typeof rowMenu>) => m.entries.map((e) => e.key);
const entry = (m: ReturnType<typeof rowMenu>, key: string) => m.entries.find((e) => e.key === key);

describe("row menu entries", () => {
  it("one sorted synced row: rule, known place, note, ignore, trash", () => {
    const one = row(1, { categoryId: 2 });
    const act = actions();
    const menu = rowMenu(one, [one], index, act);
    expect(menu.heading).toBeUndefined();
    expect(keys(menu)).toEqual(["rule", "known", "note", "ignore", "trash"]);
    entry(menu, "known")?.onSelect();
    expect(act.addKnownPlace).toHaveBeenCalledWith(" Shop ", groceries);
    entry(menu, "ignore")?.onSelect();
    expect(act.setIgnored).toHaveBeenCalledWith([one], true, undefined);
  });

  it("a cash row can be edited", () => {
    const cash = row(1, { source: "manual" });
    const act = actions();
    const menu = rowMenu(cash, [cash], index, act);
    expect(keys(menu)).toEqual(["rule", "note", "edit", "ignore", "trash"]);
    entry(menu, "edit")?.onSelect();
    expect(act.editCash).toHaveBeenCalledWith(cash);
  });

  it("a selection: a heading, no single-row entries, and the selection clears after", () => {
    const targets = [row(1, { categoryId: 2 }), row(2)];
    const act = actions();
    const menu = rowMenu(targets[0] as TransactionRow, targets, index, act);
    expect(menu.heading).toBe(s.rowMenu.forSelection(2));
    expect(keys(menu)).toEqual(["rule", "ignore", "trash"]);
    entry(menu, "ignore")?.onSelect();
    expect(act.setIgnored).toHaveBeenCalledWith(targets, true, act.clearSelection);
    entry(menu, "trash")?.onSelect();
    expect(act.trash).toHaveBeenCalledWith(targets, act.clearSelection);
  });

  it("rows that are all ignored offer to count them again", () => {
    const ignored = row(1, { excluded: true });
    const act = actions();
    const menu = rowMenu(ignored, [ignored], index, act);
    expect(entry(menu, "ignore")?.label).toBe(s.rowMenu.countAgain);
    entry(menu, "ignore")?.onSelect();
    expect(act.setIgnored).toHaveBeenCalledWith([ignored], false, undefined);
  });
});

// Spec 33: money in can be marked as paid back for a purchase, and unmarked.
describe("paid back entries", () => {
  // Spec 36: the page opens the dialog, as it does the note box.
  it("money in offers it, and the page opens its dialog for that row", () => {
    const moneyIn = row(1, { amount: 5000, flow: "income", status: "completed" });
    const act = actions();
    const menu = rowMenu(moneyIn, [moneyIn], index, act);
    expect(keys(menu)).toEqual(["rule", "note", "paidBack", "ignore", "trash"]);
    const paidBack = entry(menu, "paidBack");
    expect(paidBack?.label).toBe(s.paidBack.menu);
    paidBack?.onSelect();
    expect(act.openPaidBack).toHaveBeenCalledWith(moneyIn);
  });

  it("a linked row offers Not paid back instead, through the same page action", () => {
    const link = { id: 9, description: "Pizza", date: "2026-03-01", amount: -10000 };
    const linked = row(1, { amount: 5000, flow: "refund", categoryId: 2, paidBackFor: link });
    const act = actions();
    const menu = rowMenu(linked, [linked], index, act);
    expect(keys(menu)).toEqual(["rule", "known", "note", "notPaidBack", "ignore", "trash"]);
    expect(entry(menu, "notPaidBack")?.label).toBe(s.paidBack.clear);
    entry(menu, "notPaidBack")?.onSelect();
    expect(act.openPaidBack).toHaveBeenCalledWith(linked);
  });

  it("not for money out, card bills, gone rows or a selection", () => {
    const has = (r: TransactionRow, targets = [r]) => keys(rowMenu(r, targets, index, actions())).includes("paidBack");
    expect(has(row(1, { amount: -5000, flow: "spending" }))).toBe(false);
    expect(has(row(1, { amount: 5000, flow: "internal" }))).toBe(false);
    expect(has(row(1, { amount: 5000, flow: "gone", status: "gone" }))).toBe(false);
    expect(has(row(1, { amount: 5000, flow: "income" }), [row(1, { amount: 5000 }), row(2, { amount: 10 })])).toBe(false);
  });
});
