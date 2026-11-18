// The rows ticked on the Transactions list. A selection belongs to one
// filter: changing the month or the filters starts fresh. The rules for
// what a click selects are in selection.ts.

import { useRef, useState } from "react";
import type { TransactionRow } from "@shared/types";
import { toggleAll, toggleRow } from "./selection";

const NONE: ReadonlySet<number> = new Set();

export interface Selection {
  selected: ReadonlySet<number>;
  /** One row's box; with `range` (shift-click), every row since the last one clicked. */
  toggle(id: number, range: boolean): void;
  /** A select-all box for `ids`. */
  toggleMany(ids: number[]): void;
  set(ids: ReadonlySet<number>): void;
  clear(): void;
}

/** `scope` names the filter the rows were listed with. */
export function useSelection(rows: TransactionRow[], scope: string): Selection {
  const [selection, setSelection] = useState({ scope, ids: NONE });
  const selected = selection.scope === scope ? selection.ids : NONE;
  const anchor = useRef<number | null>(null);
  const set = (ids: ReadonlySet<number>) => setSelection({ scope, ids });

  return {
    selected,
    toggle: (id, range) => {
      set(toggleRow(rows.map((r) => r.id), selected, id, range, anchor.current));
      anchor.current = id;
    },
    toggleMany: (ids) => set(toggleAll(ids, selected)),
    set,
    clear: () => set(NONE),
  };
}
