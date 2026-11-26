// Rules: the ordered list, each rule as one plain sentence, with a switch,
// edit, delete with Undo, and reordering by drag (scrolling near the edges) or arrows.
// A friendly empty state explains what a rule is. Spec 13: Apply now, and
// the starter lists offer. Spec 21: numbered places, "also fits" lines from core,
// a toast after each move, and Ctrl+F search (no reordering while it is on).

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDownNarrowWide, Info, ListPlus, Plus, RefreshCw, WandSparkles } from "lucide-react";
import { toast } from "sonner";
import type { Rule } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { call } from "@/lib/api";
import { indexCategories } from "@/lib/categories";
import { useCategories, useRules } from "@/lib/hooks";
import { refreshRules } from "@/lib/query-keys";
import { useRuleActions, useStarters } from "@/lib/rule-actions";
import { moveId, placeAfterMove } from "@/lib/rules";
import { useShot } from "@/lib/shot";
import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Hint } from "@/components/ui/tooltip";
import { Card } from "@/components/common/card";
import { EmptyState, QueryError } from "@/components/common/empty-state";
import { useSentenceContext } from "@/components/rules/rule-sentence";
import { useRuleEditor } from "@/components/rules/rule-editor-provider";
import { StarterListsDialog } from "@/components/rules/starter-lists";
import { ruleHits } from "@/components/rules/rule-search";
import { FindBox, NoMatches } from "@/components/layout/find-box";
import { RuleLine } from "@/components/rules/rule-line";
import { runOrderShot } from "@/components/rules/order-shot";
import { useDragAutoScroll } from "./rules-drag-scroll";

type Drag = { id: number; order: number[] };

export function RulesPage() {
  const rules = useRules();
  const actions = useRuleActions();
  const { openEditor } = useRuleEditor();
  const context = useSentenceContext();
  const categories = useCategories();
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);

  const list = useMemo(() => rules.data ?? [], [rules.data]);
  const byId = useMemo(() => new Map(list.map((r) => [r.id, r])), [list]);
  const saved = list.map((r) => r.id);
  // While dragging, the list follows the pointer; after a drop it holds the
  // new order until the app's answer replaces the list.
  const [drag, setDrag] = useState<Drag | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  useDragAutoScroll(drag !== null, listRef);
  const [held, setHeld] = useState<{ ids: number[]; base: Rule[] | undefined } | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [startersOpen, setStartersOpen] = useState(false);
  const starters = useStarters();
  const offerStarters = (starters.data?.lists.length ?? 0) > 0;
  const order = drag?.order ?? (held && held.base === rules.data ? held.ids : saved);
  const ordered = order.flatMap((id) => byId.get(id) ?? []);
  // spec 21: the search hides rules that do not match; reordering is off meanwhile.
  const [search, setSearch] = useState("");
  const query = search.trim();
  const searching = query !== "";
  const shown = searching ? ordered.filter((r) => ruleHits(r, query, context)) : ordered;
  const placeOf = (id: number) => order.indexOf(id) + 1;

  /** `still` keeps the toast up without transitions, for screenshot runs. */
  const commit = (ids: number[], moved: number, still = false) => {
    if (ids.join() === saved.join()) return;
    setHeld({ ids, base: rules.data });
    actions.reorder(ids);
    const { place, nextId } = placeAfterMove(ids, moved);
    const next = nextId !== null ? byId.get(nextId) : undefined;
    toast.success(s.ruleOrder.moved(place), {
      description: next ? s.ruleOrder.runsBefore(next.name) : s.ruleOrder.runsLast,
      duration: still ? Infinity : undefined,
      className: still ? "!transition-none" : undefined,
    });
  };

  useDemoShot(list, openEditor, () => setStartersOpen(true), setSearch, (delta) => {
    const last = order.at(-1);
    if (last !== undefined) commit(moveId(order, order.length - 1, order.length - 1 + delta), last, true);
  });

  return (
    <Page title={s.rules.title}>
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start gap-8">
          <div className="max-w-2xl">
            <p className="text-[15px] leading-relaxed">{s.rules.intro}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.rules.yoursWin}</p>
          </div>
          {list.length > 0 && (
            <div className="ms-auto flex shrink-0 items-center gap-2">
              <Hint label={s.rulesV2.applyHint}>
                <Button
                  variant="outline"
                  className="h-10 rounded-full px-4"
                  disabled={actions.applying}
                  onClick={actions.applyNow}
                >
                  <RefreshCw className={cn(actions.applying && "animate-spin")} />
                  {s.rulesV2.applyNow}
                </Button>
              </Hint>
              <Button className="h-10 rounded-full px-5" onClick={() => openEditor({})}>
                <Plus />
                {s.rules.newRule}
              </Button>
            </div>
          )}
        </div>
        {offerStarters && (
          <button
            type="button"
            onClick={() => setStartersOpen(true)}
            className="mt-6 flex w-full items-center gap-4 rounded-2xl border border-dashed border-foreground/20 bg-card/60 px-5 py-3.5 text-start transition-colors outline-none hover:border-foreground/35 hover:bg-card focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <ListPlus className="size-5 shrink-0 text-primary" strokeWidth={1.75} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{s.rulesV2.starters.open}</span>
              <span className="block truncate text-xs text-muted-foreground">{s.rulesV2.starters.intro}</span>
            </span>
            {(starters.data?.sorts ?? 0) > 0 && (
              <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {s.rulesV2.starters.sorts(starters.data?.sorts ?? 0)}
              </span>
            )}
          </button>
        )}
        {startersOpen && <StarterListsDialog open onOpenChange={setStartersOpen} />}

        <div className="mt-8">
          {rules.isError ? (
            <Card>
              <QueryError error={rules.error} />
            </Card>
          ) : !rules.data ? (
            <Skeleton className="h-96 w-full rounded-3xl" />
          ) : list.length === 0 ? (
            <Card className="py-6">
              <EmptyState
                icon={WandSparkles}
                title={s.rules.emptyTitle}
                body={s.rules.emptyBody}
                action={
                  <div className="flex flex-col items-center gap-3">
                    <Button className="h-10 rounded-full px-5" onClick={() => openEditor({})}>
                      <Plus />
                      {s.rules.emptyAction}
                    </Button>
                    <p className="text-xs text-muted-foreground">{s.rules.emptyTip}</p>
                  </div>
                }
              />
            </Card>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1">
                <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground">
                  <ArrowDownNarrowWide className="size-4 shrink-0 text-primary" />
                  {s.ruleOrder.header}
                </p>
                <FindBox value={search} onChange={setSearch} placeholder={s.find.rulesPlaceholder} className="w-72 max-w-full" />
              </div>
              {searching && (
                <p className="mb-3 flex items-center gap-2 px-1 text-xs text-muted-foreground">
                  <Info className="size-3.5 shrink-0" />
                  {s.find.rulesShown(shown.length, list.length)} · {s.find.dragOff}
                </p>
              )}
              {searching && shown.length === 0 ? (
                <NoMatches query={query} onClear={() => setSearch("")} />
              ) : (
                <ol
                  ref={listRef}
                  className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card"
                  onDragOver={(e) => drag && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (drag) commit(drag.order, drag.id);
                    setDrag(null);
                  }}
                >
                  {shown.map((rule, i) => (
                    <RuleLine
                      key={rule.id}
                      rule={rule}
                      place={placeOf(rule.id)}
                      query={query}
                      index={index}
                      context={context}
                      searching={searching}
                      first={i === 0}
                      last={i === shown.length - 1}
                      dragging={drag?.id === rule.id}
                      draggable={!searching && armed === rule.id}
                      onArm={() => setArmed(rule.id)}
                      onDragStart={() => setDrag({ id: rule.id, order })}
                      onDragOver={() => {
                        if (!drag || drag.id === rule.id) return;
                        const next = moveId(drag.order, drag.order.indexOf(drag.id), drag.order.indexOf(rule.id));
                        if (next.join() !== drag.order.join()) setDrag({ ...drag, order: next });
                      }}
                      onDragEnd={() => {
                        setDrag(null);
                        setArmed(null);
                      }}
                      onMove={(delta) => {
                        const at = order.indexOf(rule.id);
                        commit(moveId(order, at, at + delta), rule.id);
                      }}
                      onOpen={() => openEditor({ rule })}
                      onToggle={(enabled) => actions.setEnabled(rule, enabled)}
                      onDelete={() => actions.remove(rule)}
                    />
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
        {list.length > 1 && !searching && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {s.rules.count(list.length)} · {s.rules.drag}
          </p>
        )}
      </div>
    </Page>
  );
}

/**
 * Screenshot aid: `?shot=new`, `?shot=edit-Groceries` (by name) or `?shot=suggest` opens
 * the editor; `?shot=empty` deletes every demo rule to show the empty state.
 * Spec 13: `?shot=handset` opens a rule that would take over rows sorted by
 * hand (spec 35: they show in the preview list, no scrolling needed),
 * `?shot=starters` the starter lists. Spec 21: `?shot=find-<text>` searches,
 * `?shot=move` moves the last rule up one (a real reorder) to show its toast.
 * Spec 41: `?shot=hints`, `overrides` and `setbyyou` (see order-shot.ts).
 */
function useDemoShot(
  rules: Rule[],
  openEditor: ReturnType<typeof useRuleEditor>["openEditor"],
  openStarters: () => void,
  setSearch: (text: string) => void,
  moveLast: (delta: -1) => void,
) {
  const shot = useShot();
  const client = useQueryClient();
  const ready = rules.length > 0;
  useEffect(() => {
    if (!shot || !ready) return;
    const id = setTimeout(() => {
      if (shot === "new") openEditor({});
      const rule = rules.find((r) => `edit-${r.name}` === shot);
      if (rule) openEditor({ rule });
      if (shot === "empty") {
        void Promise.all(rules.map((r) => call("rules:delete", { id: r.id }))).then(() => refreshRules(client));
      }
      if (shot === "starters") openStarters();
      if (shot.startsWith("find-")) setSearch(shot.slice("find-".length));
      if (shot === "move") moveLast(-1);
      void runOrderShot(shot, openEditor, () => refreshRules(client));
      if (shot === "handset") {
        void call("categories:list", undefined).then((all) => {
          openEditor({
            draft: {
              name: "Bit and PayBox",
              enabled: true,
              join: "any",
              conditions: [
                { kind: "text", field: "description", mode: "starts_with", values: ["העברה ב-BIT", "PAYBOX"] },
                { kind: "text", field: "memo", mode: "contains", values: ["דנה"] },
              ],
              setCategoryId: all.find((c) => c.name === "Cash & ATM")?.id ?? null,
              setExcluded: null,
            },
          });
        });
      }
      if (shot === "suggest") {
        void call("transactions:list", { search: "שופרסל" }).then(async ({ rows }) => {
          const picked = [...new Map(rows.map((r) => [r.description, r.id])).values()];
          openEditor({ draft: await call("rules:suggest", { ids: picked }), optIn: true });
        });
      }
    }, 400);
    return () => clearTimeout(id);
    // Once per load: the rules list refreshing must not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, ready]);
}
