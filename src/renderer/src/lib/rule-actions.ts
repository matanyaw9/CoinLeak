// Rule changes for components: save, switch on or off, reorder and delete
// with Undo, Apply now, starter lists and known places (spec 13). Switching
// and reordering show at once and settle when the app answers. Every change
// refreshes the rules and everything that shows money.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Category, Rule, RuleInput } from "@shared/types";
import type { Args } from "@shared/ipc";
import { s } from "@/strings";
import { showFailure } from "@/lib/failure";
import { call } from "./api";
import { queryKey, refreshRules } from "./query-keys";
import { toInput } from "./rules";

const failed = (e: unknown) => showFailure(e, s.errors.failed.rules);
const LIST = queryKey("rules:list");

/** The rule editor's tick boxes, as `rules:save` takes them (spec 35). */
export type SaveTicks = Pick<Args<"rules:save">, "alsoChange" | "unticked" | "ticked">;

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
    mutationFn: (args: { id: number | null; rule: RuleInput; ticks: SaveTicks }) =>
      call("rules:save", { id: args.id, rule: args.rule, ...args.ticks }),
    onSuccess: ({ rule, applied }) => toast.success(s.rulesV2.saved(rule.name), { description: s.rulesV2.applied(applied) }),
    onError: failed,
    onSettled: refresh,
  });

  const apply = useMutation({
    mutationFn: () => call("rules:apply", undefined),
    onSuccess: ({ changed, sorted }) =>
      toast.success(s.rulesV2.appliedAll(changed), { description: s.rulesV2.appliedAllBody(sorted) }),
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
    mutationFn: (rule: Rule) => call("rules:delete", { id: rule.id }),
    onMutate: (rule) => showList((list) => list.filter((r) => r.id !== rule.id)),
    onSuccess: (deleted) =>
      toast.success(s.rules.deleted(deleted.rule.name), {
        description: s.rules.deletedBody,
        action: {
          label: s.review.undo,
          onClick: () => {
            call("rules:restore", deleted)
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
    /**
     * Creates when `id` is null. `ticks` says which listed rows the user left
     * ticked or unticked, and which hand-sorted rows the rule may take over
     * once (spec 35). Resolves with what the save did, rejects on error.
     */
    save: (id: number | null, rule: RuleInput, ticks: SaveTicks = {}) => save.mutateAsync({ id, rule, ticks }),
    saving: save.isPending,
    applyNow: () => apply.mutate(),
    applying: apply.isPending,
    setEnabled: (rule: Rule, enabled: boolean) => setEnabled.mutate({ rule, enabled }),
    reorder: (ids: number[]) => reorder.mutate(ids),
    remove: (rule: Rule) => remove.mutate(rule),
  };
}

// ---- Starter lists and known places (spec 13) ----

/** The starter lists on offer and what they would sort. Saves nothing. */
export const useStarters = (enabled = true) =>
  useQuery({ queryKey: queryKey("rules:starters"), queryFn: () => call("rules:starters", undefined), enabled, staleTime: 0 });

export function useAddStarters() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (keys: string[]) => call("rules:addStarters", { keys }),
    onSuccess: ({ changed }, keys) => toast.success(s.rulesV2.starters.added(keys.length), { description: s.rulesV2.starters.addedBody(changed) }),
    onError: failed,
    onSettled: () => refreshRules(client),
  });
}

/** The row menu's "Add <business> to known places of <category>". */
export function useAddKnownPlace() {
  const client = useQueryClient();
  const add = useMutation({
    mutationFn: ({ name, category }: { name: string; category: Category }) =>
      call("rules:addKnownPlace", { categoryId: category.id, name }),
    onSuccess: ({ added, changed }, { name, category }) => {
      const k = s.rulesV2.knownPlaces;
      toast.success(added ? k.added(name, category.name) : k.already(name, category.name), { description: k.body(changed) });
    },
    onError: failed,
    onSettled: () => refreshRules(client),
  });
  return (name: string, category: Category) => add.mutate({ name: name.replace(/\s+/g, " ").trim(), category });
}
