// The rule editor's form: what the user is typing, and the RuleInput it
// becomes. A rule holds conditions joined by all or any; a text condition
// holds several names as chips. Amounts are typed in shekels and sent as
// agorot. A suggestion's account and amount wait aside until the user adds them.

import type { Agorot, RuleCondition, RuleDirection, RuleInput, RuleJoin, RuleMatchField, RuleMatchMode } from "@shared/types";
import { toAgorot } from "@shared/money";
import { s } from "@/strings";

export type Exclusion = "none" | "exclude" | "count";

export type FormCondition =
  | { key: number; kind: "text"; field: RuleMatchField; mode: RuleMatchMode; values: string[]; draft: string }
  | { key: number; kind: "account"; accountId: number | null }
  | { key: number; kind: "amount"; min: string; max: string }
  | { key: number; kind: "direction"; direction: RuleDirection };

export type ConditionKind = FormCondition["kind"];

export interface RuleForm {
  name: string;
  enabled: boolean;
  join: RuleJoin;
  conditions: FormCondition[];
  /** A suggestion's account and amount, shown to add with one click. */
  suggested: FormCondition[];
  setCategoryId: number | null;
  exclusion: Exclusion;
}

export const MAX_TEXT = 200;
export const MAX_NAME = 100;
export const MAX_CONDITIONS = 20;
export const MAX_VALUES = 200;

let lastKey = 0;
const nextKey = () => ++lastKey;

export function blankCondition(kind: ConditionKind): FormCondition {
  const key = nextKey();
  if (kind === "text") return { key, kind, field: "description", mode: "contains", values: [], draft: "" };
  if (kind === "account") return { key, kind, accountId: null };
  if (kind === "amount") return { key, kind, min: "", max: "" };
  return { key, kind, direction: "out" };
}

function toForm(c: RuleCondition): FormCondition {
  const key = nextKey();
  if (c.kind === "text") return { key, kind: "text", field: c.field, mode: c.mode, values: [...c.values], draft: "" };
  if (c.kind === "account") return { key, kind: "account", accountId: c.accountId };
  if (c.kind === "amount") return { key, kind: "amount", min: shekelText(c.min), max: shekelText(c.max) };
  return { key, kind: "direction", direction: c.direction };
}

/**
 * A blank form, an existing rule, or a draft. `optIn` sets a suggestion's
 * account and amount aside, so the rule starts from its text alone.
 */
export function formFrom(rule: RuleInput | null, opts: { optIn?: boolean } = {}): RuleForm {
  const all = (rule?.conditions ?? []).map(toForm);
  const aside = (c: FormCondition) => opts.optIn === true && (c.kind === "account" || c.kind === "amount");
  const conditions = all.filter((c) => !aside(c));
  return {
    name: rule?.name ?? "",
    enabled: rule?.enabled ?? true,
    join: rule?.join ?? "all",
    conditions: conditions.length > 0 ? conditions : [blankCondition("text")],
    suggested: all.filter(aside),
    setCategoryId: rule?.setCategoryId ?? null,
    exclusion: rule?.setExcluded == null ? "none" : rule.setExcluded ? "exclude" : "count",
  };
}

/** Agorot as an amount to edit: "58", "59.90", or empty. */
export function shekelText(amount: Agorot | null): string {
  if (amount === null) return "";
  const whole = Math.trunc(amount / 100);
  const rest = amount % 100;
  return rest === 0 ? String(whole) : `${whole}.${String(rest).padStart(2, "0")}`;
}

/** Typed shekels as agorot. `null` when empty, `undefined` when not a number. */
export function parseShekels(text: string): Agorot | null | undefined {
  const clean = text.replace(/[₪,\s]/g, "");
  if (clean === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return undefined;
  return toAgorot(Number(clean));
}

/** Names typed or pasted into the chips field: split on commas and new lines. */
export function splitValues(text: string): string[] {
  return text
    .split(/[,\n]/)
    .map((v) => v.replace(/\s+/g, " ").trim())
    .filter((v) => v !== "");
}

/** `values` with `more` added at the end, repeats (ignoring case) left out. */
export function addValues(values: string[], more: string[]): string[] {
  const seen = new Set(values.map((v) => v.toLowerCase()));
  const out = [...values];
  for (const v of more) {
    const key = v.toLowerCase();
    if (seen.has(key) || out.length >= MAX_VALUES) continue;
    seen.add(key);
    out.push(v.slice(0, MAX_TEXT));
  }
  return out;
}

/** A text condition's names, counting what is still typed in its field. */
export function valuesOf(c: Extract<FormCondition, { kind: "text" }>): string[] {
  if (c.mode === "regex") return c.draft.trim() === "" ? c.values : addValues(c.values, [c.draft]);
  return addValues(c.values, splitValues(c.draft));
}

export interface FormCheck {
  /** The form as a rule, whatever is missing, for the live sentence. */
  draft: RuleInput;
  /**
   * The finished conditions and the category, for the live preview (name
   * and exclusion blanked); null until one condition is finished.
   */
  preview: RuleInput | null;
  /** The rule ready to save, or null while something is missing. */
  rule: RuleInput | null;
  /** Per condition key, what it still needs; and the action's. */
  problems: { conditions: Record<number, string>; action?: string };
}

function checkCondition(c: FormCondition): { condition: RuleCondition; problem?: string } {
  const e = s.rulesV2.editor;
  if (c.kind === "text") {
    const values = valuesOf(c);
    const condition: RuleCondition = { kind: "text", field: c.field, mode: c.mode, values };
    return values.length === 0 ? { condition, problem: s.rules.editor.needsText } : { condition };
  }
  if (c.kind === "account") {
    const condition: RuleCondition = { kind: "account", accountId: c.accountId ?? 0 };
    return c.accountId === null ? { condition, problem: e.needsAccount } : { condition };
  }
  if (c.kind === "direction") return { condition: { kind: "direction", direction: c.direction } };
  const lo = parseShekels(c.min);
  const hi = parseShekels(c.max);
  const condition: RuleCondition = { kind: "amount", min: lo ?? null, max: hi ?? null };
  if (lo === undefined || hi === undefined) return { condition, problem: s.rules.editor.badAmount };
  if (lo === null && hi === null) return { condition, problem: e.needsAmount };
  if (lo !== null && hi !== null && lo > hi) return { condition, problem: s.rules.editor.amountOrder };
  return { condition };
}

export function checkForm(form: RuleForm): FormCheck {
  const problems: FormCheck["problems"] = { conditions: {} };
  const checked = form.conditions.map((c) => ({ key: c.key, ...checkCondition(c) }));
  for (const c of checked) if (c.problem) problems.conditions[c.key] = c.problem;
  const done = checked.filter((c) => !c.problem).map((c) => c.condition);

  const setExcluded = form.exclusion === "none" ? null : form.exclusion === "exclude";
  if (form.setCategoryId === null && setExcluded === null) problems.action = s.rules.editor.needsAction;

  const firstText = checked.find((c) => c.condition.kind === "text")?.condition;
  const fallbackName = firstText?.kind === "text" ? firstText.values.join(", ") : "";
  const input: RuleInput = {
    name: (form.name.trim() || fallbackName || s.rules.chip.fallback).slice(0, MAX_NAME).trim(),
    enabled: form.enabled,
    join: form.join,
    conditions: checked.map((c) => c.condition),
    setCategoryId: form.setCategoryId,
    setExcluded,
  };
  const conditionsOk = done.length === checked.length && done.length > 0;
  return {
    draft: input,
    preview:
      done.length > 0
        ? { name: "", enabled: true, join: form.join, conditions: done, setCategoryId: form.setCategoryId, setExcluded: null }
        : null,
    rule: conditionsOk && !problems.action ? input : null,
    problems,
  };
}
