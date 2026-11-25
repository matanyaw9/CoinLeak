// Display helpers for the category tree (three levels, spec 34): lookups,
// depth and full paths, the tree in order for lists, and core's totals per
// top-level category as chart slices.

import type { Agorot, Category, CategoryKind } from "@shared/types";
import { s } from "@/strings";

export const UNCATEGORIZED_COLOR = "#C9BFAE";
export const OTHER_COLOR = "#B1AA9C";
const FALLBACK_COLOR = "#B8AE9C";
/** How deep categories nest; core and the database refuse more (spec 34). */
export const MAX_LEVELS = 3;

export interface CategoryIndex {
  byId: Map<number, Category>;
  /** Top-level categories in the order core sent them. */
  roots: Category[];
  children: Map<number, Category[]>;
}

export function indexCategories(list: Category[] = []): CategoryIndex {
  const live = list.filter((c) => !c.archived);
  const byId = new Map(live.map((c) => [c.id, c]));
  const children = new Map<number, Category[]>();
  const roots: Category[] = [];
  for (const c of live) {
    if (c.parentId != null && byId.has(c.parentId)) {
      children.set(c.parentId, [...(children.get(c.parentId) ?? []), c]);
    } else {
      roots.push(c);
    }
  }
  return { byId, roots, children };
}

/** The category and everything under it, for "show me these transactions". */
export function idsUnder(index: CategoryIndex, id: number): number[] {
  return [id, ...(index.children.get(id) ?? []).flatMap((c) => idsUnder(index, c.id))];
}

export const colorOf = (c: Category | null | undefined) => (c ? (c.color ?? FALLBACK_COLOR) : UNCATEGORIZED_COLOR);

/** The categories above this one, top level first. */
export function ancestorsOf(index: CategoryIndex, c: Category): Category[] {
  const out: Category[] = [];
  let parent = c.parentId != null ? index.byId.get(c.parentId) : undefined;
  while (parent && out.length < MAX_LEVELS) {
    out.unshift(parent);
    parent = parent.parentId != null ? index.byId.get(parent.parentId) : undefined;
  }
  return out;
}

/** 1 for a top-level category, 2 under it, 3 under that. */
export function depthOf(index: CategoryIndex, c: Category): number {
  return ancestorsOf(index, c).length + 1;
}

/** How many levels the category spans with everything under it: 1 without children. */
export function heightOf(index: CategoryIndex, id: number): number {
  return 1 + Math.max(0, ...(index.children.get(id) ?? []).map((c) => heightOf(index, c.id)));
}

/** "Groceries & Shop › Groceries › Weekly shop": the full path. */
export function pathOf(index: CategoryIndex, c: Category): string {
  return [...ancestorsOf(index, c), c].map((x) => x.name).join(" › ");
}

export interface TreeEntry {
  category: Category;
  /** 1 for a top-level category. */
  depth: number;
}

/** The categories depth first, each right before its children, as core orders them; one kind's, or all. */
export function treeOf(index: CategoryIndex, kind?: CategoryKind): TreeEntry[] {
  const walk = (list: Category[], depth: number): TreeEntry[] =>
    list.flatMap((c) => [{ category: c, depth }, ...walk(index.children.get(c.id) ?? [], depth + 1)]);
  return walk(
    index.roots.filter((r) => kind === undefined || r.kind === kind),
    1,
  );
}

/**
 * Where a category may sit (spec 34): same-kind categories at level 1 or 2,
 * never itself or anything under it, and only where it still fits in three
 * levels with everything under it. `category` is null for a new one.
 */
export function parentChoices(index: CategoryIndex, kind: CategoryKind, category: Category | null): TreeEntry[] {
  const own = category ? new Set(idsUnder(index, category.id)) : new Set<number>();
  const height = category ? heightOf(index, category.id) : 1;
  return treeOf(index, kind).filter((e) => !own.has(e.category.id) && e.depth + height <= MAX_LEVELS);
}

export interface Slice {
  /** Stable key for charts: the root id, "none" or "other". */
  key: string;
  /** Root id, null for uncategorized, undefined for the "Other" bucket. */
  categoryId: number | null | undefined;
  name: string;
  emoji: string | null;
  color: string;
  amount: Agorot;
}

/** Core's totals per top-level category as chart slices, largest first. */
export function parentSlices(index: CategoryIndex, byParent: { categoryId: number | null; amount: Agorot }[]): Slice[] {
  return byParent
    .filter((p) => p.amount > 0)
    .map((p) => {
      const c = p.categoryId == null ? null : (index.byId.get(p.categoryId) ?? null);
      return {
        key: p.categoryId == null ? "none" : String(p.categoryId),
        categoryId: p.categoryId,
        name: c ? c.name : p.categoryId == null ? s.common.uncategorized : s.common.other,
        emoji: c?.emoji ?? null,
        color: colorOf(c),
        amount: p.amount,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Any category (or uncategorized, null) as a chart series. A subcategory
 * without its own color takes its group's.
 */
export function categorySlice(index: CategoryIndex, id: number | null): Slice {
  const c = id === null ? undefined : index.byId.get(id);
  const parent = c?.parentId != null ? index.byId.get(c.parentId) : undefined;
  return {
    key: id === null ? "none" : String(id),
    categoryId: id,
    name: c?.name ?? s.common.uncategorized,
    emoji: c?.emoji ?? null,
    color: c ? (c.color ?? colorOf(parent ?? c)) : UNCATEGORIZED_COLOR,
    amount: 0,
  };
}

/** A category's own rows, beside its children's in a chart one level down: "Other in Groceries" (spec 34). */
export function ownRowsSlice(index: CategoryIndex, id: number): Slice {
  const slice = categorySlice(index, id);
  return { ...slice, name: s.nested.otherIn(slice.name) };
}

/** The "Other" bucket a chart folds its small slices into. */
export function otherSlice(amount: Agorot): Slice {
  return { key: "other", categoryId: undefined, name: s.common.other, emoji: null, color: OTHER_COLOR, amount };
}
