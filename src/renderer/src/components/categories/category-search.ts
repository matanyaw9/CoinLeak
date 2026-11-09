// What the Categories search shows (spec 21): a group whose name matches
// keeps all its categories; otherwise only the categories whose name or a
// known place matches; groups with nothing left are gone.

import type { Category, CategoryKind } from "@shared/types";
import type { CategoryIndex } from "@/lib/categories";
import { hasText } from "@/components/layout/find-text";

export interface CategoryGroup {
  root: Category;
  /** The categories shown under the group. */
  kids: Category[];
}

/** Known place names per category id. */
export type PlaceNames = (categoryId: number) => string[] | undefined;

/** True when the category's name or one of its known places holds `query`. */
export function categoryHits(c: Category, query: string, places: PlaceNames): boolean {
  return hasText(c.name, query) || (places(c.id) ?? []).some((p) => hasText(p, query));
}

/** The groups of `kind` the search keeps, in the tree's order. Every group when `query` is empty. */
export function searchCategories(index: CategoryIndex, kind: CategoryKind, query: string, places: PlaceNames): CategoryGroup[] {
  return index.roots
    .filter((r) => r.kind === kind)
    .flatMap((root) => {
      const kids = index.children.get(root.id) ?? [];
      if (categoryHits(root, query, places)) return [{ root, kids }];
      const hits = kids.filter((c) => categoryHits(c, query, places));
      return hits.length > 0 ? [{ root, kids: hits }] : [];
    });
}

/** How many groups the search finds in each other kind, for "3 matches in Income". */
export function hitsElsewhere(index: CategoryIndex, kind: CategoryKind, query: string, places: PlaceNames) {
  const kinds = [...new Set(index.roots.map((r) => r.kind))].filter((k) => k !== kind);
  return kinds
    .map((k) => ({ kind: k, count: countCategories(searchCategories(index, k, query, places)) }))
    .filter((x) => x.count > 0);
}

function countCategories(groups: CategoryGroup[]): number {
  return groups.reduce((n, g) => n + Math.max(1, g.kids.length), 0);
}
