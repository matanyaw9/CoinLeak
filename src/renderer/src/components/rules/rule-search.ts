// What the Rules search finds (spec 21): a rule's name, the values its
// conditions match (texts and account names), and the category it sets.

import type { Rule } from "@shared/types";
import { hasText } from "@/components/layout/find-text";
import { accountName, type SentenceContext } from "@/lib/rule-sentence";

/** The condition values of `rule` that hold `query`; empty when none do. */
export function valueHits(rule: Rule, query: string, ctx: SentenceContext): string[] {
  return rule.conditions.flatMap((c) => {
    if (c.kind === "text") return c.values.filter((v) => hasText(v, query));
    if (c.kind === "account") {
      const account = ctx.account(c.accountId);
      const name = account ? accountName(account) : null;
      return name !== null && hasText(name, query) ? [name] : [];
    }
    return [];
  });
}

/** True when the rule's name, a condition value, or its category's name holds `query`. */
export function ruleHits(rule: Rule, query: string, ctx: SentenceContext): boolean {
  if (hasText(rule.name, query)) return true;
  const category = rule.setCategoryId != null ? ctx.category(rule.setCategoryId) : undefined;
  if (category && hasText(category.name, query)) return true;
  return valueHits(rule, query, ctx).length > 0;
}
