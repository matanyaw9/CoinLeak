// The category chooser's rules (spec 38, F79; tick boxes, spec 40, F91), shared
// by both Home charts: what it lists, how a click on a tick box changes the
// draft, and its label. The draft is always the smallest list that says what is
// ticked: a fully ticked category alone, a partly ticked one as what is ticked
// under it. So no money is ever counted twice.

import { s } from "@/strings";
import { ancestorsOf, idsUnder, pathOf, treeOf, type CategoryIndex } from "@/lib/categories";
import type { TrendTicks } from "./trend-filter";

export interface ChooserItem {
  /** null is uncategorized. */
  id: number | null;
  /** The name while browsing, the full path while searching. */
  label: string;
  emoji: string | null;
  /** 1 for a top-level category; always 1 while searching. */
  depth: number;
}

/** The spending tree with Uncategorized last, or only the lines whose full path holds the search. */
export function chooserItems(index: CategoryIndex, query: string): ChooserItem[] {
  const q = query.trim().toLowerCase();
  const none: ChooserItem = { id: null, label: s.common.uncategorized, emoji: null, depth: 1 };
  const tree = treeOf(index, "expense");
  if (!q) return [...tree.map(({ category: c, depth }) => ({ id: c.id, label: c.name, emoji: c.emoji, depth })), none];
  const paths = tree.map(({ category: c }) => ({ id: c.id, label: pathOf(index, c), emoji: c.emoji, depth: 1 }));
  return [...paths, none].filter((item) => item.label.toLowerCase().includes(q));
}

/** How a line's box looks: ticked (itself or a category above it), a dash (something under it), or empty. */
export type TickState = "on" | "partly" | "off";

export function tickState(draft: TrendTicks, id: number | null, index: CategoryIndex): TickState {
  if (draft.includes(id) || tickedAbove(draft, id, index) !== null) return "on";
  const partly = id !== null && idsUnder(index, id).some((under) => draft.includes(under));
  return partly ? "partly" : "off";
}

/**
 * The draft after a click on `id`'s box: a ticked line is unticked, any other
 * is ticked with everything under it, and no other line changes. A click that
 * would make the list longer than `limit` returns the same draft.
 */
export function tickDraft(draft: TrendTicks, id: number | null, index: CategoryIndex, limit = Infinity): TrendTicks {
  const next = tickState(draft, id, index) === "on" ? untick(draft, id, index) : tick(draft, id, index);
  return next.length > limit ? draft : next;
}

function tick(draft: TrendTicks, id: number | null, index: CategoryIndex): TrendTicks {
  const under = id === null ? [] : idsUnder(index, id);
  const rest = draft.filter((t) => t === null || !under.includes(t));
  return smallest([...rest, id], index);
}

function untick(draft: TrendTicks, id: number | null, index: CategoryIndex): TrendTicks {
  const above = tickedAbove(draft, id, index);
  if (id === null || above === null) return draft.filter((t) => t !== id);
  // Counted in a ticked category: that one makes way for the rest of what is under it.
  return draft.flatMap((t) => (t === above ? allBut(above, id, index) : [t]));
}

/** Everything under `top` except `id` and what is under it, in as few ids as will say it. */
function allBut(top: number, id: number, index: CategoryIndex): number[] {
  return (index.children.get(top) ?? []).flatMap((c) => {
    if (c.id === id) return [];
    return idsUnder(index, c.id).includes(id) ? allBut(c.id, id, index) : [c.id];
  });
}

/**
 * The same ticks as the smallest list: nothing under a ticked category, and a
 * category whose children are all ticked is ticked itself.
 */
export function smallest(ticks: TrendTicks, index: CategoryIndex): TrendTicks {
  let out = ticks.filter((t) => tickedAbove(ticks, t, index) === null);
  // The tree backwards: children come before their parent, so a filled one can fill the next.
  for (const { category } of treeOf(index).reverse()) {
    const children = (index.children.get(category.id) ?? []).map((c) => c.id);
    if (children.length > 0 && children.every((c) => out.includes(c))) {
      out = [...out.filter((t) => t === null || !children.includes(t)), category.id];
    }
  }
  return out;
}

/** The chooser button: `none` when nothing is ticked, the name of one, or "3 categories". */
export function chooserLabel(ticks: TrendTicks, index: CategoryIndex, none: string): string {
  if (ticks.length === 0) return none;
  if (ticks.length === 1) return nameOf(index, ticks[0] ?? null);
  return s.chooser.count(ticks.length);
}

export function nameOf(index: CategoryIndex, id: number | null): string {
  return id === null ? s.common.uncategorized : (index.byId.get(id)?.name ?? s.common.other);
}

/** The ticked category a line sits under (so it is ticked too), or null. */
export function tickedAbove(draft: TrendTicks, id: number | null, index: CategoryIndex): number | null {
  const c = id === null ? undefined : index.byId.get(id);
  return c ? (ancestorsOf(index, c).find((a) => draft.includes(a.id))?.id ?? null) : null;
}
