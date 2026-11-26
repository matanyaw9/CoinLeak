// Rule order made visible (spec 21, spec 41): per rule, the rows it fits whose
// category or exclusion a higher rule decides (the first match wins per
// action), and the lower rules it overrides: both fit a row and set different
// things. For the editor, the same for a draft, and the rows it would leave as
// they are. A rule's exceptions (spec 35) are rows it neither wins nor fits.
// Reads only; nothing is written.

import type { Rule, RuleInput, RuleOverlap, RulePreview } from "@shared/types";
import type { Db } from "../db";
import { compileRules, loadRows, userSet, type CompiledRule } from "./engine";
import { compileMatcher, prepareRow, type PreparedRow } from "./match";
import { loadExceptions } from "./store";

type Action = RuleOverlap["action"];

interface Tally {
  count: number;
  winners: Set<number>;
}

/** What one rule overrides: the lower rules, and the rows where it does. */
interface Overriding {
  losers: Set<number>;
  rows: Set<number>;
}

export type RuleHints = Pick<Rule, "overlaps" | "overrides">;

/**
 * Per rule id, its hints. `overlaps` are in rule order, category first, then
 * exclude. Only rules with something to say have an entry.
 */
export function ruleOverlaps(db: Db, rules: Rule[]): Map<number, RuleHints> {
  const compiled = compileRules(rules, loadExceptions(db));
  const tallies = new Map<number, Map<Action, Tally>>();
  const overriding = new Map<number, Overriding>();
  const record = (loser: CompiledRule, winner: CompiledRule, action: Action, rowId: number) => {
    const byAction = tallies.get(loser.id) ?? new Map<Action, Tally>();
    const tally = byAction.get(action) ?? { count: 0, winners: new Set<number>() };
    tally.count++;
    tally.winners.add(winner.id);
    byAction.set(action, tally);
    tallies.set(loser.id, byAction);

    const field = action === "category" ? "setCategoryId" : "setExcluded";
    if (winner[field] === loser[field]) return; // They agree: no contradiction.
    const over = overriding.get(winner.id) ?? { losers: new Set<number>(), rows: new Set<number>() };
    over.losers.add(loser.id);
    over.rows.add(rowId);
    overriding.set(winner.id, over);
  };

  for (const row of loadRows(db, "all")) {
    const user = userSet(row);
    const facts = factsOf(row);
    let categoryWinner: CompiledRule | null = null;
    let excludeWinner: CompiledRule | null = null;
    for (const rule of compiled) {
      const wantsCategory = !user.category && rule.setCategoryId !== null;
      const wantsExclude = !user.excluded && rule.setExcluded !== null;
      if (!(wantsCategory || wantsExclude) || rule.skips.has(row.id) || !rule.matches(facts)) continue;
      if (wantsCategory) {
        if (categoryWinner === null) categoryWinner = rule;
        else record(rule, categoryWinner, "category", row.id);
      }
      if (wantsExclude) {
        if (excludeWinner === null) excludeWinner = rule;
        else record(rule, excludeWinner, "exclude", row.id);
      }
    }
  }

  const out = new Map<number, RuleHints>();
  for (const [id, byAction] of tallies) {
    const overlaps: RuleOverlap[] = [];
    for (const action of ["category", "exclude"] as const) {
      const t = byAction.get(action);
      if (!t) continue;
      const winnerId = t.winners.size === 1 ? ([...t.winners][0] ?? null) : null;
      overlaps.push({ action, count: t.count, winnerId, winnerNames: namesOf(rules, t.winners) });
    }
    out.set(id, { overlaps });
  }
  for (const [id, over] of overriding) {
    out.set(id, { ...out.get(id), overrides: { names: namesOf(rules, over.losers), rows: over.rows.size } });
  }
  return out;
}

/** What the editor's preview learns about the rows a draft rule fits. */
export interface DraftReach {
  /** Rows where a higher rule sets first something the draft would set. */
  decidedHigher: number;
  /** The higher rules that decide them, in rule order. */
  higherNames: string[];
  /** Per lower rule the draft contradicts, in rule order, on how many rows. */
  overrides: NonNullable<RulePreview["overrides"]>;
  /** Rows the draft leaves as they are: the user sorted them into its category or one inside it. */
  alreadyHere: Set<number>;
  /** Rows the draft leaves as they are because higher rules decide all it would set. */
  higherRule: Set<number>;
  /** Rows an ignore (or always count) draft leaves as they are: the user ignored or counted them by hand. */
  setByYou: Set<number>;
}

/**
 * For the editor's preview, over the rows `draft` fits: how many a higher
 * rule decides, which lower rules the draft overrides, and which rows it would
 * not change at all (wave 14 review), so they show without a tick box.
 * `inside` is the draft's category and everything under it. `ruleId` is the
 * saved rule being edited, if any: its own exceptions are skipped and keep
 * their tick box.
 */
export function draftReach(
  db: Db,
  draft: Pick<RuleInput, "join" | "conditions" | "setCategoryId" | "setExcluded">,
  { higher, lower }: { higher: Rule[]; lower: Rule[] },
  inside: Set<number>,
  ruleId?: number,
): DraftReach {
  const matches = compileMatcher(draft);
  const exceptions = loadExceptions(db);
  const above = compileRules(higher, exceptions);
  const below = compileRules(lower, exceptions);
  const own = (ruleId === undefined ? undefined : exceptions.get(ruleId)) ?? new Set<number>();
  const draftExcluded = draft.setExcluded === null ? null : draft.setExcluded ? 1 : 0;
  const winners = new Set<number>();
  const overridden = new Map<number, number>();
  const out: DraftReach = {
    decidedHigher: 0,
    higherNames: [],
    overrides: [],
    alreadyHere: new Set(),
    higherRule: new Set(),
    setByYou: new Set(),
  };
  for (const row of loadRows(db, "all")) {
    const facts = factsOf(row);
    if (own.has(row.id) || !matches(facts)) continue;
    const user = userSet(row);
    const fits = (r: CompiledRule) => !r.skips.has(row.id) && r.matches(facts);
    const aboveCategory = above.find((r) => r.setCategoryId !== null && fits(r));
    const aboveExclude = above.find((r) => r.setExcluded !== null && fits(r));
    const higherCategory = draft.setCategoryId !== null && !user.category ? aboveCategory : undefined;
    const higherExclude = draft.setExcluded !== null && !user.excluded ? aboveExclude : undefined;
    if (higherCategory) winners.add(higherCategory.id);
    if (higherExclude) winners.add(higherExclude.id);
    if (higherCategory || higherExclude) out.decidedHigher++;

    // Sorted by hand into the draft's category or one inside it: the draft
    // never moves it. Sorted by hand elsewhere, it moves when ticked (F45).
    const here = draft.setCategoryId !== null && user.category && row.category_id !== null && inside.has(row.category_id);
    const setsCategory = draft.setCategoryId !== null && (user.category ? !here : !higherCategory);
    const setsExclude = draft.setExcluded !== null && !user.excluded && !higherExclude;

    // Contradictions: what the draft would decide here, a lower rule sets otherwise.
    const winsCategory = setsCategory && !aboveCategory;
    for (const r of below) {
      const otherCategory = winsCategory && r.setCategoryId !== null && r.setCategoryId !== draft.setCategoryId;
      const otherExclude = setsExclude && r.setExcluded !== null && r.setExcluded !== draftExcluded;
      if ((otherCategory || otherExclude) && fits(r)) overridden.set(r.id, (overridden.get(r.id) ?? 0) + 1);
    }

    if (setsCategory || setsExclude) continue;
    if (higherCategory || higherExclude) out.higherRule.add(row.id);
    else if (here) out.alreadyHere.add(row.id);
    else if (draft.setExcluded !== null && user.excluded) out.setByYou.add(row.id);
  }
  out.higherNames = namesOf(higher, winners);
  out.overrides = lower.flatMap((r) => {
    const rows = overridden.get(r.id);
    return rows ? [{ name: r.name, rows }] : [];
  });
  return out;
}

/** The names of the rules in `ids`, in rule order. */
function namesOf(rules: Rule[], ids: Set<number>): string[] {
  return rules.filter((r) => ids.has(r.id)).map((r) => r.name);
}

function factsOf(row: { account_id: number; amount: number; description: string; memo: string | null }): PreparedRow {
  return prepareRow({ accountId: row.account_id, amount: row.amount, description: row.description, memo: row.memo });
}
