// A rule as one plain sentence: "When the description starts with שופרסל,
// set Groceries." Returned as parts so screens can style the values the
// user typed or chose; `sentenceText` joins them for tests and labels.

import type { Account, Agorot, Category, RuleInput } from "@shared/types";
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

type Rule = Pick<
  RuleInput,
  "matchField" | "matchMode" | "matchText" | "accountId" | "amountMin" | "amountMax" | "direction" | "setCategoryId" | "setExcluded"
>;

const text = (t: string): SentencePart => ({ kind: "text", text: t });
const money = (a: Agorot): SentencePart => ({ kind: "money", text: ils(a, { decimals: a % 100 !== 0 }) });

/** "Everyday card ··4821", or the provider's short name when unnamed. */
export function accountName(a: Account): string {
  return `${a.name ?? s.providers[a.provider].short} ··${a.accountNumber.slice(-4)}`;
}

export function ruleSentence(rule: Rule, ctx: SentenceContext): SentencePart[] {
  const w = s.rules.sentence;
  const clauses: SentencePart[][] = [];

  const typed = rule.matchMode === "regex" ? rule.matchText : rule.matchText.trim();
  clauses.push([
    text(`${w.field[rule.matchField]} ${w.mode[rule.matchMode]} `),
    { kind: "value", text: typed === "" ? w.emptyText : typed },
  ]);

  if (rule.accountId !== null) {
    const a = ctx.account(rule.accountId);
    clauses.push([text(w.onAccount), { kind: "account", text: a ? accountName(a) : w.unknownAccount }]);
  }
  if (rule.direction !== null) clauses.push([text(w.direction[rule.direction])]);

  const { amountMin: lo, amountMax: hi } = rule;
  if (lo !== null && hi !== null && lo === hi) clauses.push([text(w.exactly), money(lo)]);
  else if (lo !== null && hi !== null) clauses.push([text(w.between), money(lo), text(w.and), money(hi)]);
  else if (lo !== null) clauses.push([text(w.atLeast), money(lo)]);
  else if (hi !== null) clauses.push([text(w.atMost), money(hi)]);

  const actions: SentencePart[][] = [];
  if (rule.setCategoryId !== null) {
    const c = ctx.category(rule.setCategoryId) ?? null;
    actions.push([text(w.set), { kind: "category", text: c ? c.name : w.unknownCategory, category: c }]);
  }
  if (rule.setExcluded !== null) actions.push([text(rule.setExcluded ? w.exclude : w.count)]);
  if (actions.length === 0) actions.push([text(w.noAction)]);

  return merge([text(w.when), ...list(clauses), text(w.then), ...list(actions, true), text(w.end)]);
}

export const sentenceText = (parts: SentencePart[]) => parts.map((p) => p.text).join("");

/** "a", "a and b", "a, b and c". Actions always join with "and". */
function list(items: SentencePart[][], andOnly = false): SentencePart[] {
  const w = s.rules.sentence;
  return items.flatMap((item, i) => {
    if (i === 0) return item;
    const glue = andOnly || i === items.length - 1 ? w.and : w.listComma;
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
