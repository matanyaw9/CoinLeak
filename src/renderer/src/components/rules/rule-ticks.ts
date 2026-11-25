// The tick boxes in the rule editor's list of matching rows (spec 35, F71):
// which shown rows are ticked, and what saving sends. Plain functions, no
// React. A row the user never clicked is ticked unless it is already one of
// the rule's exceptions.

/** The user's own clicks by row id: true ticked, false unticked. */
export type TickChoices = ReadonlyMap<number, boolean>;

/** What the list knows from the preview. */
export interface TickRows {
  /** Ids of the rows shown, newest first. */
  shown: number[];
  /** Ids of the shown rows the saved rule skips today. */
  exceptions: number[];
  /** Ids of hand-set rows the rule would move to its category (F45); empty when it may not. */
  handSet: number[];
}

/** What a save sends besides the rule. */
export interface TickArgs {
  /** Shown rows unticked: the rule leaves them alone from now on. */
  unticked: number[];
  /** Shown rows ticked: any exception they had ends. */
  ticked: number[];
  /** Ticked hand-set rows: the rule moves them to its category. */
  alsoChange: number[];
}

/** The shown rows that are ticked now. */
export function tickedIds(rows: TickRows, choices: TickChoices): Set<number> {
  const skipped = new Set(rows.exceptions);
  return new Set(rows.shown.filter((id) => choices.get(id) ?? !skipped.has(id)));
}

/** The box above the list: every shown row ticked, none, or some. */
export function allState(shown: number[], ticked: Set<number>): boolean | "indeterminate" {
  const count = shown.filter((id) => ticked.has(id)).length;
  if (count === 0) return false;
  return count === shown.length ? true : "indeterminate";
}

/** The choices after a click on one row's box. */
export function toggleOne(choices: TickChoices, id: number, ticked: Set<number>): Map<number, boolean> {
  return new Map(choices).set(id, !ticked.has(id));
}

/** The choices after a click on the box above the list: all ticked unless all already are. */
export function toggleAll(choices: TickChoices, shown: number[], ticked: Set<number>): Map<number, boolean> {
  const on = allState(shown, ticked) !== true;
  const next = new Map(choices);
  for (const id of shown) next.set(id, on);
  return next;
}

/** The save's tick arguments, from the rows shown and the user's choices. */
export function tickArgs(rows: TickRows, choices: TickChoices): TickArgs {
  const ticked = tickedIds(rows, choices);
  return {
    unticked: rows.shown.filter((id) => !ticked.has(id)),
    ticked: rows.shown.filter((id) => ticked.has(id)),
    alsoChange: rows.handSet.filter((id) => ticked.has(id)),
  };
}
