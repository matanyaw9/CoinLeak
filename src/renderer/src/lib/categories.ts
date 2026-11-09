// Display helpers for the two-level category tree: lookups, and core's
// totals per top-level category as chart slices.

import type { Agorot, Category } from "@shared/types";
import { s } from "@/strings";

export const UNCATEGORIZED_COLOR = "#C9BFAE";
export const OTHER_COLOR = "#B1AA9C";
const FALLBACK_COLOR = "#B8AE9C";

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

/** The category and its subcategories, for "show me these transactions". */
export function idsUnder(index: CategoryIndex, id: number): number[] {
  return [id, ...(index.children.get(id) ?? []).map((c) => c.id)];
}

export const colorOf = (c: Category | null | undefined) => (c ? (c.color ?? FALLBACK_COLOR) : UNCATEGORIZED_COLOR);

/** "Food › Groceries" style label for a subcategory. */
export function pathOf(index: CategoryIndex, c: Category): string {
  const parent = c.parentId != null ? index.byId.get(c.parentId) : undefined;
  return parent ? `${parent.name} › ${c.name}` : c.name;
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

/** Keeps the biggest `max - 1` slices and folds the rest into "Other". */
export function topSlices(slices: Slice[], max: number): Slice[] {
  if (slices.length <= max) return slices;
  const keep = slices.slice(0, max - 1);
  const rest = slices.slice(max - 1);
  return [
    ...keep,
    {
      key: "other",
      categoryId: undefined,
      name: s.common.other,
      emoji: null,
      color: OTHER_COLOR,
      amount: rest.reduce((a, x) => a + x.amount, 0),
    },
  ];
}
