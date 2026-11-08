// A rule as one plain sentence: "If the description contains Aroma, Cofix
// or Landwer, set Coffee & Cafes." Returned as parts so screens can style
// the values the user typed or chose; `sentenceText` joins them for tests.

import type { Account, Agorot, Category, RuleCondition, RuleInput } from "@shared/types";
import { s } from "@/strings";
import { ils } from "./format";

export type SentencePart =
  | { kind: "text"; text: string }
  /** What the user typed to match, shown as typed (often Hebrew). */
  | { kind: "value"; text: string }
  | { kind: "money"; text: string }
  | { kind: "account"; text: string }
  | { kind: "category"; text: string; category: Category | null };

export interface SentenceContext {
  category: (id: number) => Category | undefined;
  account: (id: number) => Account | undefined;
}

type Rule = Pick<RuleInput, "join" | "conditions" | "setCategoryId" | "setExcluded">;

export interface SentenceOptions {
  /** Names shown per text condition before "or N more". */
  maxValues?: number;
}

const text = (t: string): SentencePart => ({ kind: "text", text: t });
const money = (a: Agorot): SentencePart => ({ kind: "money", text: ils(a, { decimals: a % 100 !== 0 }) });

/** "Everyday card ··4821", or the provider's short name when unnamed. */
export function accountName(a: Account): string {
  return `${a.name ?? s.providers[a.provider].short} ··${a.accountNumber.slice(-4)}`;
}

export function ruleSentence(rule: Rule, ctx: SentenceContext, opts: SentenceOptions = {}): SentencePart[] {
  const w = s.rules.sentence;
  const clauses = rule.conditions.map((c) => clause(c, ctx, opts.maxValues ?? Infinity));
  if (clauses.length === 0) clauses.push([text(`${w.field.description} ${w.mode.contains} `), { kind: "value", text: w.emptyText }]);

  const actions: SentencePart[][] = [];
  if (rule.setCategoryId !== null) {
    const c = ctx.category(rule.setCategoryId) ?? null;
    actions.push([text(w.set), { kind: "category", text: c ? c.name : w.unknownCategory, category: c }]);
  }
  if (rule.setExcluded !== null) actions.push([text(rule.setExcluded ? w.exclude : w.count)]);
  if (actions.length === 0) actions.push([text(w.noAction)]);

  const joinWord = rule.join === "any" ? s.rulesV2.sentence.or : w.and;
  return merge([text(w.when), ...list(clauses, joinWord), text(w.then), ...list(actions, w.and, true), text(w.end)]);
}

function clause(c: RuleCondition, ctx: SentenceContext, maxValues: number): SentencePart[] {
  const w = s.rules.sentence;
  const v2 = s.rulesV2.sentence;
  if (c.kind === "text") {
    const typed = c.values.map((v) => (c.mode === "regex" ? v : v.trim())).filter((v) => v !== "");
    const shown: SentencePart[][] = typed.slice(0, maxValues).map((v) => [{ kind: "value", text: v }]);
    if (typed.length > maxValues) shown.push([text(v2.more(typed.length - maxValues))]);
    if (shown.length === 0) shown.push([{ kind: "value", text: w.emptyText }]);
    return [text(`${w.field[c.field]} ${w.mode[c.mode]} `), ...list(shown, v2.or)];
  }
  if (c.kind === "account") {
    const a = ctx.account(c.accountId);
    return [text(w.onAccount), { kind: "account", text: a ? accountName(a) : c.accountId > 0 ? w.unknownAccount : w.emptyText }];
  }
  if (c.kind === "direction") return [text(w.direction[c.direction])];
  const { min: lo, max: hi } = c;
  if (lo !== null && hi !== null && lo === hi) return [text(w.exactly), money(lo)];
  if (lo !== null && hi !== null) return [text(w.between), money(lo), text(w.and), money(hi)];
  if (lo !== null) return [text(w.atLeast), money(lo)];
  if (hi !== null) return [text(w.atMost), money(hi)];
  return [text(v2.amountUnset)];
}

/** One condition alone as a phrase: "it's on Everyday card ··4821". */
export const conditionPhrase = (c: RuleCondition, ctx: SentenceContext): SentencePart[] => merge(clause(c, ctx, Infinity));

export const sentenceText = (parts: SentencePart[]) => parts.map((p) => p.text).join("");

/** "a", "a <last> b", "a, b <last> c". With `only`, every glue is `last`. */
function list(items: SentencePart[][], last: string, only = false): SentencePart[] {
  const w = s.rules.sentence;
  return items.flatMap((item, i) => {
    if (i === 0) return item;
    const glue = only || i === items.length - 1 ? last : w.listComma;
    return [text(glue), ...item];
  });
}

/** Neighbouring plain text joined, so the sentence renders as few spans. */
function merge(parts: SentencePart[]): SentencePart[] {
  const out: SentencePart[] = [];
  for (const p of parts) {
    const last = out.at(-1);
    if (p.kind === "text" && last?.kind === "text") out[out.length - 1] = text(last.text + p.text);
    else out.push(p);
  }
  return out;
}
