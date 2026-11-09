// Why a row has its category (spec 17, F32): set by a rule (which one, from
// the rules core sent), set by the user, or not set yet. Reads the row's
// own fields only; it never works out rule matches.

import type { Rule, TransactionRow } from "@shared/types";
import { s } from "@/strings";

export type CategoryOrigin =
  | { kind: "rule"; rule: Rule | null }
  | { kind: "user" }
  | { kind: "none" };

export function categoryOrigin(row: TransactionRow, rules: Rule[] | undefined): CategoryOrigin {
  if (row.categoryId == null) return { kind: "none" };
  if (row.categorySource !== "rule") return { kind: "user" };
  // `ruleId` is the last rule that touched the row; it names the category
  // only when that rule sets this category (another may have excluded it).
  const rule = rules?.find((r) => r.id === row.ruleId && r.setCategoryId === row.categoryId) ?? null;
  return { kind: "rule", rule };
}

export function originText(origin: CategoryOrigin): string {
  const t = s.txTools.origin;
  if (origin.kind === "rule") return origin.rule ? t.byRule(origin.rule.name) : t.bySomeRule;
  return origin.kind === "user" ? t.byYou : t.none;
}
