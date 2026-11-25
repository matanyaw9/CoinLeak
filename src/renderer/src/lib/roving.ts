// One list, one Tab stop (spec 36, F83): Tab hops between lists, arrow keys
// move within one. `nextIndex` is the key logic as a plain function;
// `useRoving` gives a list's items their Tab order, focus and keys. Lists
// with disabled lines name them in `skip`.

import { useEffect, useRef, useState } from "react";

/** Items the arrow keys pass over (disabled buttons, say). */
export type Skip = (index: number) => boolean;

const SKIP_NONE: Skip = () => false;

/** The first item from `from`, going `step` at a time, that is not skipped; null when none is. */
export function firstOpen(from: number, step: number, count: number, skip: Skip = SKIP_NONE): number | null {
  for (let i = from; i >= 0 && i < count; i += step) if (!skip(i)) return i;
  return null;
}

/**
 * Where focus goes from item `index` of `count` when `key` is pressed, in a
 * list of `columns` columns (1 for a plain list, where Left and Right are
 * not the list's). Moves stop at the first and last item and never wrap; in
 * a grid, Right from the end of a line goes on to the next line. Items
 * `skip` names are passed over (spec 36 review: the move dialog's disabled
 * lines). Null when the key is not the list's or no item is open.
 */
export function nextIndex(key: string, index: number, count: number, columns = 1, skip: Skip = SKIP_NONE): number | null {
  if (count <= 0 || firstOpen(0, 1, count, skip) === null) return null;
  const at = Math.min(Math.max(index, 0), count - 1);
  const grid = columns > 1;
  if (key === "Home") return firstOpen(0, 1, count, skip);
  if (key === "End") return firstOpen(count - 1, -1, count, skip);
  const step =
    key === "ArrowDown" ? columns : key === "ArrowUp" ? -columns : grid && key === "ArrowRight" ? 1 : grid && key === "ArrowLeft" ? -1 : 0;
  if (step === 0) return null;
  // Nothing open that way: stay put.
  return firstOpen(at + step, step, count, skip) ?? at;
}

/** What one item gets. Spread it on the item, or split it: see TransactionRow. */
export interface RovingItem {
  /** The element that takes focus. */
  ref: (el: HTMLElement | null) => void;
  tabIndex: 0 | -1;
  /** On the item, or on an element around it that hears its keys. */
  onFocus: () => void;
  onBlur: (e: React.FocusEvent) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

export interface RovingGuard {
  ref: (el: HTMLSpanElement | null) => void;
  tabIndex: 0;
  "aria-hidden": true;
  style: React.CSSProperties;
  onFocus: (e: React.FocusEvent) => void;
}

/** Destructure it (`const { list, item } = useRoving(...)`): React's lint reads `roving.list` as a ref and then flags `roving.item(i)`. */
export interface Roving {
  /** The index of the item in the Tab order: the last one focused, else the first. */
  active: number;
  item(i: number): RovingItem;
  /** On the element around every item. */
  list: (el: HTMLElement | null) => void;
  /**
   * Two invisible stops just before and just after a list whose items hold
   * buttons of their own (Transactions rows): Tab into the list lands on
   * the active item, and Tab past the active item's last button leaves.
   */
  guard(side: "before" | "after"): RovingGuard;
}

export interface RovingOptions {
  /** 1 for a plain list; more for a grid, where Left and Right move too. */
  columns?: number;
  /** The item in the Tab order before any is focused (the chosen one, say). */
  start?: number;
  /** An arrow key moved focus from item `from` to item `to` (Shift+Down extends a selection, say). */
  onMove?: (from: number, to: number, e: React.KeyboardEvent) => void;
  /** Items that are neither the Tab stop nor reached by arrow keys (disabled buttons). */
  skip?: Skip;
}

/** Fixed, so focusing a stop never scrolls the page. */
const GUARD_STYLE: React.CSSProperties = { position: "fixed", top: 0, left: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" };

const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]";

/** The element and the controls inside it that Tab stops on, in order. */
function tabStops(root: HTMLElement): HTMLElement[] {
  return [root, ...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.matches(FOCUSABLE) && el.tabIndex >= 0 && !el.matches(":disabled") && el.getClientRects().length > 0,
  );
}

/** `keys` name the items in order (row ids, say), so the active one stays put when items before it go. */
export function useRoving(keys: readonly (string | number)[], { columns = 1, start = 0, onMove, skip = SKIP_NONE }: RovingOptions = {}): Roving {
  const count = keys.length;
  const [active, setActive] = useState({ key: keys[start], index: start });
  // The item last focused, wherever it is now; if it left, the one now in its
  // place. A skipped item cannot be the Tab stop: the next open one is.
  const found = active.key === undefined ? -1 : keys.indexOf(active.key);
  const wanted = Math.max(0, Math.min(found >= 0 ? found : active.index, count - 1));
  const current = skip(wanted) ? (firstOpen(wanted, 1, count, skip) ?? firstOpen(wanted, -1, count, skip) ?? wanted) : wanted;
  const activate = (i: number) => setActive((a) => (a.key === keys[i] && a.index === i ? a : { key: keys[i], index: i }));
  const items = useRef<(HTMLElement | null)[]>([]);
  const list = useRef<HTMLElement | null>(null);
  const before = useRef<HTMLSpanElement>(null);
  const after = useRef<HTMLSpanElement>(null);
  // Focus is somewhere in the list, so it should stay there if its item goes.
  const inside = useRef(false);

  const focus = (i: number) => {
    activate(i);
    const el = items.current[i];
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "nearest" });
  };

  // The focused item left the list (moved to Trash, say): focus goes to the
  // item now in its place rather than to the top of the page.
  useEffect(() => {
    if (inside.current && document.activeElement === document.body) items.current[current]?.focus({ preventScroll: true });
  });

  const item = (i: number): RovingItem => ({
    ref: (el) => {
      items.current[i] = el;
    },
    tabIndex: i === current ? 0 : -1,
    onFocus: () => {
      inside.current = true;
      activate(i);
    },
    onBlur: (e) => {
      // Focus went elsewhere, or the page itself was clicked: not lost.
      const to = e.relatedTarget;
      if (to ? !list.current?.contains(to) : (e.target as Element).isConnected) inside.current = false;
    },
    onKeyDown: (e) => {
      // Keys from a menu or picker opened from the item are that popup's.
      if (e.defaultPrevented || !e.currentTarget.contains(e.target as Node)) return;
      if (e.key === "Tab") return leave(e);
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const to = nextIndex(e.key, i, count, columns, skip);
      if (to === null) return;
      e.preventDefault();
      onMove?.(i, to, e);
      focus(to);
    },
  });

  // Tab past the item's last button (Shift+Tab before the item) leaves the
  // list: focus goes to the stop at that end, and the browser's own Tab
  // carries on from there to whatever comes next.
  const leave = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const stop = e.shiftKey ? before.current : after.current;
    if (!stop) return;
    const stops = tabStops(e.currentTarget);
    if (e.target === (e.shiftKey ? stops[0] : stops.at(-1))) stop.focus({ preventScroll: true });
  };

  const guard = (side: "before" | "after"): RovingGuard => ({
    ref: (el) => {
      (side === "before" ? before : after).current = el;
    },
    tabIndex: 0,
    "aria-hidden": true,
    style: GUARD_STYLE,
    onFocus: (e) => {
      // From outside the list: on to its active item. From inside, focus is
      // on its way out and the browser's Tab moves on.
      if (!list.current?.contains(e.relatedTarget)) focus(current);
    },
  });

  return {
    active: current,
    item,
    list: (el) => {
      list.current = el;
    },
    guard,
  };
}
