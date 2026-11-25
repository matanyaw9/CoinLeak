// What the Categories search shows (spec 21, three levels since spec 34): a
// group whose name matches keeps everything in it; otherwise a category stays
// when it, a category inside it, or the category it sits in (below the group)
// matches by name or known place; groups with nothing left are gone.

import type { Category, CategoryKind } from "@shared/types";
import { ancestorsOf, idsUnder, type CategoryIndex } from "@/lib/categories";
import { hasText } from "@/components/layout/find-text";

export interface CategoryGroup {
  root: Category;
  /** The categories shown under the group, depth first (levels 2 and 3). */
  kids: Category[];
}

/** Known place names per category id. */
export type PlaceNames = (categoryId: number) => string[] | undefined;

/** True when the category's name or one of its known places holds `query`. */
export function categoryHits(c: Category, query: string, places: PlaceNames): boolean {
  return hasText(c.name, query) || (places(c.id) ?? []).some((p) => hasText(p, query));
}

/** Everything under a category, depth first. */
function descendants(index: CategoryIndex, id: number): Category[] {
  return (index.children.get(id) ?? []).flatMap((c) => [c, ...descendants(index, c.id)]);
}

/** The groups of `kind` the search keeps, in the tree's order. Every group when `query` is empty. */
export function searchCategories(index: CategoryIndex, kind: CategoryKind, query: string, places: PlaceNames): CategoryGroup[] {
  const hits = (id: number) => {
    const c = index.byId.get(id);
    return c !== undefined && categoryHits(c, query, places);
  };
  return index.roots
    .filter((r) => r.kind === kind)
    .flatMap((root) => {
      const kids = descendants(index, root.id);
      if (categoryHits(root, query, places)) return [{ root, kids }];
      // Its own line, anything under it, or what it sits in (the group itself already did not match).
      const shown = kids.filter(
        (c) => idsUnder(index, c.id).some(hits) || ancestorsOf(index, c).some((a) => a.id !== root.id && hits(a.id)),
      );
      return shown.length > 0 ? [{ root, kids: shown }] : [];
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
