// One category out of a list shown as the tree (spec 34): indented by level,
// scrolling when long. Works as a radio group on lib/roving.ts: one Tab stop
// (the chosen line), the arrow keys move and choose, Home and End jump.

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRoving } from "@/lib/roving";
import type { TreeEntry } from "@/lib/categories";

const INDENT = ["", "ps-3", "ps-8", "ps-13"];

export function TreeChoice({
  value,
  entries,
  none,
  onChange,
  label,
}: {
  value: number | null;
  entries: TreeEntry[];
  /** The text of the "no parent" line; left out, there is none. */
  none?: string;
  onChange: (id: number | null) => void;
  label: string;
}) {
  const options: { id: number | null; depth: number; emoji: string | null; name: string }[] = [
    ...(none !== undefined ? [{ id: null, depth: 1, emoji: null, name: none }] : []),
    ...entries.map((e) => ({ id: e.category.id, depth: e.depth, emoji: e.category.emoji, name: e.category.name })),
  ];
  // Tab lands on the chosen line, or on the first one when none is chosen; moving chooses.
  const { list, item } = useRoving(
    options.map((o) => o.id ?? "none"),
    {
      start: Math.max(0, options.findIndex((o) => o.id === value)),
      onMove: (_from, to) => {
        const o = options[to];
        if (o) onChange(o.id);
      },
    },
  );

  // On open, the list (only the list, never the dialog) scrolls the chosen line into its middle.
  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = box.current;
    const chosen = el?.querySelector<HTMLElement>("[aria-checked='true']");
    if (el && chosen) el.scrollTop = chosen.offsetTop - (el.clientHeight - chosen.offsetHeight) / 2;
    // Once, when the list appears: later choices are made where the user is looking.
  }, []);

  return (
    <div
      ref={(el) => {
        box.current = el;
        list(el);
      }}
      role="radiogroup"
      aria-label={label}
      className="relative max-h-56 overflow-y-auto rounded-2xl border border-border p-1"
    >
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <button
            key={o.id ?? "none"}
            type="button"
            role="radio"
            aria-checked={on}
            {...item(i)}
            onClick={() => onChange(o.id)}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl py-1.5 pe-3 text-start text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
              INDENT[o.depth] ?? "ps-13",
              o.id === null && "text-muted-foreground",
              on && "bg-primary/10 text-foreground",
            )}
          >
            <span className="w-5 shrink-0 text-center leading-none">{o.emoji}</span>
            <span dir="auto" className={cn("min-w-0 flex-1 truncate", o.depth === 1 && o.id !== null && "font-medium")}>
              {o.name}
            </span>
            {on && <Check className="size-3.5 shrink-0 text-primary" />}
          </button>
        );
      })}
    </div>
  );
}
