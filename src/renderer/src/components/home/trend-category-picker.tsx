// The trend card's category filter (spec 16, F43): one list of checkboxes,
// groups with their categories under them, and uncategorized. Nothing ticked
// is all spending; "All spending" at the top always goes back to it.

import { useEffect, useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import type { Category } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import type { CategoryIndex } from "@/lib/categories";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TrendTicks } from "./trend-filter";

export function TrendCategoryPicker({
  index,
  ticks,
  onToggle,
  onClear,
  defaultOpen = false,
}: {
  index: CategoryIndex;
  ticks: TrendTicks;
  onToggle: (id: number | null) => void;
  onClear: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Demo screenshots open the list once the card has scrolled into view.
  useEffect(() => {
    if (!defaultOpen) return;
    const timer = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(timer);
  }, [defaultOpen]);

  const label =
    ticks.length === 0
      ? s.periodHome.trendAll
      : ticks.length === 1
        ? nameOf(index, ticks[0] ?? null)
        : s.periodHome.trendCount(ticks.length);

  const row = (id: number | null, name: string, emoji: string | null, sub: boolean) => (
    <label
      key={id ?? "none"}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent",
        sub && "ps-7",
      )}
    >
      <input
        type="checkbox"
        checked={ticks.includes(id)}
        onChange={() => onToggle(id)}
        className="size-3.5 shrink-0 accent-primary"
      />
      <span className="flex w-5 shrink-0 justify-center leading-none">{emoji}</span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
    </label>
  );
  const rowsOf = (group: Category) => [
    row(group.id, group.name, group.emoji, false),
    ...(index.children.get(group.id) ?? []).map((c) => row(c.id, c.name, c.emoji, true)),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={s.periodHome.trendPick}
        className="inline-flex h-8 items-center gap-2 rounded-xl border border-input bg-card px-3 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Layers className="size-3.5 text-muted-foreground" />
        <span className="max-w-48 truncate">{label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="max-h-80 overflow-y-auto p-1.5">
          <button
            type="button"
            onClick={() => {
              onClear();
              setOpen(false);
            }}
            className="mb-1 flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm font-medium transition-colors hover:bg-accent"
          >
            <Layers className="size-3.5 text-muted-foreground" />
            {s.periodHome.trendAll}
          </button>
          <div className="border-t border-border pt-1">
            {index.roots.filter((r) => r.kind === "expense").flatMap(rowsOf)}
            {row(null, s.common.uncategorized, null, false)}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function nameOf(index: CategoryIndex, id: number | null): string {
  return id === null ? s.common.uncategorized : (index.byId.get(id)?.name ?? s.common.other);
}
