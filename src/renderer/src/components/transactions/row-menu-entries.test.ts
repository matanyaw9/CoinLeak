import { describe, expect, it, vi } from "vitest";
import type { Category, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { indexCategories } from "@/lib/categories";
import { rowMenu, type RowMenuActions } from "./row-menu-entries";

const groceries = { id: 2, parentId: null, name: "Groceries", kind: "expense", emoji: null, color: null, archived: false } as Category;
const index = indexCategories([groceries]);
const row = (id: number, more: Partial<TransactionRow> = {}) =>
  ({ id, description: " Shop ", categoryId: null, note: null, source: "sync", excluded: false, ...more }) as TransactionRow;

function actions(): RowMenuActions {
  return {
    makeRule: vi.fn(),
    addKnownPlace: vi.fn(),
    openNote: vi.fn(),
    editCash: vi.fn(),
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
