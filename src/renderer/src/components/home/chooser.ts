// The category chooser's rules (spec 38, F79), shared by both Home charts:
// what it lists (the spending tree, or full paths matching a search), how a
// tick changes the draft (never overlapping, up to a limit), and its label.

import { s } from "@/strings";
import { ancestorsOf, pathOf, treeOf, type CategoryIndex } from "@/lib/categories";
import { toggleTick, type TrendTicks } from "./trend-filter";

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

/**
 * The draft after ticking or unticking `id`. Ticks never overlap (a tick
 * unticks everything under and above it); a tick that would go past `limit`
 * changes nothing and returns the same draft.
 */
export function tickDraft(draft: TrendTicks, id: number | null, index: CategoryIndex, limit = Infinity): TrendTicks {
  const next = toggleTick(draft, id, index);
  return next.length > limit ? draft : next;
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

/** The ticked category a line sits under (its money is counted already, so it shows a lighter tick), or null. */
export function tickedAbove(draft: TrendTicks, id: number | null, index: CategoryIndex): number | null {
  const c = id === null ? undefined : index.byId.get(id);
  return c ? (ancestorsOf(index, c).find((a) => draft.includes(a.id))?.id ?? null) : null;
}
