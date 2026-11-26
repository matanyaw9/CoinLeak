// The categories editor's calls and what to refresh after each, plus the
// kinds the editor offers and the friendly text for each refusal code.
// Spec 40: a move that leaves a budget newly over says so.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { BudgetPlan, CategoryChange, CategoryDeleteResult, CategoryInput, CategoryKind, CategoryPatch } from "@shared/types";
import { s } from "@/strings";
import { showFailure } from "@/lib/failure";
import { call } from "@/lib/api";
import { usePeriod } from "@/lib/month-context";
import { refreshCategories } from "@/lib/query-keys";
import { money } from "@/components/budgets/offer-words";
import { newlyOver } from "./newly-over";

// Every kind of `CategoryKind`, and whether the editor offers it. A new kind
// stops this record compiling until it is listed here.
const KIND_OFFERED: Record<CategoryKind, boolean> = { expense: true, income: true, transfer: true };
export const KINDS = (Object.keys(KIND_OFFERED) as CategoryKind[]).filter((k) => KIND_OFFERED[k]);

export const kindLabel = (kind: CategoryKind): string => s.catEdit.kinds[kind] ?? kind;

/** Friendly text for a refusal code; a code we do not know gets a generic line. */
export const problemText = (problem: string): string =>
  s.nested.problem[problem] ?? s.catEdit.problem[problem] ?? s.errors.failed.categories;

const showError = (e: unknown) => showFailure(e, s.errors.failed.categories);

/** Warns when the plan now has a budget over that fitted `before` the move. */
async function warnIfNewlyOver(before: BudgetPlan): Promise<void> {
  const over = newlyOver(before, await call("budgets:plan", { month: before.month }));
  if (!over) return;
  if (over.categoryId === null) return void toast.warning(s.catBudgets.totalOver(money(over.over)));
  const name = (await call("categories:list", undefined)).find((c) => c.id === over.categoryId)?.name ?? "";
  toast.warning(s.catBudgets.nowOver(name, money(over.over)));
}

export function useCategoryActions() {
  const client = useQueryClient();
  const { month } = usePeriod().choice;
  const settle = { onSettled: () => refreshCategories(client), onError: showError };
  const create = useMutation<CategoryChange, unknown, CategoryInput>({
    mutationFn: (input) => call("categories:create", input),
    ...settle,
  });
  const update = useMutation<CategoryChange, unknown, { id: number; patch: CategoryPatch }>({
    mutationFn: async (args) => {
      if (args.patch.parentId === undefined) return call("categories:update", args);
      // The move saves whether or not the budgets can be read.
      const before = await call("budgets:plan", { month }).catch(() => null);
      const result = await call("categories:update", args);
      if (before && result.ok) await warnIfNewlyOver(before).catch(() => undefined);
      return result;
    },
    ...settle,
  });
  const remove = useMutation<CategoryDeleteResult, unknown, { id: number; moveTo: number | null }>({
    mutationFn: (args) => call("categories:delete", args),
    ...settle,
  });
  return { create, update, remove };
}
