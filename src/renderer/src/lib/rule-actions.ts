// Rule changes for components: save, switch on or off, reorder and delete
// with Undo. Switching and reordering show at once and settle when the app
// answers. Every change refreshes the rules and everything that shows money.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Rule, RuleInput } from "@shared/types";
import { s } from "@/strings";
import { ApiError, call } from "./api";
import { refreshRules } from "./hooks";
import { restoreRule, toInput } from "./rules";

const failed = (e: unknown) => toast.error(e instanceof ApiError ? e.message : s.errors.crashBody);
const LIST = ["rules:list"];

export function useRuleActions() {
  const client = useQueryClient();
  const refresh = () => refreshRules(client);

  /** Shows `next` in the list right away; returns how to put it back. */
  const showList = async (next: (rules: Rule[]) => Rule[]) => {
    await client.cancelQueries({ queryKey: LIST });
    const before = client.getQueryData<Rule[]>(LIST);
    if (before) client.setQueryData<Rule[]>(LIST, next(before));
    return () => client.setQueryData(LIST, before);
  };

  const save = useMutation({
    mutationFn: ({ id, rule }: { id: number | null; rule: RuleInput }) =>
      id === null ? call("rules:create", rule) : call("rules:update", { id, rule }),
    onSuccess: (rule) => toast.success(s.rules.saved(rule.name), { description: s.rules.savedBody }),
    onError: failed,
    onSettled: refresh,
  });

  const setEnabled = useMutation({
    mutationFn: ({ rule, enabled }: { rule: Rule; enabled: boolean }) =>
      call("rules:update", { id: rule.id, rule: { ...toInput(rule), enabled } }),
    onMutate: ({ rule, enabled }) => showList((list) => list.map((r) => (r.id === rule.id ? { ...r, enabled } : r))),
    onError: (e, _vars, undo) => {
      undo?.();
      failed(e);
    },
    onSettled: refresh,
  });

  const reorder = useMutation({
    mutationFn: (ids: number[]) => call("rules:reorder", { ids }),
    onMutate: (ids) =>
      showList((list) => {
        const byId = new Map(list.map((r) => [r.id, r]));
        return ids.flatMap((id, i) => {
          const r = byId.get(id);
          return r ? [{ ...r, position: i + 1 }] : [];
        });
      }),
    onError: (e, _ids, undo) => {
      undo?.();
      failed(e);
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: async (rule: Rule) => {
      await call("rules:delete", { id: rule.id });
      return rule;
    },
    onMutate: (rule) => showList((list) => list.filter((r) => r.id !== rule.id)),
    onSuccess: (rule) =>
      toast.success(s.rules.deleted(rule.name), {
        description: s.rules.deletedBody,
        action: {
          label: s.review.undo,
          onClick: () => {
            restoreRule(rule)
              .then(() => toast(s.rules.restored), failed)
              .finally(() => void refresh());
          },
        },
      }),
    onError: (e, _rule, undo) => {
      undo?.();
      failed(e);
    },
    onSettled: refresh,
  });

  return {
    /** Creates when `id` is null. Resolves with the saved rule, rejects on error. */
    save: (id: number | null, rule: RuleInput) => save.mutateAsync({ id, rule }),
    saving: save.isPending,
    setEnabled: (rule: Rule, enabled: boolean) => setEnabled.mutate({ rule, enabled }),
    reorder: (ids: number[]) => reorder.mutate(ids),
    remove: (rule: Rule) => remove.mutate(rule),
  };
}
