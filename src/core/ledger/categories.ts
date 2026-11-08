// The categories editor's writes: create, rename, recolor, move between top-level
// categories, and delete (refused while in use unless its rows and rules move
// first). The two-level and same-kind rules are database triggers (0002); core
// checks them first so the window gets a fixed problem code, never SQL text.

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
import { listCategories } from "./queries";
import { check, isId } from "./validate";

const KINDS: readonly CategoryKind[] = ["expense", "income", "transfer"];
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
      const problem = parentProblem(db, input.parentId, input.kind);
      if (problem) return refuse(problem);
    }
    if (nameTaken(db, input.parentId, name, null)) return refuse("name_taken");
    const id = Number(
      db
        .prepare("INSERT INTO categories (parent_id, name, kind, emoji, color, sort_order) VALUES (?, ?, ?, ?, ?, ?)")
        .run(input.parentId, name, input.kind, emoji, color, nextSortOrder(db, input.parentId)).lastInsertRowid,
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
      const problem = parentProblem(db, parentId, current.kind);
      if (problem) return refuse(problem);
      if (hasChildren(db, id)) return refuse("has_children");
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
 * A top-level category with subcategories is never deleted: move them first.
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

/** The database's two-level and same-kind rule, as a fixed code. */
function parentProblem(db: Db, parentId: number, kind: CategoryKind): CategoryProblem | null {
  const parent = record(db, parentId);
  check(parent !== undefined);
  if (parent.parent_id !== null) return "parent_not_top_level";
  if (parent.kind !== kind) return "parent_other_kind";
  return null;
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
