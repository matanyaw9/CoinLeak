// The categories editor's calls and what to refresh after each, plus the
// kinds the editor offers and the friendly text for each refusal code.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CategoryChange, CategoryDeleteResult, CategoryInput, CategoryKind, CategoryPatch } from "@shared/types";
import { s } from "@/strings";
import { showFailure } from "@/lib/failure";
import { call } from "@/lib/api";
import { refreshCategories } from "@/lib/query-keys";

// Every kind of `CategoryKind`, and whether the editor offers it. A new kind
// stops this record compiling until it is listed here.
const KIND_OFFERED: Record<CategoryKind, boolean> = { expense: true, income: true, transfer: true };
export const KINDS = (Object.keys(KIND_OFFERED) as CategoryKind[]).filter((k) => KIND_OFFERED[k]);

export const kindLabel = (kind: CategoryKind): string => s.catEdit.kinds[kind] ?? kind;

/** Friendly text for a refusal code; a code we do not know gets a generic line. */
export const problemText = (problem: string): string =>
  s.nested.problem[problem] ?? s.catEdit.problem[problem] ?? s.errors.failed.categories;

const showError = (e: unknown) => showFailure(e, s.errors.failed.categories);

export function useCategoryActions() {
  const client = useQueryClient();
  const settle = { onSettled: () => refreshCategories(client), onError: showError };
  const create = useMutation<CategoryChange, unknown, CategoryInput>({
    mutationFn: (input) => call("categories:create", input),
    ...settle,
  });
  const update = useMutation<CategoryChange, unknown, { id: number; patch: CategoryPatch }>({
    mutationFn: (args) => call("categories:update", args),
    ...settle,
  });
  const remove = useMutation<CategoryDeleteResult, unknown, { id: number; moveTo: number | null }>({
    mutationFn: (args) => call("categories:delete", args),
    ...settle,
  });
  return { create, update, remove };
}
