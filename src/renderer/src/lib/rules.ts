// Small rule helpers for the rules screens: a listed rule as input again, and
// moving a rule in the order (spec 21: and where it landed). No React here.

import type { Rule, RuleInput } from "@shared/types";

export function toInput(rule: Rule): RuleInput {
  const { id, position, overlaps, overrides, ...input } = rule;
  void id;
  void position;
  void overlaps;
  void overrides;
  return input;
}

/** `ids` with the rule at `from` moved to index `to`. */
export function moveId(ids: number[], from: number, to: number): number[] {
  const next = [...ids];
  const [id] = next.splice(from, 1);
  if (id === undefined) return ids;
  next.splice(Math.max(0, Math.min(to, next.length)), 0, id);
  return next;
}

/**
 * spec 21: where rule `id` sits in the new order `ids`, 1 first, and the
 * rule now right below it (null when it is last), for "moved" toasts.
 */
export function placeAfterMove(ids: number[], id: number): { place: number; nextId: number | null } {
  const at = ids.indexOf(id);
  return { place: at + 1, nextId: ids[at + 1] ?? null };
}
