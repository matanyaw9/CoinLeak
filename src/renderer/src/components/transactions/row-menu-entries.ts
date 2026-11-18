// What the row menu (spec 11) offers for a row: make a rule, add the shop to
// its category's known places (spec 13), a note and editing a cash row (spec
// 20), ignore or count again, and trash. On a row that is part of the
// selection, the menu acts on the whole selection.

import { Eye, EyeOff, ListPlus, Pencil, StickyNote, Trash2, WandSparkles } from "lucide-react";
import type { Category, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import type { CategoryIndex } from "@/lib/categories";
import { allIgnored } from "@/lib/review-rows";
import type { MenuEntry, RowMenuModel } from "./row-menu";

/** What the entries do; the page wires them to its dialogs and calls. */
export interface RowMenuActions {
  makeRule(targets: TransactionRow[]): void;
  addKnownPlace(description: string, category: Category): void;
  openNote(id: number): void;
  editCash(row: TransactionRow): void;
  setIgnored(targets: TransactionRow[], excluded: boolean, after?: () => void): void;
  trash(targets: TransactionRow[], after: () => void): void;
  clearSelection(): void;
}

/** The menu for `row`, acting on `targets`: the row alone, or the selection it is in. */
export function rowMenu(row: TransactionRow, targets: TransactionRow[], index: CategoryIndex, act: RowMenuActions): RowMenuModel {
  const many = targets.length > 1;
  const ignoredAll = allIgnored(targets);
  const category = !many && row.categoryId != null ? index.byId.get(row.categoryId) : undefined;
  const entries: MenuEntry[] = [
    {
      key: "rule",
      label: many ? s.rowMenu.makeRuleMany(targets.length) : s.rowMenu.makeRule(row.description.trim()),
      icon: WandSparkles,
      onSelect: () => act.makeRule(targets),
    },
  ];
  if (category) {
    entries.push({
      key: "known",
      label: s.rulesV2.knownPlaces.add(row.description.trim(), category.name),
      hint: s.rulesV2.knownPlaces.addHint,
      icon: ListPlus,
      onSelect: () => act.addKnownPlace(row.description, category),
    });
  }
  if (!many) {
    entries.push({ key: "note", label: row.note ? s.note.edit : s.note.add, icon: StickyNote, onSelect: () => act.openNote(row.id) });
    if (row.source === "manual") entries.push({ key: "edit", label: s.cash.edit, icon: Pencil, onSelect: () => act.editCash(row) });
  }
  entries.push(
    {
      key: "ignore",
      label: ignoredAll ? s.rowMenu.countAgain : s.rowMenu.ignore,
      hint: ignoredAll ? undefined : s.rowMenu.ignoreHint,
      icon: ignoredAll ? Eye : EyeOff,
      // A single row keeps whatever is selected elsewhere; a selection is done with.
      onSelect: () => act.setIgnored(targets, !ignoredAll, many ? act.clearSelection : undefined),
    },
    {
      key: "trash",
      label: s.rowMenu.trash,
      hint: s.rowMenu.trashHint,
      icon: Trash2,
      danger: true,
      onSelect: () => act.trash(targets, act.clearSelection),
    },
  );
  return { heading: many ? s.rowMenu.forSelection(targets.length) : undefined, entries };
}
