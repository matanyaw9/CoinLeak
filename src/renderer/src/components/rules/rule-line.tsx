// One rule on the Rules page: its place in the order, a drag grip and move
// arrows (both hidden while searching, spec 21), its category, name and
// sentence, what the search found, "also fits" lines from core, and the
// switch, edit and delete.

import { ChevronDown, ChevronUp, EyeOff, GripVertical, Layers, Pencil, Trash, WandSparkles } from "lucide-react";
import type { Rule } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import type { CategoryIndex } from "@/lib/categories";
import type { SentenceContext } from "@/lib/rule-sentence";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Hint } from "@/components/ui/tooltip";
import { CategoryBubble, IconBubble } from "@/components/common/chips";
import { Highlight } from "@/components/layout/find-box";
import { RuleSentence } from "./rule-sentence";
import { valueHits } from "./rule-search";

/** Names shown per list in a rule's sentence before "or N more". */
const SENTENCE_VALUES = 6;

export function RuleLine({
  rule,
  place,
  placeOf,
  query,
  index,
  context,
  searching,
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
  /** Any rule's place in the order, for "that rule 2 decides". */
  placeOf: (id: number) => number;
  query: string;
  index: CategoryIndex;
  context: SentenceContext;
  /** While searching, the order cannot change: no grip, no arrows. */
  searching: boolean;
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
  // spec 21: values the search found that the sentence may cut off.
  const found = query ? valueHits(rule, query, context) : [];
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
      <div className="flex w-4 shrink-0 justify-center">
        {!searching && (
          <Hint label={s.rules.drag} side="left">
            <button
              type="button"
              aria-label={s.rules.drag}
              onPointerDown={onArm}
              className="flex cursor-grab items-center rounded-md text-muted-foreground opacity-0 transition-opacity outline-none group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
            >
              <GripVertical className="size-4" />
            </button>
          </Hint>
        )}
      </div>
      {/* spec 21: every rule shows its place; 1 is checked first. */}
      <span
        aria-label={s.ruleOrder.place(place)}
        className="num -ms-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-[13px] font-semibold text-secondary-foreground tabular-nums"
      >
        {place}
      </span>

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
            <Highlight text={rule.name} query={query} />
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
        {found.length > 0 && (
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {s.find.foundIn}
            {found.map((v) => (
              <bdi key={v} className="rounded-full bg-secondary px-2 py-px text-secondary-foreground">
                <Highlight text={v} query={query} />
              </bdi>
            ))}
          </span>
        )}
        {rule.enabled &&
          rule.overlaps?.map((o) => {
            const winner = o.winnerId === null ? null : placeOf(o.winnerId);
            const text = o.action === "category" ? s.ruleOrder.alsoFits : s.ruleOrder.alsoFitsExclude;
            return (
              <span key={o.action} className="mt-1 flex items-center gap-1.5 text-xs text-status-heads-up">
                <Layers className="size-3.5 shrink-0" />
                {text(o.count, winner !== null && winner > 0 ? winner : null)}
              </span>
            );
          })}
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <div className="flex items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {!searching && (
            <>
              <Button variant="ghost" size="icon-xs" className="rounded-full" aria-label={s.rules.moveUp} disabled={first} onClick={() => onMove(-1)}>
                <ChevronUp />
              </Button>
              <Button variant="ghost" size="icon-xs" className="rounded-full" aria-label={s.rules.moveDown} disabled={last} onClick={() => onMove(1)}>
                <ChevronDown />
              </Button>
            </>
          )}
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
