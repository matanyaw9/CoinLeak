// Picks the one category the curves card draws: any spending category, top
// level or sub, or uncategorized. Unlike the transaction picker, parents count.

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Layers, Tag } from "lucide-react";
import type { Category } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import type { CategoryIndex } from "@/lib/categories";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function CurveCategoryPicker({
  index,
  value,
  onSelect,
  all,
}: {
  index: CategoryIndex;
  /** Undefined is "all spending" when `all` names it (spec 16). */
  value: number | null | undefined;
  all?: string;
  onSelect: (id: number | null | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const chosen = value == null ? null : index.byId.get(value);
  const pick = (id: number | null | undefined) => {
    setOpen(false);
    onSelect(id);
  };

  const row = (key: string, id: number | null | undefined, label: string, emoji: ReactNode, indent: boolean) => (
    <button
      key={key}
      type="button"
      onClick={() => pick(id)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent",
        indent && "ps-7",
      )}
    >
      <span className="flex w-5 shrink-0 justify-center leading-none">{emoji}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value === id && <Check className="size-3.5 text-primary" />}
    </button>
  );

  const roots = index.roots.filter((r) => r.kind === "expense");
  const rowsOf = (r: Category) => [
    row(String(r.id), r.id, r.name, r.emoji, false),
    ...(index.children.get(r.id) ?? []).map((c) => row(String(c.id), c.id, c.name, c.emoji, true)),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={s.curves.pick}
        className="inline-flex h-8 items-center gap-2 rounded-xl border border-input bg-card px-3 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="flex w-4 justify-center leading-none">
          {chosen ? chosen.emoji : value === undefined && all ? <Layers className="size-3.5 text-muted-foreground" /> : <Tag className="size-3.5 text-muted-foreground" />}
        </span>
        <span className="max-w-48 truncate">{chosen ? chosen.name : value === undefined && all ? all : s.common.uncategorized}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="max-h-80 overflow-y-auto p-1.5">
          {all && (
            <div className="mb-1 border-b border-border pb-1">{row("all", undefined, all, <Layers className="size-3.5 text-muted-foreground" />, false)}</div>
          )}
          {roots.flatMap(rowsOf)}
          <div className="mt-1 border-t border-border pt-1">
            {row("none", null, s.common.uncategorized, <Tag className="size-3.5 text-muted-foreground" />, false)}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
