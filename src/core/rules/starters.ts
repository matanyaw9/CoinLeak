// Offering the starter lists (spec 13): which lists fit this ledger, what
// each would sort, and adding the ones the user picks as ordinary list rules.
// Only seeded categories still under their seeded name and parent count, so
// a category the user renamed or removed is skipped. Nothing is added unless
// `addStarters` is called.

import type { StarterPreview, StartersAdded } from "@shared/types";
import { transaction, type Db } from "../db";
import { check } from "../ledger/validate";
import { runRules, wouldCategorize, type RuleLike, type StoredRow } from "./engine";
import { compileMatcher, normalizeText, prepareRow } from "./match";
import { appendPlaces, loadListRules } from "./places";
import { STARTER_LISTS, type StarterData } from "./starter-places";
import { loadRules } from "./store";

interface Offer {
  data: StarterData;
  categoryId: number;
  /** Names no list rule has yet. */
  names: string[];
}

export function starterPreview(db: Db): StarterPreview {
  const offers = findOffers(db);
  const target = new Map<number, number>();
  const rules: RuleLike[] = loadRules(db).map((r) => ({ ...r }));
  const lists = loadListRules(db);
  let standIn = 0;
  // The names go to the category's first list rule, or to one made for them,
  // which sits last in the order: the same rules `addStarters` would leave.
  for (const offer of offers) {
    let ruleId = target.get(offer.categoryId) ?? lists.find((l) => l.categoryId === offer.categoryId)?.rule.id;
    if (ruleId === undefined) {
      ruleId = --standIn;
      rules.push(listRule(ruleId, offer.categoryId, []));
    }
    target.set(offer.categoryId, ruleId);
    const at = rules.findIndex((r) => r.id === ruleId);
    const rule = rules[at] as RuleLike;
    const [c] = rule.conditions;
    if (c?.kind === "text") rules[at] = { ...rule, conditions: [{ ...c, values: [...c.values, ...offer.names] }] };
  }

  const changes = wouldCategorize(db, rules);
  const sorted = (offer: Offer): StoredRow[] => {
    const fits = compileMatcher(listRule(0, offer.categoryId, offer.names));
    return (changes.get(target.get(offer.categoryId) ?? 0) ?? []).filter((r) =>
      fits(prepareRow({ accountId: r.account_id, amount: r.amount, description: r.description, memo: r.memo })),
    );
  };
  const all = new Set<number>();
  const out = offers.map((offer) => {
    const rows = sorted(offer);
    rows.forEach((r) => all.add(r.id));
    return { key: offer.data.key, categoryId: offer.categoryId, names: offer.names, sorts: rows.length };
  });
  return { lists: out, sorts: all.size };
}

/** Adds the chosen lists to their categories' list rules (made when missing), then reapplies. */
export function addStarters(db: Db, args: { keys: unknown }, now = new Date()): StartersAdded {
  check(typeof args === "object" && args !== null);
  const { keys } = args;
  check(Array.isArray(keys) && keys.every((k) => typeof k === "string"));
  return transaction(db, () => {
    const chosen = findOffers(db).filter((o) => keys.includes(o.data.key));
    const byCategory = new Map<number, string[]>();
    for (const o of chosen) byCategory.set(o.categoryId, [...(byCategory.get(o.categoryId) ?? []), ...o.names]);
    const at = now.toISOString();
    let rules = 0;
    for (const [categoryId, names] of byCategory) {
      if (appendPlaces(db, categoryId, names, at).added > 0) rules++;
    }
    const { changed } = runRules(db, "all", now);
    return { rules, changed };
  });
}

function findOffers(db: Db): Offer[] {
  const known = new Set(loadListRules(db).flatMap((l) => l.values.map(normalizeText)));
  const offers: Offer[] = [];
  for (const data of STARTER_LISTS) {
    const categoryId = seededCategory(db, data);
    if (categoryId === null) continue;
    const names = data.names.filter((n) => {
      const key = normalizeText(n);
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    if (names.length > 0) offers.push({ data, categoryId, names });
  }
  return offers;
}

/** The seeded category when it still has its seeded name and parent, and is not archived. */
function seededCategory(db: Db, data: StarterData): number | null {
  const row = db
    .prepare(
      `SELECT c.id FROM categories c JOIN categories p ON p.id = c.parent_id
       WHERE c.name = ? AND p.name = ? AND p.parent_id IS NULL AND c.archived = 0 AND p.archived = 0`,
    )
    .get(data.category, data.parent) as { id: number } | undefined;
  return row?.id ?? null;
}

function listRule(id: number, categoryId: number, names: string[]): RuleLike {
  return {
    id,
    enabled: true,
    join: "all",
    conditions: [{ kind: "text", field: "description", mode: "contains", values: names }],
    setCategoryId: categoryId,
    setExcluded: null,
  };
}
