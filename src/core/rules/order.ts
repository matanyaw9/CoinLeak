// Rule order made visible (spec 21): per rule, the rows it fits whose
// category or exclusion a higher rule decides, since the first match wins
// per action. Reads only; nothing is written.

import type { RuleInput, RuleOverlap } from "@shared/types";
import type { Db } from "../db";
import { compileRules, loadRows, userSet, type RuleLike } from "./engine";
import { compileMatcher, prepareRow, type PreparedRow } from "./match";

type Action = RuleOverlap["action"];

interface Tally {
  count: number;
  winners: Set<number>;
}

/** Per rule id, its overlaps in rule order: category first, then exclude. Only rules with any. */
export function ruleOverlaps(db: Db, rules: RuleLike[]): Map<number, RuleOverlap[]> {
  const compiled = compileRules(rules);
  const tallies = new Map<number, Map<Action, Tally>>();
  const record = (id: number, action: Action, winner: number) => {
    const byAction = tallies.get(id) ?? new Map<Action, Tally>();
    const tally = byAction.get(action) ?? { count: 0, winners: new Set<number>() };
    tally.count++;
    tally.winners.add(winner);
    byAction.set(action, tally);
    tallies.set(id, byAction);
  };

  for (const row of loadRows(db, "all")) {
    const user = userSet(row);
    const facts = factsOf(row);
    let categoryWinner: number | null = null;
    let excludeWinner: number | null = null;
    for (const rule of compiled) {
      const wantsCategory = !user.category && rule.setCategoryId !== null;
      const wantsExclude = !user.excluded && rule.setExcluded !== null;
      if (!(wantsCategory || wantsExclude) || !rule.matches(facts)) continue;
      if (wantsCategory) {
        if (categoryWinner === null) categoryWinner = rule.id;
        else record(rule.id, "category", categoryWinner);
      }
      if (wantsExclude) {
        if (excludeWinner === null) excludeWinner = rule.id;
        else record(rule.id, "exclude", excludeWinner);
      }
    }
  }

  const out = new Map<number, RuleOverlap[]>();
  for (const [id, byAction] of tallies) {
    const list: RuleOverlap[] = [];
    for (const action of ["category", "exclude"] as const) {
      const t = byAction.get(action);
      if (t) list.push({ action, count: t.count, winnerId: t.winners.size === 1 ? ([...t.winners][0] ?? null) : null });
    }
    out.set(id, list);
  }
  return out;
}

/**
 * For the editor's preview: rows `draft` fits where one of `higher` sets
 * the same action first, so the draft would not decide them.
 */
export function decidedHigher(
  db: Db,
  draft: Pick<RuleInput, "join" | "conditions" | "setCategoryId" | "setExcluded">,
  higher: RuleLike[],
): number {
  const matches = compileMatcher(draft);
  const compiled = compileRules(higher);
  let count = 0;
  for (const row of loadRows(db, "all")) {
    const facts = factsOf(row);
    if (!matches(facts)) continue;
    const user = userSet(row);
    const wantsCategory = draft.setCategoryId !== null && !user.category;
    const wantsExclude = draft.setExcluded !== null && !user.excluded;
    const won = compiled.some(
      (r) =>
        ((wantsCategory && r.setCategoryId !== null) || (wantsExclude && r.setExcluded !== null)) && r.matches(facts),
    );
    if (won) count++;
  }
  return count;
}

function factsOf(row: { account_id: number; amount: number; description: string; memo: string | null }): PreparedRow {
  return prepareRow({ accountId: row.account_id, amount: row.amount, description: row.description, memo: row.memo });
}
