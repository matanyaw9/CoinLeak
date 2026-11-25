// Picks the categories the curves card draws (spec 26, F61): any spending
// categories at any of the three levels (spec 34), or uncategorized, up to the limit.
// It stays open while ticking; the list is one Tab stop and the arrow keys
// move between the lines (lib/roving.ts).

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Tag } from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { treeOf, type CategoryIndex } from "@/lib/categories";
import { useRoving } from "@/lib/roving";
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
  const tree = treeOf(index, "expense");
  // One Tab stop for the tree and the "uncategorized" line after it; the
  // arrow keys move, Enter or Space ticks. Lines past the limit stay reachable.
  const { list, item } = useRoving([...tree.map((e) => e.category.id), "none"]);

  const row = (i: number, id: number | null, label: string, emoji: ReactNode, depth: number) => {
    const on = chosen.includes(id);
    const blocked = full && !on;
    return (
      <button
        key={id ?? "none"}
        type="button"
        role="menuitemcheckbox"
        {...item(i)}
        aria-checked={on}
        aria-disabled={blocked}
        onClick={() => !blocked && onToggle(id)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm transition-colors",
          blocked ? "cursor-default opacity-45" : "hover:bg-accent",
          depth === 2 && "ps-7",
          depth >= 3 && "ps-12",
        )}
      >
        <span className="flex w-5 shrink-0 justify-center leading-none">{emoji}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {on && <Check className="size-3.5 text-primary" />}
      </button>
    );
  };

  const rows = tree.map(({ category: c, depth }, i) => row(i, c.id, c.name, c.emoji, depth));

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
        <div ref={list} className="max-h-80 overflow-y-auto p-1.5">
          {rows}
          <div className="mt-1 border-t border-border pt-1">
            {row(tree.length, null, s.common.uncategorized, <Tag className="size-3.5 text-muted-foreground" />, 1)}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
