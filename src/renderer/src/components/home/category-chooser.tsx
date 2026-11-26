// One button that opens a searchable list of spending categories with tick
// boxes (spec 38, F79; spec 40 B, F91), for both Home charts. Above the list,
// a chip for each category the chart gets. Ticks are a draft until Apply;
// Esc or a click outside drops them. Typing goes to the search box, Down
// moves into the list, Space ticks, Enter applies. The list and the chips are
// one Tab stop each (lib/roving.ts); Delete or Backspace removes a chip.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, Minus, Search, X } from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { pathOf, type CategoryIndex } from "@/lib/categories";
import { useRoving } from "@/lib/roving";
import { TreeGuides } from "@/components/categories/tree-guides";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chooserItems, chooserLabel, nameOf, partlyTicked, smallest, tickDraft, tickState, type ChooserItem } from "./chooser";
import type { TrendTicks } from "./trend-filter";

/** Screenshot runs: open by itself with a search typed and some lines ticked. */
export interface ChooserDemo {
  search: string;
  ticks: TrendTicks;
}

interface ChooserProps {
  index: CategoryIndex;
  /** The applied ticks. */
  value: TrendTicks;
  onApply: (ticks: TrendTicks) => void;
  /** With nothing ticked: what the chart shows, on the button, the footer button that clears and the chips row ("Top 5", "All spending"). */
  none: string;
  icon: ReactNode;
  /** The most ticks core takes, if it has a limit. */
  limit?: number;
  demo?: ChooserDemo;
}

export function CategoryChooser({ index, value, onApply, none, icon, limit, demo }: ChooserProps) {
  const [open, setOpen] = useState(false);
  const isDemo = demo !== undefined;
  // Demo screenshots open the list once the card has scrolled into view.
  useEffect(() => {
    if (!isDemo) return;
    const timer = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(timer);
  }, [isDemo]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={s.curvePick.pick}
        className="inline-flex h-8 items-center gap-2 rounded-xl border border-input bg-card px-3 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {icon}
        <span className="max-w-48 truncate">{chooserLabel(value, index, none)}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      {/* The panel exists only while open, so every opening starts a fresh draft. Hidden screenshot runs skip the animation. */}
      <PopoverContent align="end" className={cn("w-80 p-0", isDemo && "!animate-none")}>
        <ChooserPanel
          index={index}
          start={demo?.ticks ?? value}
          search={demo?.search ?? ""}
          none={none}
          limit={limit}
          onApply={(ticks) => {
            setOpen(false);
            onApply(ticks);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function ChooserPanel({
  index,
  start,
  search,
  none,
  limit,
  onApply,
}: {
  index: CategoryIndex;
  start: TrendTicks;
  search: string;
  none: string;
  limit?: number;
  onApply: (ticks: TrendTicks) => void;
}) {
  const [query, setQuery] = useState(search);
  const [draft, setDraft] = useState<TrendTicks>(() => smallest(start, index));
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLElement | null>(null);
  const items = chooserItems(index, query);
  const searching = query.trim() !== "";
  const { list, item } = useRoving(items.map((x) => x.id ?? "none"));
  // A click that would change nothing: the list would grow past the limit.
  const refused = (id: number | null) => tickDraft(draft, id, index, limit) === draft;
  const full = limit !== undefined && (draft.length >= limit || items.some((x) => refused(x.id)));

  // Focus after the popup is positioned, so the page does not jump.
  useEffect(() => {
    const frame = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);

  const tick = (id: number | null) => setDraft((d) => tickDraft(d, id, index, limit));
  const firstLine = () => box.current?.querySelector<HTMLElement>("[role='checkbox']")?.focus();

  const onLineKey = (e: KeyboardEvent<HTMLElement>, i: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onApply(draft);
    } else if (e.key === "ArrowUp" && i === 0) {
      e.preventDefault();
      input.current?.focus();
    } else if ((e.key.length === 1 && e.key !== " ") || e.key === "Backspace") {
      // Typing goes to the search box; the key lands there.
      if (!e.ctrlKey && !e.metaKey && !e.altKey) input.current?.focus();
    } else {
      item(i).onKeyDown(e);
    }
  };

  const line = (x: ChooserItem, i: number) => {
    const state = tickState(draft, x.id, index);
    const blocked = refused(x.id);
    return (
      <button
        key={x.id ?? "none"}
        type="button"
        role="checkbox"
        {...item(i)}
        aria-checked={state === "partly" ? "mixed" : state === "on"}
        aria-disabled={blocked}
        // After the roving props: this handler passes the arrow keys on to them.
        onKeyDown={(e) => onLineKey(e, i)}
        onClick={() => tick(x.id)}
        className={cn(
          // No vertical padding here, so the guide lines of neighbouring rows join.
          "flex w-full rounded-lg px-2 text-start text-sm transition-colors outline-none focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
          blocked ? "cursor-default opacity-45" : "hover:bg-accent",
          x.id === null && !searching && "mt-1 border-t border-border pt-0.5",
        )}
      >
        <TreeGuides depth={x.depth} />
        <span className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5">
          <span
            aria-hidden
            className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
              state === "off" ? "border-input bg-card" : "border-primary bg-primary text-primary-foreground",
            )}
          >
            {state === "on" && <Check className="size-3" strokeWidth={3} />}
            {state === "partly" && <Minus className="size-3" strokeWidth={3} />}
          </span>
          <span className="flex w-5 shrink-0 justify-center leading-none">{x.emoji}</span>
          {searching && x.id !== null ? (
            // The full path wraps rather than hiding the name; what is above it is muted.
            <span className="min-w-0 flex-1 break-words">
              <span className="text-muted-foreground">{x.label.slice(0, x.label.length - nameOf(index, x.id).length)}</span>
              <span className="whitespace-nowrap">{nameOf(index, x.id)}</span>
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate">{x.label}</span>
          )}
        </span>
      </button>
    );
  };

  // The search box stays first and the chips show above the list, but the
  // chips come after the list in the page, so Tab goes list, chips, buttons.
  return (
    <div className="flex flex-col">
      <div className="order-1 flex items-center gap-2 border-b border-border px-3.5 py-3">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={input}
          value={query}
          aria-label={s.chooser.search}
          placeholder={s.chooser.search}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              firstLine();
            } else if (e.key === "Enter") {
              e.preventDefault();
              onApply(draft);
            }
          }}
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      <div
        ref={(el) => {
          list(el);
          box.current = el;
        }}
        role="group"
        aria-label={s.curvePick.pick}
        className="order-3 max-h-72 overflow-y-auto p-1.5"
      >
        {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">{s.chooser.noMatch}</p>}
        {items.map(line)}
      </div>
      <div className="order-2 border-b border-border px-3.5 py-2">
        <Chips
          index={index}
          ticks={draft}
          none={none}
          onChange={setDraft}
          onEmpty={() => input.current?.focus()}
        />
        {full && limit !== undefined && <p className="mt-1.5 text-xs text-muted-foreground">{s.chooser.limit(limit)}</p>}
      </div>
      <div className="order-4 flex items-center justify-between gap-2 border-t border-border p-2">
        <Button variant="ghost" size="sm" onClick={() => onApply([])}>
          {none}
        </Button>
        <Button size="sm" title={s.chooser.keys} onClick={() => onApply(draft)}>
          {s.chooser.apply}
        </Button>
      </div>
    </div>
  );
}

/** One chip per category the chart gets, each removable, then Clear all. */
function Chips({
  index,
  ticks,
  none,
  onChange,
  onEmpty,
}: {
  index: CategoryIndex;
  ticks: TrendTicks;
  none: string;
  onChange: (ticks: TrendTicks) => void;
  /** The last chip or Clear all went: focus needs somewhere to be. */
  onEmpty: () => void;
}) {
  const box = useRef<HTMLDivElement | null>(null);
  // One line of chips that wraps: Left and Right move along it.
  const { list, item } = useRoving(
    ticks.map((id) => id ?? "none"),
    { columns: ticks.length },
  );

  const remove = (i: number) => {
    // Focus moves on before the chip goes: to the next one, else the one before.
    const buttons = box.current?.querySelectorAll("button");
    const neighbour = buttons?.[i + 1] ?? buttons?.[i - 1];
    if (neighbour) neighbour.focus();
    else onEmpty();
    onChange(ticks.filter((_, at) => at !== i));
  };

  if (ticks.length === 0) return <p className="py-1 text-xs text-muted-foreground">{s.chooserChips.nothing(none)}</p>;

  const partly = partlyTicked(ticks, index);
  const clear = () => {
    onChange([]);
    onEmpty();
  };

  return (
    <div className="flex flex-wrap items-start gap-x-2">
      <p className="w-full text-xs text-muted-foreground">{s.chooserChips.selected}</p>
      <div
        ref={(el) => {
          list(el);
          box.current = el;
        }}
        role="group"
        aria-label={s.chooserChips.selected}
        className="mt-1 flex max-h-20 min-w-0 flex-1 flex-wrap gap-1.5 overflow-y-auto p-0.5"
      >
        {ticks.map((id, i) => {
          const category = id === null ? undefined : index.byId.get(id);
          const name = nameOf(index, id);
          return (
            <span
              key={id ?? "none"}
              title={category ? pathOf(index, category) : name}
              className="flex max-w-full items-center gap-1 rounded-lg border border-border bg-card py-0.5 ps-2 pe-1 text-xs has-focus-visible:ring-2 has-focus-visible:ring-ring/50"
            >
              {category?.emoji && <span className="leading-none">{category.emoji}</span>}
              <span className="truncate">{name}</span>
              <button
                type="button"
                {...item(i)}
                aria-label={s.chooserChips.remove(name)}
                onClick={() => remove(i)}
                onKeyDown={(e) => {
                  if (e.key === "Delete" || e.key === "Backspace") {
                    e.preventDefault();
                    remove(i);
                  } else {
                    item(i).onKeyDown(e);
                  }
                }}
                className="shrink-0 rounded-md p-0.5 text-muted-foreground outline-none hover:bg-accent hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}
      </div>
      <Button variant="ghost" size="xs" className="mt-1" onClick={clear}>
        {s.chooserChips.clear}
      </Button>
      {partly.length > 0 && (
        // Capped like the chips, so many notes never push Apply off the screen.
        <div className="mt-1.5 max-h-20 w-full overflow-y-auto text-xs text-muted-foreground">
          {partly.map((id) => (
            <p key={id}>{s.chooserOwnRows.notCounted(nameOf(index, id))}</p>
          ))}
        </div>
      )}
    </div>
  );
}
