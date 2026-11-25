// Spec 35: the editor list's tick state turns into the right save
// arguments. What the save then does is tested in core (rules/save.test.ts).

import { describe, expect, it } from "vitest";
import { allState, tickArgs, tickedIds, toggleAll, toggleOne, type TickRows } from "./rule-ticks";

const none = new Map<number, boolean>();

describe("rule editor tick boxes", () => {
  it("ticks every shown row by default, except the rule's exceptions", () => {
    const rows: TickRows = { shown: [9, 7, 4, 2], exceptions: [7], handSet: [] };
    expect([...tickedIds(rows, none)]).toEqual([9, 4, 2]);
    expect(tickArgs(rows, none)).toEqual({ unticked: [7], ticked: [9, 4, 2], alsoChange: [] });
  });

  it("a click flips one row, also an exception back to ticked", () => {
    const rows: TickRows = { shown: [9, 7, 4], exceptions: [7], handSet: [] };
    let choices = toggleOne(none, 9, tickedIds(rows, none));
    choices = toggleOne(choices, 7, tickedIds(rows, choices));
    expect(tickArgs(rows, choices)).toEqual({ unticked: [9], ticked: [7, 4], alsoChange: [] });
  });

  it("sends ticked hand-set rows as alsoChange, and unticked ones only as unticked", () => {
    const rows: TickRows = { shown: [9, 7, 4], exceptions: [], handSet: [7, 4] };
    expect(tickArgs(rows, none).alsoChange).toEqual([7, 4]);
    const choices = toggleOne(none, 4, tickedIds(rows, none));
    expect(tickArgs(rows, choices)).toEqual({ unticked: [4], ticked: [9, 7], alsoChange: [7] });
  });

  it("never names rows that are not shown", () => {
    // Row 3 was unticked, then the conditions changed and it left the list.
    const choices = new Map([[3, false]]);
    const rows: TickRows = { shown: [9, 4], exceptions: [5], handSet: [4, 1] };
    expect(tickArgs(rows, choices)).toEqual({ unticked: [], ticked: [9, 4], alsoChange: [4] });
  });

  it("the box above the list shows all, none or some, and ticks all unless all are", () => {
    const rows: TickRows = { shown: [9, 7, 4], exceptions: [7], handSet: [] };
    const some = tickedIds(rows, none);
    expect(allState(rows.shown, some)).toBe("indeterminate");

    const all = toggleAll(none, rows.shown, some);
    expect(allState(rows.shown, tickedIds(rows, all))).toBe(true);
    expect(tickArgs(rows, all).unticked).toEqual([]);

    const cleared = toggleAll(all, rows.shown, tickedIds(rows, all));
    expect(allState(rows.shown, tickedIds(rows, cleared))).toBe(false);
    expect(tickArgs(rows, cleared)).toEqual({ unticked: [9, 7, 4], ticked: [], alsoChange: [] });
  });

  it("sends nothing when no rows are shown", () => {
    const rows: TickRows = { shown: [], exceptions: [], handSet: [] };
    expect(tickArgs(rows, new Map([[1, false]]))).toEqual({ unticked: [], ticked: [], alsoChange: [] });
    expect(allState([], new Set())).toBe(false);
  });
});
