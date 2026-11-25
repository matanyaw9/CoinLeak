// Screenshot aid for the Transactions page (dev start route only, see
// lib/shot.ts): `?shot=...` opens a menu, selects rows or shows a toast so a
// headless screenshot can show what a click would reach.

import { useEffect, useState } from "react";
import type { Category, TransactionRow } from "@shared/types";
import type { CategoryIndex } from "@/lib/categories";
import { groupByDay } from "@/lib/day-groups";
import { useShot } from "@/lib/shot";
import { openFirstPicker } from "./category-picker";

/**
 * `?shot=menu` opens the "..." menu on a row, `?shot=select` selects three
 * rows, `?shot=offer` shows the "Always put X in Y?" toast, and `?shot=bills`
 * or `?shot=bills-on` go to last month (which has card bills) with them
 * hidden or shown. Spec 17: `?shot=hover` shows who set the category on a
 * row a rule sorted, and `?shot=hover-user` on a row sorted by hand. Spec 20:
 * `?shot=select-day`, `?shot=note` and `?shot=add-cash`. Spec 34:
 * `?shot=pick-<text>` opens the first row's category picker searching `<text>`.
 */
export function useDemoShot(
  rows: TransactionRow[],
  aids: {
    select: (ids: Set<number>) => void;
    setShowBills: (show: boolean) => void;
    lastMonth: () => void;
    offerRule: (row: TransactionRow, category: Category, still: boolean) => void;
    index: CategoryIndex;
    openNote: (id: number) => void;
    openCash: () => void;
  },
): { menuRow: number | null; hintRow: number | null } {
  const shot = useShot();
  const ready = rows.length > 0;
  const [menuRow, setMenuRow] = useState<number | null>(null);
  const [hintRow, setHintRow] = useState<number | null>(null);
  useEffect(() => {
    if (!shot || !ready) return;
    const id = setTimeout(() => {
      const spending = rows.filter((r) => r.flow === "spending" && r.categorySource !== "rule" && r.amount < 0);
      if (shot === "menu") setMenuRow(spending[0]?.id ?? null);
      // spec 13: a row sorted by hand, so the menu offers its known places.
      if (shot === "menu-known") setMenuRow(spending.find((r) => r.categorySource === "user" && r.categoryId != null)?.id ?? null);
      if (shot === "select") aids.select(new Set(spending.slice(0, 3).map((r) => r.id)));
      if (shot === "bills" || shot === "bills-on") aids.lastMonth();
      if (shot === "bills-on") aids.setShowBills(true);
      const groceries = [...aids.index.byId.values()].find((c) => c.name === "Groceries");
      if (shot === "offer" && spending[0] && groceries) aids.offerRule(spending[0], groceries, true);
      const source = shot === "hover" ? "rule" : shot === "hover-user" ? "user" : null;
      if (source) setHintRow(rows.find((r) => r.categorySource === source && r.categoryId != null)?.id ?? null);
      // spec 20: two rows of a busy day (that day's box and the top box mixed),
      // the note box on a row with a note, and the cash form.
      if (shot === "select-day") {
        const day = groupByDay(rows).find((g) => g.rows.length >= 3);
        if (day) aids.select(new Set(day.rows.slice(0, 2).map((r) => r.id)));
      }
      const noted = rows.find((r) => r.note);
      if (shot === "note" && noted) aids.openNote(noted.id);
      if (shot === "add-cash") aids.openCash();
      // spec 34: the first row's category picker, open with a search typed.
      if (shot.startsWith("pick-")) openFirstPicker(shot.slice("pick-".length));
    }, 400);
    return () => clearTimeout(id);
    // Once per load: refreshed rows must not repeat it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, ready]);
  return { menuRow, hintRow };
}
