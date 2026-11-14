// Picks the categories the curves card draws (spec 26, F61): any spending
// categories, groups or subcategories, or uncategorized, up to the limit.
// Unlike the transaction picker, groups count; it stays open while ticking.

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Tag } from "lucide-react";
import type { Category } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import type { CategoryIndex } from "@/lib/categories";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { atLimit, MAX_CHOSEN, type CurveChoice } from "./curve-selection";

export function CurveCategoryPicker({
  index,
  chosen,
  onToggle,
  defaultOpen = false,
}: {
  index: CategoryIndex;
  chosen: CurveChoice;
  onToggle: (id: number | null) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const full = atLimit(chosen);

  const row = (key: string, id: number | null, label: string, emoji: ReactNode, indent: boolean) => {
    const on = chosen.includes(id);
    const blocked = full && !on;
    return (
      <button
        key={key}
        type="button"
        role="menuitemcheckbox"
        aria-checked={on}
        aria-disabled={blocked}
        onClick={() => !blocked && onToggle(id)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm transition-colors",
          blocked ? "cursor-default opacity-45" : "hover:bg-accent",
          indent && "ps-7",
        )}
      >
        <span className="flex w-5 shrink-0 justify-center leading-none">{emoji}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {on && <Check className="size-3.5 text-primary" />}
      </button>
    );
  };

  const roots = index.roots.filter((r) => r.kind === "expense");
  const rowsOf = (r: Category) => [
    row(String(r.id), r.id, r.name, r.emoji, false),
    ...(index.children.get(r.id) ?? []).map((c) => row(String(c.id), c.id, c.name, c.emoji, true)),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={s.curvePick.pick}
        className="inline-flex h-8 items-center gap-2 rounded-xl border border-input bg-card px-3 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <Tag className="size-3.5 text-muted-foreground" />
        <span className="max-w-48 truncate">{chosen.length > 0 ? s.curvePick.chosen(chosen.length) : s.curvePick.pick}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        {full && <div className="border-b border-border px-3.5 py-2 text-xs text-muted-foreground">{s.curvePick.limit(MAX_CHOSEN)}</div>}
        <div className="max-h-80 overflow-y-auto p-1.5">
          {roots.flatMap(rowsOf)}
          <div className="mt-1 border-t border-border pt-1">
            {row("none", null, s.common.uncategorized, <Tag className="size-3.5 text-muted-foreground" />, false)}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
