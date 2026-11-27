// The category list, and the editor's writes: create, rename, recolor, move
// anywhere in the tree, and delete (refused while in use unless its rows and
// rules move first). The three-level and same-kind rules are database triggers
// (0015); core checks them first so the window gets a fixed problem code, never
// SQL text. The old Routine / Treats column (`essential`) is left alone (spec 34).

import type {
  Category,
  CategoryChange,
  CategoryDeleteResult,
  CategoryInput,
  CategoryKind,
  CategoryPatch,
  CategoryProblem,
} from "@shared/types";
import { transaction, type Db } from "../db";
import { check, isId } from "./validate";

const KINDS: readonly CategoryKind[] = ["expense", "income", "transfer"];
/** Categories nest at most this deep (spec 34): a top-level category is level 1. */
const MAX_LEVELS = 3;
const NAME_MAX = 60;
const EMOJI_MAX = 16;
const COLOR = /^#[0-9A-Fa-f]{6}$/;

interface CategoryRecord {
  id: number;
  parent_id: number | null;
  name: string;
  kind: CategoryKind;
}

const refuse = (problem: CategoryProblem) => ({ ok: false as const, problem });

export function createCategory(db: Db, input: CategoryInput): CategoryChange {
  check(typeof input === "object" && input !== null);
  const name = cleanName(input.name);
  check(KINDS.includes(input.kind));
  check(input.parentId === null || isId(input.parentId));
  const emoji = cleanEmoji(input.emoji);
  const color = cleanColor(input.color);

  return transaction(db, () => {
    if (input.parentId !== null) {
      const problem = parentProblem(db, input.parentId, input.kind, null);
      if (problem) return refuse(problem);
    }
    if (nameTaken(db, input.parentId, name, null)) return refuse("name_taken");
    const id = Number(
      db
        .prepare(
          "INSERT INTO categories (parent_id, name, kind, emoji, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .run(input.parentId, name, input.kind, emoji, color, nextSortOrder(db, input.parentId))
        .lastInsertRowid,
    );
    return { ok: true as const, category: byId(db, id) };
  });
}

export function updateCategory(db: Db, id: number, patch: CategoryPatch): CategoryChange {
  check(isId(id) && typeof patch === "object" && patch !== null);
  const name = patch.name === undefined ? undefined : cleanName(patch.name);
  const emoji = patch.emoji === undefined ? undefined : cleanEmoji(patch.emoji);
  const color = patch.color === undefined ? undefined : cleanColor(patch.color);
  check(patch.parentId === undefined || patch.parentId === null || isId(patch.parentId));

  return transaction(db, () => {
    const current = record(db, id);
    check(current !== undefined);
    const parentId = patch.parentId === undefined ? current.parent_id : patch.parentId;
    const moving = parentId !== current.parent_id;
    if (moving && parentId !== null) {
      check(parentId !== id);
      const problem = parentProblem(db, parentId, current.kind, id);
      if (problem) return refuse(problem);
    }
    if (nameTaken(db, parentId, name ?? current.name, id)) return refuse("name_taken");

    const sets: string[] = [];
    const params: (string | number | null)[] = [];
    const set = (column: string, value: string | number | null) => {
      sets.push(`${column} = ?`);
      params.push(value);
    };
    if (name !== undefined) set("name", name);
    if (emoji !== undefined) set("emoji", emoji);
    if (color !== undefined) set("color", color);
    if (moving) {
      set("parent_id", parentId);
      set("sort_order", nextSortOrder(db, parentId));
    }
    if (sets.length > 0) db.prepare(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`).run(...params, id);
    return { ok: true as const, category: byId(db, id) };
  });
}

/**
 * Deletes a category nothing uses. With `moveTo`, its rows and the rules that
 * set it move to that category (same kind) first; each row keeps who set it.
 * A category with subcategories is never deleted: move them first.
 */
export function deleteCategory(db: Db, id: number, moveTo: number | null = null): CategoryDeleteResult {
  check(isId(id) && (moveTo === null || isId(moveTo)));
  return transaction(db, () => {
    const current = record(db, id);
    check(current !== undefined);
    if (hasChildren(db, id)) return refuse("has_children");
    const rows = count(db, "SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?", id);
    const rules = count(db, "SELECT COUNT(*) AS n FROM rules WHERE set_category_id = ?", id);

    let movedRows = 0;
    let movedRules = 0;
    if (rows + rules > 0) {
      if (moveTo === null) return refuse("in_use");
      check(moveTo !== id);
      const target = record(db, moveTo);
      check(target !== undefined);
      if (target.kind !== current.kind) return refuse("target_other_kind");
      const now = new Date().toISOString();
      movedRows = Number(
        db.prepare("UPDATE transactions SET category_id = ?, updated_at = ? WHERE category_id = ?").run(moveTo, now, id)
          .changes,
      );
      movedRules = Number(
        db.prepare("UPDATE rules SET set_category_id = ?, updated_at = ? WHERE set_category_id = ?").run(moveTo, now, id)
          .changes,
      );
    }
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    return { ok: true as const, movedRows, movedRules };
  });
}

// ---- Checks ----

function cleanName(value: unknown): string {
  check(typeof value === "string");
  const name = value.trim().replace(/\s+/g, " ");
  check(name.length > 0 && name.length <= NAME_MAX);
  return name;
}

function cleanEmoji(value: unknown): string | null {
  if (value === null) return null;
  check(typeof value === "string");
  const emoji = value.trim();
  check(emoji.length <= EMOJI_MAX);
  return emoji === "" ? null : emoji;
}

function cleanColor(value: unknown): string | null {
  if (value === null) return null;
  check(typeof value === "string" && COLOR.test(value));
  return value.toUpperCase();
}

/**
 * The database's tree rules (0015) as a fixed code: the parent has the same
 * kind, is not the moved category's own subcategory, and the category (with
 * everything under it, when `moving` is its id) still fits in three levels.
 */
function parentProblem(db: Db, parentId: number, kind: CategoryKind, moving: number | null): CategoryProblem | null {
  const parent = record(db, parentId);
  check(parent !== undefined);
  if (parent.kind !== kind) return "parent_other_kind";
  const above = ancestorsOf(db, parentId);
  if (moving !== null && above.includes(moving)) return "parent_is_descendant";
  // The parent sits at level above.length + 1; the branch's lowest level is that plus its height.
  const height = moving === null ? 1 : heightOf(db, moving);
  if (above.length + 1 + height > MAX_LEVELS) return "too_deep";
  return null;
}

/** The ids above a category, nearest first. */
function ancestorsOf(db: Db, id: number): number[] {
  const out: number[] = [];
  let parentId = record(db, id)?.parent_id ?? null;
  while (parentId !== null && out.length < MAX_LEVELS) {
    out.push(parentId);
    parentId = record(db, parentId)?.parent_id ?? null;
  }
  return out;
}

/** How many levels a category spans with everything under it: 1 when it has no children. */
function heightOf(db: Db, id: number): number {
  const children = db.prepare("SELECT id FROM categories WHERE parent_id = ?").all(id) as { id: number }[];
  return 1 + Math.max(0, ...children.map((c) => heightOf(db, c.id)));
}

function nameTaken(db: Db, parentId: number | null, name: string, self: number | null): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM categories WHERE COALESCE(parent_id, 0) = ? AND name = ? COLLATE NOCASE AND id IS NOT ? LIMIT 1",
    )
    .get(parentId ?? 0, name, self);
  return row !== undefined;
}

function hasChildren(db: Db, id: number): boolean {
  return count(db, "SELECT COUNT(*) AS n FROM categories WHERE parent_id = ?", id) > 0;
}

// ---- Reads ----

/**
 * Expense before income; depth first, so each category is followed by its
 * children, each child by its own children (spec 34). Top-level categories
 * go by sort order then id, the ones under them by sort order then name.
 */
export function listCategories(db: Db): Category[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.parent_id, c.name, c.kind, c.emoji, c.color, c.archived,
         (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS row_count,
         (SELECT COUNT(*) FROM rules r WHERE r.set_category_id = c.id) AS rule_count
       FROM categories c
       ORDER BY c.kind = 'income', c.sort_order, CASE WHEN c.parent_id IS NULL THEN c.id END, c.name`,
    )
    .all() as {
    id: number;
    parent_id: number | null;
    name: string;
    kind: Category["kind"];
    emoji: string | null;
    color: string | null;
    archived: number;
    row_count: number;
    rule_count: number;
  }[];
  // Siblings keep the query's order; walking from the top puts each one's children right after it.
  const childrenOf = new Map<number | null, typeof rows>();
  for (const r of rows) childrenOf.set(r.parent_id, [...(childrenOf.get(r.parent_id) ?? []), r]);
  const ordered: typeof rows = [];
  const walk = (parentId: number | null): void => {
    for (const r of childrenOf.get(parentId) ?? []) {
      ordered.push(r);
      walk(r.id);
    }
  };
  walk(null);

  return ordered.map((r) => ({
    id: r.id,
    parentId: r.parent_id,
    name: r.name,
    kind: r.kind,
    emoji: r.emoji,
    color: r.color,
    archived: r.archived === 1,
    rowCount: r.row_count,
    ruleCount: r.rule_count,
  }));
}

function record(db: Db, id: number): CategoryRecord | undefined {
  return db.prepare("SELECT id, parent_id, name, kind FROM categories WHERE id = ?").get(id) as
    | CategoryRecord
    | undefined;
}

function byId(db: Db, id: number): Category {
  const found = listCategories(db).find((c) => c.id === id);
  check(found !== undefined);
  return found;
}

function nextSortOrder(db: Db, parentId: number | null): number {
  const row = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM categories WHERE parent_id IS ?")
    .get(parentId) as { n: number };
  return row.n;
}

function count(db: Db, sql: string, id: number): number {
  return (db.prepare(sql).get(id) as { n: number }).n;
}
