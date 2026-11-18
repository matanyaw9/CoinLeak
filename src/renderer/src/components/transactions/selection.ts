// Selecting rows on the Transactions list. One row's box, where shift-click
// takes in every row since the last one clicked (spec 11). Select all (spec
// 20, F46): the box above the list and each day's box stand for a set of
// rows. Checked when all are selected, mixed when some are, and a click
// selects them all, or clears them when all were.

/**
 * The selection after clicking the box of row `id`. With `range`
 * (shift-click), every row listed from `anchor` (the last row clicked) to
 * this one takes the clicked row's new state. `order` is the rows as listed.
 */
export function toggleRow(
  order: readonly number[],
  selected: ReadonlySet<number>,
  id: number,
  range: boolean,
  anchor: number | null,
): Set<number> {
  const next = new Set(selected);
  const on = !next.has(id);
  const from = anchor !== null ? order.indexOf(anchor) : -1;
  const to = order.indexOf(id);
  const span = range && from >= 0 ? order.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
  for (const x of span) {
    if (on) next.add(x);
    else next.delete(x);
  }
  return next;
}

export type CheckState = "all" | "some" | "none";

export function checkState(ids: readonly number[], selected: ReadonlySet<number>): CheckState {
  const n = ids.filter((id) => selected.has(id)).length;
  if (n === 0) return "none";
  return n === ids.length ? "all" : "some";
}

/** The selection after clicking the box for `ids`. Other rows stay as they are. */
export function toggleAll(ids: readonly number[], selected: ReadonlySet<number>): Set<number> {
  const next = new Set(selected);
  const all = checkState(ids, selected) === "all";
  for (const id of ids) {
    if (all) next.delete(id);
    else next.add(id);
  }
  return next;
}

/** For the Checkbox component. */
export function checkedProp(state: CheckState): boolean | "indeterminate" {
  return state === "some" ? "indeterminate" : state === "all";
}
