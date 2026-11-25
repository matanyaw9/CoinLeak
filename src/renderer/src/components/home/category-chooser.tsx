// One button that opens a searchable list of spending categories with tick
// boxes (spec 38, F79), for both Home charts. Ticks are a draft until Apply;
// Esc or a click outside drops them. Typing goes to the search box, Down
// moves into the list (one Tab stop, lib/roving.ts), Space ticks, Enter applies.

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import type { CategoryIndex } from "@/lib/categories";
import { useRoving } from "@/lib/roving";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { chooserItems, chooserLabel, nameOf, tickDraft, tickedAbove, type ChooserItem } from "./chooser";
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
  /** With nothing ticked: the button's label and the footer button that clears ("Top 5", "All spending"). */
  none: string;
  icon: ReactNode;
  /** The most ticks core takes, if it has a limit. */
  limit?: number;
  demo?: ChooserDemo;
}

const INDENT = ["", "ps-2", "ps-7", "ps-12"];

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
  const [draft, setDraft] = useState<TrendTicks>(start);
  const input = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLElement | null>(null);
  const items = chooserItems(index, query);
  const searching = query.trim() !== "";
  const { list, item } = useRoving(items.map((x) => x.id ?? "none"));
  const refused = (id: number | null) => !draft.includes(id) && tickDraft(draft, id, index, limit) === draft;
  const full = limit !== undefined && draft.length >= limit;

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
    const on = draft.includes(x.id);
    const above = on ? null : tickedAbove(draft, x.id, index);
    const inside = above !== null;
    const blocked = refused(x.id);
    return (
      <button
        key={x.id ?? "none"}
        type="button"
        role="checkbox"
        {...item(i)}
        aria-checked={on}
        aria-disabled={blocked}
        title={inside ? s.chooser.included(nameOf(index, above)) : undefined}
        // After the roving props: this handler passes the arrow keys on to them.
        onKeyDown={(e) => onLineKey(e, i)}
        onClick={() => !blocked && tick(x.id)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg py-1.5 pe-2 text-start text-sm transition-colors outline-none focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
          INDENT[x.depth] ?? "ps-12",
          blocked ? "cursor-default opacity-45" : "hover:bg-accent",
          x.id === null && !searching && "mt-1 border-t border-border pt-2",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
            on ? "border-primary bg-primary text-primary-foreground" : inside ? "border-primary/40 bg-primary/15 text-primary" : "border-input bg-card",
          )}
        >
          {(on || inside) && <Check className="size-3" strokeWidth={3} />}
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
      </button>
    );
  };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
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
      {full && limit !== undefined && <div className="border-b border-border px-3.5 py-2 text-xs text-muted-foreground">{s.chooser.limit(limit)}</div>}
      <div
        ref={(el) => {
          list(el);
          box.current = el;
        }}
        role="group"
        aria-label={s.curvePick.pick}
        className="max-h-80 overflow-y-auto p-1.5"
      >
        {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">{s.chooser.noMatch}</p>}
        {items.map(line)}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border p-2">
        <Button variant="ghost" size="sm" onClick={() => onApply([])}>
          {none}
        </Button>
        <Button size="sm" title={s.chooser.keys} onClick={() => onApply(draft)}>
          {s.chooser.apply}
        </Button>
      </div>
    </>
  );
}

