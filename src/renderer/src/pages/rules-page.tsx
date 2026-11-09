// Rules: the ordered list, each rule as one plain sentence, with a switch,
// edit, delete with Undo, and reordering by drag (scrolling near the edges) or arrows.
// A friendly empty state explains what a rule is. Spec 13: Apply now, and
// the starter lists offer.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, EyeOff, GripVertical, ListPlus, Pencil, Plus, RefreshCw, Trash, WandSparkles } from "lucide-react";
import type { Rule } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { call } from "@/lib/api";
import { indexCategories, type CategoryIndex } from "@/lib/categories";
import { refreshRules, useCategories, useRules } from "@/lib/hooks";
import { useRuleActions, useStarters } from "@/lib/rule-actions";
import { moveId } from "@/lib/rules";
import { useShot } from "@/lib/shot";
import type { SentenceContext } from "@/lib/rule-sentence";
import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { Hint } from "@/components/ui/tooltip";
import { Card } from "@/components/common/card";
import { EmptyState, QueryError } from "@/components/common/empty-state";
import { CategoryBubble, IconBubble } from "@/components/common/chips";
import { RuleSentence, useSentenceContext } from "@/components/rules/rule-sentence";
import { useRuleEditor } from "@/components/rules/rule-editor-provider";
import { StarterListsDialog } from "@/components/rules/starter-lists";
import { useDragAutoScroll } from "./rules-drag-scroll";

/** Names shown per list in a rule's sentence before "or N more". */
const SENTENCE_VALUES = 6;

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
  const shown = order.flatMap((id) => byId.get(id) ?? []);

  const commit = (ids: number[]) => {
    if (ids.join() === saved.join()) return;
    setHeld({ ids, base: rules.data });
    actions.reorder(ids);
  };

  useDemoShot(list, openEditor, () => setStartersOpen(true));

  return (
    <Page title={s.rules.title}>
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start gap-8">
          <div className="max-w-2xl">
            <p className="text-[15px] leading-relaxed">{s.rules.intro}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {s.rules.order} {s.rules.yoursWin}
            </p>
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
            <ol
              ref={listRef}
              className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card"
              onDragOver={(e) => drag && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (drag) commit(drag.order);
                setDrag(null);
              }}
            >
              {shown.map((rule, i) => (
                <RuleLine
                  key={rule.id}
                  rule={rule}
                  place={i + 1}
                  index={index}
                  context={context}
                  first={i === 0}
                  last={i === shown.length - 1}
                  dragging={drag?.id === rule.id}
                  draggable={armed === rule.id}
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
                  onMove={(delta) => commit(moveId(order, i, i + delta))}
                  onOpen={() => openEditor({ rule })}
                  onToggle={(enabled) => actions.setEnabled(rule, enabled)}
                  onDelete={() => actions.remove(rule)}
                />
              ))}
            </ol>
          )}
        </div>
        {list.length > 1 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            {s.rules.count(list.length)} · {s.rules.drag}
          </p>
        )}
      </div>
    </Page>
  );
}

function RuleLine({
  rule,
  place,
  index,
  context,
  first,
  last,
  dragging,
  draggable,
  onArm,
  onDragStart,
  onDragOver,
  onDragEnd,
  onMove,
  onOpen,
  onToggle,
  onDelete,
}: {
  rule: Rule;
  place: number;
  index: CategoryIndex;
  context: SentenceContext;
  first: boolean;
  last: boolean;
  dragging: boolean;
  draggable: boolean;
  onArm: () => void;
  onDragStart: () => void;
  onDragOver: () => void;
  onDragEnd: () => void;
  onMove: (delta: -1 | 1) => void;
  onOpen: () => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  const category = rule.setCategoryId != null ? index.byId.get(rule.setCategoryId) : undefined;
  return (
    <li
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", rule.name);
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative flex items-center gap-4 py-4 ps-3 pe-5 transition-colors hover:bg-accent/30",
        dragging && "bg-accent/50 opacity-70",
      )}
    >
      <div className="relative flex w-7 shrink-0 justify-center">
        <span
          className={cn(
            "num text-sm text-muted-foreground/70 tabular-nums transition-opacity group-hover:opacity-0",
            dragging && "opacity-0",
          )}
        >
          {place}
        </span>
        <Hint label={s.rules.drag} side="left">
          <button
            type="button"
            aria-label={s.rules.drag}
            onPointerDown={onArm}
            className="absolute inset-y-0 flex cursor-grab items-center rounded-md text-muted-foreground opacity-0 transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        </Hint>
      </div>

      <div className={cn("shrink-0 transition-opacity", !rule.enabled && "opacity-45 grayscale")}>
        {category ? (
          <CategoryBubble category={category} size={40} />
        ) : (
          <IconBubble icon={rule.setExcluded ? EyeOff : WandSparkles} size={40} />
        )}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="flex items-center gap-2">
          <span dir="auto" className={cn("truncate text-[15px] font-medium", !rule.enabled && "text-muted-foreground")}>
            {rule.name}
          </span>
          {!rule.enabled && (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-px text-[11px] font-medium text-muted-foreground">
              {s.rules.off}
            </span>
          )}
        </span>
        <RuleSentence
          rule={rule}
          context={context}
          maxValues={SENTENCE_VALUES}
          className={cn("mt-0.5 text-[13px]", !rule.enabled && "opacity-70")}
        />
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <div className="flex items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          <Button variant="ghost" size="icon-xs" className="rounded-full" aria-label={s.rules.moveUp} disabled={first} onClick={() => onMove(-1)}>
            <ChevronUp />
          </Button>
          <Button variant="ghost" size="icon-xs" className="rounded-full" aria-label={s.rules.moveDown} disabled={last} onClick={() => onMove(1)}>
            <ChevronDown />
          </Button>
          <Button variant="ghost" size="icon-xs" className="rounded-full" aria-label={s.rules.edit} onClick={onOpen}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded-full hover:bg-status-over/10 hover:text-status-over"
            aria-label={s.rules.delete}
            onClick={onDelete}
          >
            <Trash />
          </Button>
        </div>
        <Switch className="ms-2" checked={rule.enabled} onCheckedChange={onToggle} aria-label={s.rules.toggle(rule.name)} />
      </div>
    </li>
  );
}

/**
 * Screenshot aid: `?shot=new`, `?shot=edit-Groceries` (by name) or `?shot=suggest` opens
 * the editor; `?shot=empty` deletes every demo rule to show the empty state.
 * Spec 13: `?shot=handset` opens a rule that would take over rows sorted by
 * hand, `?shot=starters` the starter lists.
 */
function useDemoShot(rules: Rule[], openEditor: ReturnType<typeof useRuleEditor>["openEditor"], openStarters: () => void) {
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
        setTimeout(() => {
          const form = document.querySelector("[data-hand-set]")?.closest("form");
          if (form) form.scrollTop = form.scrollHeight;
        }, 1500);
      }
      if (shot === "suggest") {
        void call("transactions:list", { search: "שופרסל" }).then(async (rows) => {
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
