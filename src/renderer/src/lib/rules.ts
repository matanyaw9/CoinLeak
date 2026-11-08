// Calls the rules screens make beyond a single channel: putting a deleted
// rule back where it was, and moving a rule in the order. No React here.

import type { Rule, RuleInput } from "@shared/types";
import { call } from "./api";

export function toInput(rule: Rule): RuleInput {
  const { id, position, ...input } = rule;
  void id;
  void position;
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

/** Undo for a delete: the rule comes back as new, then moves to its old place. */
export async function restoreRule(rule: Rule): Promise<Rule> {
  const created = await call("rules:create", toInput(rule));
  const others = (await call("rules:list", undefined)).map((r) => r.id).filter((id) => id !== created.id);
  const ids = [...others];
  ids.splice(Math.min(rule.position - 1, others.length), 0, created.id);
  if (ids.at(-1) !== created.id) await call("rules:reorder", { ids });
  return created;
}
