// Screenshot aid for spec 41, dev start route only like `?shot` (lib/shot.ts):
// the Demo has no rules that contradict. `hints` saves two that do,
// `overrides` opens a draft that contradicts two Demo rules, `setbyyou`
// ignores two rows by hand and opens an ignore draft over them.

import type { Category, RuleInput } from "@shared/types";
import { call } from "@/lib/api";

export async function runOrderShot(
  shot: string,
  openEditor: (request: { draft: RuleInput }) => void,
  refresh: () => unknown,
): Promise<void> {
  if (shot !== "hints" && shot !== "overrides" && shot !== "setbyyou") return;
  const categories: Category[] = await call("categories:list", undefined);
  const categoryId = (name: string) => categories.find((c) => c.name === name)?.id ?? null;
  const rule = (name: string, values: string[], category: string | null): RuleInput => ({
    name,
    enabled: true,
    join: "all",
    conditions: [{ kind: "text", field: "description", mode: "contains", values }],
    setCategoryId: category === null ? null : categoryId(category),
    setExcluded: category === null ? true : null,
  });

  if (shot === "hints") {
    await call("rules:save", { id: null, rule: rule("Delivery apps", ["WOLT", "תן ביס"], "Entertainment") });
    await call("rules:save", { id: null, rule: rule("Wolt orders", ["WOLT"], "Shopping") });
    await refresh();
  }
  if (shot === "overrides") openEditor({ draft: rule("Evenings out", ["WOLT", "קופיקס"], "Entertainment") });
  if (shot === "setbyyou") {
    const { rows } = await call("transactions:list", { search: "WOLT" });
    const ids = rows.filter((_, i) => i === 0 || i === 2).map((r) => r.id);
    await call("transactions:update", { ids, patch: { excluded: true } });
    openEditor({ draft: rule("Skip Wolt", ["WOLT"], null) });
  }
}
