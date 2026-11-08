// The rule editor's form: what the user is typing, and the RuleInput it
// becomes. Amounts are typed in shekels and sent as agorot. Optional
// conditions keep their values while switched off, so a suggestion can show
// an account or amount span without using it until the user opts in.

import type { Agorot, RuleDirection, RuleInput, RuleMatchField, RuleMatchMode } from "@shared/types";
import { toAgorot } from "@shared/money";
import { s } from "@/strings";

export type Exclusion = "none" | "exclude" | "count";

export interface RuleForm {
  name: string;
  enabled: boolean;
  matchField: RuleMatchField;
  matchMode: RuleMatchMode;
  matchText: string;
  useAccount: boolean;
  accountId: number | null;
  useAmount: boolean;
  amountMin: string;
  amountMax: string;
  useDirection: boolean;
  direction: RuleDirection;
  setCategoryId: number | null;
  exclusion: Exclusion;
}

export const MAX_TEXT = 200;
export const MAX_NAME = 100;

/**
 * A blank form, an existing rule, or a draft. `optIn` leaves the account and
 * amount switched off (a suggestion's guesses), with their values kept.
 */
export function formFrom(rule: RuleInput | null, opts: { optIn?: boolean } = {}): RuleForm {
  const optIn = opts.optIn ?? false;
  return {
    name: rule?.name ?? "",
    enabled: rule?.enabled ?? true,
    matchField: rule?.matchField ?? "description",
    matchMode: rule?.matchMode ?? "contains",
    matchText: rule?.matchText ?? "",
    useAccount: !optIn && rule?.accountId != null,
    accountId: rule?.accountId ?? null,
    useAmount: !optIn && (rule?.amountMin != null || rule?.amountMax != null),
    amountMin: shekelText(rule?.amountMin ?? null),
    amountMax: shekelText(rule?.amountMax ?? null),
    useDirection: rule?.direction != null,
    direction: rule?.direction ?? "out",
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

export interface FormCheck {
  /** The form as a rule, whatever is missing, for the live sentence. */
  draft: RuleInput;
  /**
   * The conditions alone, for the live preview (name and actions blanked, so
   * picking a category does not ask again); null until there is text.
   */
  preview: RuleInput | null;
  /** The rule ready to save, or null while something is missing. */
  rule: RuleInput | null;
  problems: { text?: string; amount?: string; action?: string };
}

export function checkForm(form: RuleForm): FormCheck {
  const e = s.rules.editor;
  const problems: FormCheck["problems"] = {};
  const regex = form.matchMode === "regex";
  const text = regex ? form.matchText : form.matchText.trim();
  if (text.trim() === "") problems.text = e.needsText;

  let amountMin: Agorot | null = null;
  let amountMax: Agorot | null = null;
  if (form.useAmount) {
    const lo = parseShekels(form.amountMin);
    const hi = parseShekels(form.amountMax);
    if (lo === undefined || hi === undefined) problems.amount = e.badAmount;
    else if (lo !== null && hi !== null && lo > hi) problems.amount = e.amountOrder;
    else [amountMin, amountMax] = [lo, hi];
  }

  const setExcluded = form.exclusion === "none" ? null : form.exclusion === "exclude";
  if (form.setCategoryId === null && setExcluded === null) problems.action = e.needsAction;

  const input: RuleInput = {
    name: (form.name.trim() || text.trim()).slice(0, MAX_NAME),
    enabled: form.enabled,
    matchField: form.matchField,
    matchMode: form.matchMode,
    matchText: text,
    accountId: form.useAccount ? form.accountId : null,
    amountMin,
    amountMax,
    direction: form.useDirection ? form.direction : null,
    setCategoryId: form.setCategoryId,
    setExcluded,
  };
  const conditionsOk = !problems.text && !problems.amount;
  return {
    draft: input,
    preview: conditionsOk ? { ...input, name: "", enabled: true, setCategoryId: null, setExcluded: null } : null,
    rule: conditionsOk && !problems.action ? input : null,
    problems,
  };
}
