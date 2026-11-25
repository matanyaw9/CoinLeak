// Rule order made visible (spec 21): per rule, the rows it fits whose
// category or exclusion a higher rule decides, since the first match wins
// per action, and for the editor which rows a draft would leave as they
// are. A rule's exceptions (spec 35) are rows it neither wins nor fits.
// Reads only; nothing is written.

import type { RuleInput, RuleOverlap } from "@shared/types";
import type { Db } from "../db";
import { compileRules, loadRows, userSet, type RuleLike } from "./engine";
import { compileMatcher, prepareRow, type PreparedRow } from "./match";
import { loadExceptions } from "./store";

type Action = RuleOverlap["action"];

interface Tally {
  count: number;
  winners: Set<number>;
}

/** Per rule id, its overlaps in rule order: category first, then exclude. Only rules with any. */
export function ruleOverlaps(db: Db, rules: RuleLike[]): Map<number, RuleOverlap[]> {
  const compiled = compileRules(rules, loadExceptions(db));
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
      if (!(wantsCategory || wantsExclude) || rule.skips.has(row.id) || !rule.matches(facts)) continue;
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

/** What the editor's preview learns about the rows a draft rule fits. */
export interface DraftReach {
  /** Rows where a higher rule sets first something the draft would set. */
  decidedHigher: number;
  /** Rows the draft leaves as they are: the user sorted them into its category or one inside it. */
  alreadyHere: Set<number>;
  /** Rows the draft leaves as they are because higher rules decide all it would set. */
  higherRule: Set<number>;
}

/**
 * For the editor's preview, over the rows `draft` fits: how many a higher
 * rule decides, and which the draft would not change at all (wave 14
 * review), so they show without a tick box. `inside` is the draft's
 * category and everything under it. `ruleId` is the saved rule being
 * edited, if any: its own exceptions are skipped and keep their tick box.
 */
export function draftReach(
  db: Db,
  draft: Pick<RuleInput, "join" | "conditions" | "setCategoryId" | "setExcluded">,
  higher: RuleLike[],
  inside: Set<number>,
  ruleId?: number,
): DraftReach {
  const matches = compileMatcher(draft);
  const exceptions = loadExceptions(db);
  const compiled = compileRules(higher, exceptions);
  const own = (ruleId === undefined ? undefined : exceptions.get(ruleId)) ?? new Set<number>();
  const out: DraftReach = { decidedHigher: 0, alreadyHere: new Set(), higherRule: new Set() };
  for (const row of loadRows(db, "all")) {
    const facts = factsOf(row);
    if (own.has(row.id) || !matches(facts)) continue;
    const user = userSet(row);
    const higherSets = (field: "setCategoryId" | "setExcluded") =>
      compiled.some((r) => r[field] !== null && !r.skips.has(row.id) && r.matches(facts));
    const higherCategory = draft.setCategoryId !== null && !user.category && higherSets("setCategoryId");
    const higherExclude = draft.setExcluded !== null && !user.excluded && higherSets("setExcluded");
    if (higherCategory || higherExclude) out.decidedHigher++;

    // Sorted by hand into the draft's category or one inside it: the draft
    // never moves it. Sorted by hand elsewhere, it moves when ticked (F45).
    const here = draft.setCategoryId !== null && user.category && row.category_id !== null && inside.has(row.category_id);
    const setsCategory = draft.setCategoryId !== null && (user.category ? !here : !higherCategory);
    const setsExclude = draft.setExcluded !== null && !user.excluded && !higherExclude;
    if (setsCategory || setsExclude) continue;
    if (higherCategory || higherExclude) out.higherRule.add(row.id);
    else if (here) out.alreadyHere.add(row.id);
  }
  return out;
}

function factsOf(row: { account_id: number; amount: number; description: string; memo: string | null }): PreparedRow {
  return prepareRow({ accountId: row.account_id, amount: row.amount, description: row.description, memo: row.memo });
}
