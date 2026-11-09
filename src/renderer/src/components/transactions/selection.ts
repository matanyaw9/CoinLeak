// Select all (spec 20, F46): the box above the list and each day's box
// stand for a set of rows. Checked when all are selected, mixed when some
// are, and a click selects them all, or clears them when all were.

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
