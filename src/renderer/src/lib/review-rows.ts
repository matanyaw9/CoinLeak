// What the row menu acts on and the calls it makes (trash, restore, ignore),
// each returning its Undo. Plus when to offer a rule after a hand
// categorization, and when a row shows its rule chip. No React here.

import type { Category, ExcludedSource, RuleInput, TransactionRow } from "@shared/types";
import { call } from "./api";

/** The clicked row, or the whole selection when the clicked row is in it. */
export function menuTargets(row: TransactionRow, selected: ReadonlySet<number>, rows: TransactionRow[]): TransactionRow[] {
  if (!selected.has(row.id)) return [row];
  return rows.filter((r) => selected.has(r.id));
}

/** "Count again" when every target is already ignored, else "Ignore". */
export const allIgnored = (rows: TransactionRow[]): boolean => rows.length > 0 && rows.every((r) => r.excluded);

export async function trashRows(ids: number[]): Promise<{ updated: number; undo: () => Promise<unknown> }> {
  const { updated } = await call("transactions:trash", { ids });
  return { updated, undo: () => call("transactions:restore", { ids }) };
}

export async function restoreRows(ids: number[]): Promise<{ updated: number; undo: () => Promise<unknown> }> {
  const { updated } = await call("transactions:restore", { ids });
  return { updated, undo: () => call("transactions:trash", { ids }) };
}

/**
 * Sets `excluded` on the rows that differ. Undo puts back each row's
 * exclusion and who set it, exactly as it was (spec 13), so a row a rule
 * excluded or left alone goes back to the rules.
 */
export async function setIgnored(
  rows: TransactionRow[],
  excluded: boolean,
): Promise<{ updated: number; undo: () => Promise<unknown> }> {
  const ids = rows.filter((r) => r.excluded !== excluded).map((r) => r.id);
  if (ids.length === 0) return { updated: 0, undo: () => Promise.resolve() };
  const { updated, before } = await call("transactions:update", { ids, patch: { excluded } });
  const undo = async () => {
    if (!before) return call("transactions:update", { ids, patch: { excluded: !excluded } });
    const groups = new Map<string, number[]>();
    for (const b of before) {
      const key = JSON.stringify([b.excluded, b.excludedSource]);
      groups.set(key, [...(groups.get(key) ?? []), b.id]);
    }
    for (const [key, group] of groups) {
      const [was, source] = JSON.parse(key) as [boolean, ExcludedSource | null];
      await call("transactions:update", { ids: group, patch: { excluded: was, excludedSource: source } });
    }
  };
  return { updated, undo };
}

/** A draft rule from these rows; with `category`, one that sets it. */
export async function suggestFor(ids: number[], category?: Category): Promise<RuleInput> {
  const draft = await call("rules:suggest", { ids });
  return category ? { ...draft, setCategoryId: category.id } : draft;
}

// ---- "Always put X in Y?" after a hand categorization ----

const offered = new Set<string>();

const merchantKey = (description: string): string => description.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * True once per merchant per window session, and only for a row the user
 * sorted by hand into a category: not when a rule had sorted it, and not
 * when the category was cleared. Remembers the merchant when it says yes.
 */
export function shouldOfferRule(row: TransactionRow, category: Category | null): boolean {
  if (!category || row.categorySource === "rule" || row.categoryId === category.id) return false;
  const key = merchantKey(row.description);
  if (!key || offered.has(key)) return false;
  offered.add(key);
  return true;
}

/** For tests: forget which merchants were offered. */
export function resetOffers(): void {
  offered.clear();
}

/** The rule that sorted or excluded this row, when a rule did. */
export function ruleChipId(row: TransactionRow): number | null {
  if (row.ruleId == null) return null;
  return row.categorySource === "rule" || row.excluded ? row.ruleId : null;
}
