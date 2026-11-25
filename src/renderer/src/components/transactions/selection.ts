// Selecting rows on the Transactions list. One row's box, where shift-click
// takes in every row since the last one clicked (spec 11). Select all (spec
// 20, F46): the box above the list and each day's box stand for a set of
// rows. Checked when all are selected, mixed when some are, and a click
// selects them all, or clears them when all were. Spec 31: Ctrl+click and
// Shift+click on the row itself, and Ctrl+A. Spec 36: Shift+arrows, and the
// rows a key acts on. Trash selects with these same rules.

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

/** The selection and the row last clicked, where a shift-click range starts. */
export interface RowPick {
  selected: ReadonlySet<number>;
  anchor: number | null;
}

/** A click on row `id`, as a plain toggle or a shift range. The anchor moves to it either way. */
export function pickRow(order: readonly number[], pick: RowPick, id: number, range: boolean): RowPick {
  return { selected: toggleRow(order, pick.selected, id, range, pick.anchor), anchor: id };
}

export type RowClick = "range" | "toggle";

/**
 * What a click on the row itself does (spec 31): Shift+click takes the range
 * since the last click, Ctrl+click (Cmd on a Mac) adds or removes the row. A
 * plain click is not a selection click.
 */
export function rowClickKind(e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }, mac: boolean): RowClick | null {
  if (e.altKey) return null;
  if (e.shiftKey) return "range";
  return (mac ? e.metaKey : e.ctrlKey) ? "toggle" : null;
}

/** The rows listed from `a` to `b`, either way round. */
function span(order: readonly number[], a: number, b: number): readonly number[] {
  const from = order.indexOf(a);
  const to = order.indexOf(b);
  return order.slice(Math.min(from, to), Math.max(from, to) + 1);
}

/**
 * Shift+Down or Shift+Up (spec 36): focus moved from row `from` to row `to`.
 * Every row from the anchor (the last row clicked) to `to` is selected, so
 * going back toward the anchor clears the row left behind. With no anchor
 * listed, the range starts at `from`. The anchor stays where it is.
 */
export function extendTo(order: readonly number[], pick: RowPick, from: number, to: number): RowPick {
  if (!order.includes(from) || !order.includes(to)) return pick;
  const anchor = pick.anchor !== null && order.includes(pick.anchor) ? pick.anchor : from;
  const next = new Set(pick.selected);
  for (const id of span(order, anchor, from)) next.delete(id);
  for (const id of span(order, anchor, to)) next.add(id);
  return { selected: next, anchor };
}

/** Spec 36: what Delete or I acts on: the selected rows, or else the row focus is on. */
export function keyTargets<T extends { id: number }>(rows: readonly T[], selected: ReadonlySet<number>, focused: number | null): T[] {
  if (selected.size > 0) return rows.filter((r) => selected.has(r.id));
  return rows.filter((r) => r.id === focused);
}

/** Ctrl+A: every one of `ids` selected, the same rows the box above the list selects. */
export function selectAll(ids: readonly number[], selected: ReadonlySet<number>): Set<number> {
  return new Set([...selected, ...ids]);
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
