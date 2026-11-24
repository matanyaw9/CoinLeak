// The rows ticked on the Transactions list. A selection belongs to one
// filter: changing the month or the filters starts fresh. The rules for
// what a click selects are in selection.ts.

import { useState } from "react";
import type { TransactionRow } from "@shared/types";
import { pickRow, selectAll, toggleAll, type RowPick } from "./selection";

const NONE: RowPick = { selected: new Set(), anchor: null };

export interface Selection {
  selected: ReadonlySet<number>;
  /** One row's box or Ctrl+click; with `range` (shift-click), every row since the last one clicked. */
  toggle(id: number, range: boolean): void;
  /** A select-all box for `ids`. */
  toggleMany(ids: number[]): void;
  /** spec 31, Ctrl+A: select every one of `ids`. */
  selectAll(ids: number[]): void;
  set(ids: ReadonlySet<number>): void;
  clear(): void;
}

/** `scope` names the filter the rows were listed with. */
export function useSelection(rows: TransactionRow[], scope: string): Selection {
  const [state, setState] = useState({ scope, pick: NONE });
  const pick = state.scope === scope ? state.pick : NONE;
  const put = (next: RowPick) => setState({ scope, pick: next });
  const set = (ids: ReadonlySet<number>) => put({ ...pick, selected: ids });

  return {
    selected: pick.selected,
    toggle: (id, range) => put(pickRow(rows.map((r) => r.id), pick, id, range)),
    toggleMany: (ids) => set(toggleAll(ids, pick.selected)),
    selectAll: (ids) => set(selectAll(ids, pick.selected)),
    set,
    clear: () => set(new Set()),
  };
}
