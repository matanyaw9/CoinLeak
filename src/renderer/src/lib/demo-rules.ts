// The rules engine for demo builds only: checks, matching, applying, known
// places, starter lists and every `rules:*` channel, written to behave like
// src/core/rules so screenshots show what the real app does. Real builds
// never load it; core owns the real logic.

import type {
  Agorot,
  Category,
  CategorySource,
  KnownPlaces,
  Rule,
  RuleCondition,
  RuleDirection,
  RuleInput,
  RuleJoin,
  RuleMatchField,
  RuleMatchMode,
  StarterList,
  TransactionRow,
} from "@shared/types";
import type { Args, Channel } from "@shared/ipc";
import { ERROR_MESSAGES, type Result } from "@shared/errors";

type Conditions = Pick<RuleInput, "join" | "conditions">;

/** The fields of a demo row that rules read and write. */
export interface RuleTarget {
  id: number;
  accountId: number;
  amount: Agorot;
  description: string;
  memo: string | null;
  categoryId: number | null;
  categorySource: CategorySource | null;
  excluded: boolean;
  excludedSource: "user" | "rule" | null;
  ruleId: number | null;
}

const MAX_TEXT = 200;
const MAX_NAME = 100;
const MAX_CONDITIONS = 20;
const MAX_VALUES = 200;
const FIELDS: readonly RuleMatchField[] = ["description", "memo"];
const MODES: readonly RuleMatchMode[] = ["contains", "starts_with", "equals", "regex"];
const JOINS: readonly RuleJoin[] = ["all", "any"];
// Invisible marks banks put around Hebrew and digits, as in core.
const DIRECTION_MARKS = /[؜‎‏‪-‮⁦-⁩]/g;

export const cleanText = (text: string) => text.replace(DIRECTION_MARKS, "").replace(/\s+/g, " ").trim();
const normalize = (text: string) => cleanText(text).toLowerCase();

function compileRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return null;
  }
}

const isId = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
const isAmount = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

// ---- Checks, as in core's validate.ts; null means BAD_REQUEST ----

function cleanCondition(input: unknown, accountIds: ReadonlySet<number>): RuleCondition | null {
  if (typeof input !== "object" || input === null) return null;
  const c = input as Record<string, unknown>;
  if (c.kind === "account") return isId(c.accountId) && accountIds.has(c.accountId) ? { kind: "account", accountId: c.accountId } : null;
  if (c.kind === "direction") {
    return c.direction === "in" || c.direction === "out" ? { kind: "direction", direction: c.direction as RuleDirection } : null;
  }
  if (c.kind === "amount") {
    const min = c.min === null ? null : isAmount(c.min) ? c.min : undefined;
    const max = c.max === null ? null : isAmount(c.max) ? c.max : undefined;
    if (min === undefined || max === undefined || (min === null && max === null)) return null;
    if (min !== null && max !== null && min > max) return null;
    return { kind: "amount", min, max };
  }
  if (c.kind !== "text") return null;
  if (!FIELDS.includes(c.field as RuleMatchField) || !MODES.includes(c.mode as RuleMatchMode)) return null;
  if (!Array.isArray(c.values) || c.values.length === 0 || c.values.length > MAX_VALUES) return null;
  const mode = c.mode as RuleMatchMode;
  const values: string[] = [];
  const seen = new Set<string>();
  for (const raw of c.values as unknown[]) {
    if (typeof raw !== "string") return null;
    const value = mode === "regex" ? raw : cleanText(raw);
    if (value.trim() === "" || value.length > MAX_TEXT) return null;
    if (mode === "regex" && !compileRegex(value)) return null;
    const key = mode === "regex" ? value : normalize(value);
    if (seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  return { kind: "text", field: c.field as RuleMatchField, mode, values };
}

/** Same checks as core's `cleanConditions`. */
export function cleanConditions(input: unknown, accountIds: ReadonlySet<number>): Conditions | null {
  if (typeof input !== "object" || input === null) return null;
  const r = input as Partial<Record<keyof RuleInput, unknown>>;
  if (!JOINS.includes(r.join as RuleJoin) || !Array.isArray(r.conditions)) return null;
  if (r.conditions.length === 0 || r.conditions.length > MAX_CONDITIONS) return null;
  const conditions = (r.conditions as unknown[]).map((c) => cleanCondition(c, accountIds));
  if (conditions.some((c) => c === null)) return null;
  return { join: r.join as RuleJoin, conditions: conditions as RuleCondition[] };
}

/** Same checks as core's `cleanRuleInput`: a name and at least one action. */
export function cleanRule(input: unknown, accountIds: ReadonlySet<number>, categoryIds: ReadonlySet<number>): RuleInput | null {
  const conditions = cleanConditions(input, accountIds);
  if (!conditions) return null;
  const r = input as Partial<Record<keyof RuleInput, unknown>>;
  if (typeof r.name !== "string" || typeof r.enabled !== "boolean") return null;
  const name = r.name.trim();
  if (name === "" || name.length > MAX_NAME) return null;
  if (!(r.setCategoryId === null || (isId(r.setCategoryId) && categoryIds.has(r.setCategoryId)))) return null;
  if (!(r.setExcluded === null || typeof r.setExcluded === "boolean")) return null;
  if (r.setCategoryId === null && r.setExcluded === null) return null;
  return {
    name,
    enabled: r.enabled,
    ...conditions,
    setCategoryId: r.setCategoryId as number | null,
    setExcluded: r.setExcluded as boolean | null,
  };
}

// ---- Matching and applying, as in core's match.ts and engine.ts ----

type Facts = Pick<RuleTarget, "accountId" | "amount" | "description" | "memo">;

function conditionTest(c: RuleCondition): (row: Facts) => boolean {
  if (c.kind === "account") return (row) => row.accountId === c.accountId;
  if (c.kind === "direction") return (row) => (row.amount > 0 ? "in" : "out") === c.direction;
  if (c.kind === "amount") {
    return (row) => {
      const size = Math.abs(row.amount);
      return (c.min === null || size >= c.min) && (c.max === null || size <= c.max);
    };
  }
  const tests = c.values.map((v): ((text: string) => boolean) => {
    if (c.mode === "regex") {
      const re = compileRegex(v);
      return (text) => re !== null && re.test(text);
    }
    const p = normalize(v);
    if (c.mode === "contains") return (text) => text.includes(p);
    if (c.mode === "starts_with") return (text) => text.startsWith(p);
    return (text) => text === p;
  });
  return (row) => {
    const raw = c.field === "description" ? row.description : row.memo;
    if (raw === null) return false;
    const text = normalize(raw);
    return tests.some((t) => t(text));
  };
}

export function matcher(c: Conditions): (row: Facts) => boolean {
  const tests = c.conditions.map(conditionTest);
  return c.join === "any" ? (row) => tests.some((t) => t(row)) : (row) => tests.every((t) => t(row));
}

type RuleLike = Pick<Rule, "id" | "enabled" | "join" | "conditions" | "setCategoryId" | "setExcluded">;
type Live = { rule: RuleLike; matches: ReturnType<typeof matcher> };

export interface DemoRun {
  /** Ids of rows whose category, exclusion or rule changed. */
  changed: number[];
  /** Per rule id, the rows it sorts now. */
  applied: Map<number, number>;
  /** Rows some rule sorts now. */
  sorted: number;
}

/**
 * For each field, the first enabled matching rule in order sets it. Fields
 * the user set stay; a field a rule set earlier is cleared when no rule
 * matches any more.
 */
export function applyRules(rows: RuleTarget[], rules: RuleLike[]): DemoRun {
  const live = compile(rules);
  const run: DemoRun = { changed: [], applied: new Map(), sorted: 0 };
  for (const row of rows) {
    const before = JSON.stringify([row.categoryId, row.categorySource, row.excluded, row.excludedSource, row.ruleId]);
    const by = decide(row, live);
    by.forEach((id) => run.applied.set(id, (run.applied.get(id) ?? 0) + 1));
    if (by.size > 0) run.sorted++;
    if (JSON.stringify([row.categoryId, row.categorySource, row.excluded, row.excludedSource, row.ruleId]) !== before) {
      run.changed.push(row.id);
    }
  }
  return run;
}

const compile = (rules: RuleLike[]): Live[] => rules.filter((r) => r.enabled).map((r) => ({ rule: r, matches: matcher(r) }));

/** Sets the row's rule fields; returns the ids of the rules that set something. */
function decide(row: RuleTarget, rules: Live[]): Set<number> {
  const userCategory = row.categorySource === "user";
  const userExcluded = row.excludedSource === "user" || (row.excluded && row.excludedSource === null);
  row.ruleId = null;
  if (userCategory && userExcluded) return new Set();
  let categoryRule: RuleLike | undefined;
  let excludedRule: RuleLike | undefined;
  for (const { rule, matches } of rules) {
    const wantsCategory = !userCategory && !categoryRule && rule.setCategoryId !== null;
    const wantsExcluded = !userExcluded && !excludedRule && rule.setExcluded !== null;
    if (!(wantsCategory || wantsExcluded) || !matches(row)) continue;
    if (wantsCategory) categoryRule = rule;
    if (wantsExcluded) excludedRule = rule;
  }
  if (!userCategory) {
    if (categoryRule) {
      row.categoryId = categoryRule.setCategoryId;
      row.categorySource = "rule";
    } else if (row.categorySource === "rule") {
      row.categoryId = null;
      row.categorySource = null;
    }
  }
  if (!userExcluded) {
    if (excludedRule) {
      row.excluded = excludedRule.setExcluded === true;
      row.excludedSource = "rule";
    } else if (row.excludedSource === "rule") {
      row.excluded = false;
      row.excludedSource = null;
    }
  }
  const applied = rules.filter(({ rule }) => rule === categoryRule || rule === excludedRule);
  row.ruleId = applied.at(-1)?.rule.id ?? null;
  return new Set(applied.map(({ rule }) => rule.id));
}

/** Same draft as core's `suggestRule`, from rows in id order. */
export function suggest(rows: Pick<RuleTarget, "accountId" | "amount" | "description" | "categoryId">[]): RuleInput | null {
  if (rows.length === 0) return null;
  const text = commonPrefix(rows.map((r) => cleanText(r.description)));
  const sizes = rows.map((r) => Math.abs(r.amount));
  const accountId = shared(rows.map((r) => r.accountId));
  const conditions: RuleCondition[] = [{ kind: "text", field: "description", mode: "starts_with", values: [text] }];
  if (accountId !== null) conditions.push({ kind: "account", accountId });
  conditions.push({ kind: "amount", min: Math.min(...sizes), max: Math.max(...sizes) });
  return { name: text, enabled: true, join: "all", conditions, setCategoryId: shared(rows.map((r) => r.categoryId)), setExcluded: null };
}

function commonPrefix(texts: string[]): string {
  const chars = texts.map((t) => Array.from(t));
  const first = chars[0] ?? [];
  const same = (a: string | undefined, b: string | undefined) =>
    a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();
  let n = 0;
  while (n < first.length && chars.every((c) => same(c[n], first[n]))) n++;
  let prefix = first.slice(0, n).join("");
  const word = (c: string | undefined) => c !== undefined && /[\p{L}\p{N}]/u.test(c);
  const lastSpace = prefix.lastIndexOf(" ");
  if (word(first[n - 1]) && chars.some((c) => word(c[n])) && lastSpace > 0) prefix = prefix.slice(0, lastSpace);
  return prefix.trim();
}

function shared<T>(values: T[]): T | null {
  const first = values[0];
  return first !== undefined && first !== null && values.every((v) => v === first) ? first : null;
}

// ---- Known places, as in core's places.ts ----

interface ListRule {
  rule: Rule;
  categoryId: number;
  values: string[];
}

function asListRule(rule: Rule): ListRule | null {
  const [c] = rule.conditions;
  if (!rule.enabled || rule.conditions.length !== 1 || c?.kind !== "text") return null;
  if (c.field !== "description" || c.mode === "regex" || rule.setCategoryId === null || rule.setExcluded !== null) return null;
  return { rule, categoryId: rule.setCategoryId, values: c.values };
}

export function knownPlaces(rules: Rule[]): KnownPlaces[] {
  const byCategory = new Map<number, KnownPlaces>();
  for (const list of rules.flatMap((r) => asListRule(r) ?? [])) {
    const entry = byCategory.get(list.categoryId) ?? { categoryId: list.categoryId, names: [], ruleIds: [] };
    const seen = new Set(entry.names.map(normalize));
    for (const v of list.values) {
      if (!seen.has(normalize(v))) entry.names.push(v);
      seen.add(normalize(v));
    }
    entry.ruleIds.push(list.rule.id);
    byCategory.set(list.categoryId, entry);
  }
  return [...byCategory.values()].sort((a, b) => a.categoryId - b.categoryId);
}

// ---- Starter lists for the demo's categories (core has the real data) ----

const DEMO_STARTERS: { key: string; categoryId: number; categoryName: string; names: string[] }[] = [
  { key: "supermarkets", categoryId: 11, categoryName: "Groceries", names: ["שופרסל", "רמי לוי", "יוחננוף", "ויקטורי", "טיב טעם", "AM:PM", "Shufersal", "Rami Levy"] },
  { key: "cafes", categoryId: 13, categoryName: "Coffee & Cafes", names: ["ארומה", "Aroma", "קופיקס", "Cofix", "קפה קפה", "לנדוור", "Landwer"] },
  { key: "restaurants", categoryId: 12, categoryName: "Restaurants", names: ["WOLT", "תן ביס", "10bis", "McDonald"] },
  { key: "fuel", categoryId: 21, categoryName: "Fuel & Parking", names: ["פז", "Paz", "דלק", "סונול", "Sonol", "פנגו", "Pango"] },
  { key: "publicTransport", categoryId: 22, categoryName: "Public Transport", names: ["רב-קו", "Rav-Kav", "מוביט", "Moovit", "רכבת ישראל"] },
  { key: "pharmacies", categoryId: 51, categoryName: "Health", names: ["סופר-פארם", "Super-Pharm", "בי פארם", "מכבי פארם", "Good Pharm"] },
  { key: "telecom", categoryId: 32, categoryName: "Bills & Utilities", names: ["פלאפון", "Pelephone", "פרטנר", "סלקום", "בזק"] },
  { key: "streaming", categoryId: 33, categoryName: "Subscriptions", names: ["Netflix", "Spotify", "Apple.com/bill", "Disney", "YouTube"] },
];

// ---- The rules channels, answered like core: every change reapplies all rules ----

export interface DemoRulesHost {
  /** Every demo row, trashed ones included. */
  rows: () => (RuleTarget & { trashed: boolean })[];
  /** Rows as `transactions:list {}` returns them: not trashed, newest first. */
  listed: () => TransactionRow[];
  accountIds: () => ReadonlySet<number>;
  categories: () => Category[];
  /** Called after rules change rows, so the host can recompute flows. */
  changed: () => void;
}

export interface DemoRules {
  /** The answer when `channel` is a rules channel, else null. */
  answer: (channel: Channel, args: unknown) => Result<unknown> | null;
  /** Reapplies every rule to every row that is not trashed. */
  reapply: () => DemoRun;
}

export function createDemoRules(host: DemoRulesHost, seeds: RuleInput[]): DemoRules {
  let rules: Rule[] = seeds.map((r, i) => ({ ...r, id: i + 1, position: i + 1 }));
  let nextId = rules.length + 1;
  const fail: Result<never> = { ok: false, error: { code: "BAD_REQUEST", message: ERROR_MESSAGES.BAD_REQUEST } };
  const ok = <T,>(value: T): Result<T> => ({ ok: true, value: structuredClone(value) });
  const ordered = () => [...rules].sort((a, b) => a.position - b.position);
  const renumber = (list: Rule[]) => {
    rules = list.map((r, i) => ({ ...r, position: i + 1 }));
  };
  const reapply = () => {
    const run = applyRules(
      host.rows().filter((r) => !r.trashed),
      ordered(),
    );
    host.changed();
    return run;
  };
  const categoryIds = () => new Set(host.categories().map((c) => c.id));

  // Seeding: rows a seeded rule fits are the rule's, every other sorted row the user's.
  for (const rule of rules.filter((r) => r.enabled)) {
    const fits = matcher(rule);
    for (const r of host.rows().filter(fits)) {
      if (rule.setCategoryId !== null) [r.categoryId, r.categorySource] = [null, null];
      if (rule.setExcluded !== null) [r.excluded, r.excludedSource] = [false, null];
    }
  }
  reapply();

  function save(args: Args<"rules:save"> | undefined): Result<unknown> {
    const rule = cleanRule(args?.rule, host.accountIds(), categoryIds());
    if (!rule || !(args?.id === null || isId(args?.id))) return fail;
    const alsoChange = args.alsoChange ?? [];
    if (!Array.isArray(alsoChange) || !alsoChange.every(isId)) return fail;
    let saved: Rule;
    if (args.id === null) {
      saved = { ...rule, id: nextId++, position: rules.length + 1 };
      rules.push(saved);
    } else {
      const old = rules.find((r) => r.id === args.id);
      if (!old) return fail;
      saved = { ...rule, id: old.id, position: old.position };
      rules = rules.map((r) => (r.id === old.id ? saved : r));
    }
    // Hand over the named rows the user sorted elsewhere, as core does.
    if (rule.enabled && rule.setCategoryId !== null) {
      const fits = matcher(rule);
      for (const r of host.rows()) {
        if (!alsoChange.includes(r.id) || r.trashed || r.categorySource !== "user") continue;
        if (r.categoryId !== rule.setCategoryId && fits(r)) [r.categoryId, r.categorySource] = [null, "rule"];
      }
    }
    const run = reapply();
    return ok({ rule: saved, applied: run.applied.get(saved.id) ?? 0, changed: run.changed.length });
  }

  function preview(input: unknown): Result<unknown> {
    const conditions = cleanConditions(input, host.accountIds());
    const setCategoryId = (input as Partial<RuleInput> | null)?.setCategoryId ?? null;
    if (!conditions || !(setCategoryId === null || isId(setCategoryId))) return fail;
    const fits = matcher(conditions);
    const all = host.listed().filter(fits);
    const handSet = setCategoryId === null ? [] : all.filter((t) => t.categorySource === "user" && t.categoryId !== setCategoryId);
    return ok({ matches: all.length, sample: all.slice(0, 20), handSet });
  }

  /** Appends names to the category's first list rule, or makes one. */
  function append(categoryId: number, names: string[]): { ruleId: number; created: boolean; added: number } {
    const lists = ordered().flatMap((r) => asListRule(r) ?? []).filter((l) => l.categoryId === categoryId);
    const known = new Set(lists.flatMap((l) => l.values).map(normalize));
    const fresh = names.filter((n) => {
      const fits = !known.has(normalize(n));
      known.add(normalize(n));
      return fits;
    });
    const first = lists[0];
    if (first) {
      const [c] = first.rule.conditions;
      if (fresh.length > 0 && c?.kind === "text") {
        const next: Rule = { ...first.rule, conditions: [{ ...c, values: [...c.values, ...fresh] }] };
        rules = rules.map((r) => (r.id === next.id ? next : r));
      }
      return { ruleId: first.rule.id, created: false, added: fresh.length };
    }
    const name = host.categories().find((c) => c.id === categoryId)?.name ?? "Places";
    const rule: Rule = {
      id: nextId++,
      position: rules.length + 1,
      name,
      enabled: true,
      join: "all",
      conditions: [{ kind: "text", field: "description", mode: "contains", values: fresh }],
      setCategoryId: categoryId,
      setExcluded: null,
    };
    rules.push(rule);
    return { ruleId: rule.id, created: true, added: fresh.length };
  }

  function offers(): { key: string; categoryId: number; names: string[] }[] {
    const known = new Set(knownPlaces(ordered()).flatMap((p) => p.names).map(normalize));
    const categories = host.categories();
    return DEMO_STARTERS.flatMap((s) => {
      // Skipped when the category was renamed or removed, as in core.
      if (!categories.some((c) => c.id === s.categoryId && c.name === s.categoryName && !c.archived)) return [];
      const names = s.names.filter((n) => {
        const fresh = !known.has(normalize(n));
        known.add(normalize(n));
        return fresh;
      });
      return names.length > 0 ? [{ key: s.key, categoryId: s.categoryId, names }] : [];
    });
  }

  function starters(): Result<unknown> {
    const list = offers();
    // Try them on copies of the rows and rules, saving nothing.
    const [saved, savedNext] = [rules, nextId];
    rules = [...rules];
    const copies = host.rows().filter((r) => !r.trashed).map((r) => ({ ...r }));
    const target = new Map<number, number>();
    for (const o of list) target.set(o.categoryId, append(o.categoryId, o.names).ruleId);
    const trial = ordered();
    [rules, nextId] = [saved, savedNext];
    const before = new Map(copies.map((r) => [r.id, r.categoryId]));
    const live = compile(trial);
    const sortedBy = new Map<number, RuleTarget[]>();
    for (const row of copies) {
      const by = decide(row, live);
      if (row.categoryId === null || row.categoryId === before.get(row.id)) continue;
      const id = target.get(row.categoryId);
      if (id !== undefined && by.has(id)) sortedBy.set(id, [...(sortedBy.get(id) ?? []), row]);
    }
    const all = new Set<number>();
    const lists: StarterList[] = list.map((o) => {
      const fits = matcher({ join: "all", conditions: [{ kind: "text", field: "description", mode: "contains", values: o.names }] });
      const rows = (sortedBy.get(target.get(o.categoryId) ?? 0) ?? []).filter(fits);
      rows.forEach((r) => all.add(r.id));
      return { key: o.key, categoryId: o.categoryId, names: o.names, sorts: rows.length };
    });
    return ok({ lists, sorts: all.size });
  }

  function answer(channel: Channel, args: unknown): Result<unknown> | null {
    switch (channel) {
      case "rules:list":
        return ok(ordered());
      case "rules:create": {
        const r = save({ id: null, rule: args as RuleInput });
        return r.ok ? ok((r.value as { rule: Rule }).rule) : r;
      }
      case "rules:update": {
        const a = args as Args<"rules:update"> | undefined;
        if (!isId(a?.id) || !rules.some((r) => r.id === a.id)) return fail;
        const r = save({ id: a.id, rule: a.rule });
        return r.ok ? ok((r.value as { rule: Rule }).rule) : r;
      }
      case "rules:save":
        return save(args as Args<"rules:save">);
      case "rules:delete": {
        const id = (args as Args<"rules:delete"> | undefined)?.id;
        if (!rules.some((r) => r.id === id)) return fail;
        renumber(ordered().filter((r) => r.id !== id));
        reapply();
        return ok(null);
      }
      case "rules:reorder": {
        const ids = (args as Args<"rules:reorder"> | undefined)?.ids;
        const byRule = new Map(rules.map((r) => [r.id, r]));
        if (!Array.isArray(ids) || ids.length !== rules.length || new Set(ids).size !== ids.length) return fail;
        if (!ids.every((id) => byRule.has(id))) return fail;
        renumber(ids.map((id) => byRule.get(id) as Rule));
        reapply();
        return ok(null);
      }
      case "rules:apply": {
        const run = reapply();
        return ok({ changed: run.changed.length, sorted: run.sorted });
      }
      case "rules:preview":
        return preview(args);
      case "rules:suggest": {
        const ids = (args as Args<"rules:suggest"> | undefined)?.ids;
        if (!Array.isArray(ids) || ids.length === 0 || !ids.every(isId)) return fail;
        const draft = suggest(host.rows().filter((r) => ids.includes(r.id)).sort((a, b) => a.id - b.id));
        return draft ? ok(draft) : fail;
      }
      case "rules:knownPlaces":
        return ok(knownPlaces(ordered()));
      case "rules:addKnownPlace": {
        const a = args as Args<"rules:addKnownPlace"> | undefined;
        const name = typeof a?.name === "string" ? cleanText(a.name) : "";
        if (!isId(a?.categoryId) || !categoryIds().has(a.categoryId) || name === "" || name.length > MAX_TEXT) return fail;
        const { ruleId, created, added } = append(a.categoryId, [name]);
        const run = reapply();
        return ok({ ruleId, created, added: added > 0, changed: run.changed.length });
      }
      case "rules:starters":
        return starters();
      case "rules:addStarters": {
        const keys = (args as Args<"rules:addStarters"> | undefined)?.keys;
        if (!Array.isArray(keys) || !keys.every((k) => typeof k === "string")) return fail;
        let made = 0;
        for (const o of offers().filter((x) => keys.includes(x.key))) if (append(o.categoryId, o.names).added > 0) made++;
        const run = reapply();
        return ok({ rules: made, changed: run.changed.length });
      }
      default:
        return null;
    }
  }

  return { answer, reapply };
}
