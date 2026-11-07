// Searchable category popover: the two-level tree while browsing, a flat
// list of matches while searching. Enter picks the first match.
// Adapted from Spent (github.com/Shaya16/Spent), src/components/transactions/category-picker.tsx.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Search } from "lucide-react";
import type { Category, CategoryKind } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { pathOf, type CategoryIndex } from "@/lib/categories";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function CategoryPicker({
  index,
  value,
  preferKind = "expense",
  onSelect,
  children,
  triggerClassName,
  align = "start",
  side,
}: {
  index: CategoryIndex;
  /** The current category, marked with a check. */
  value?: number | null;
  preferKind?: CategoryKind;
  onSelect: (category: Category | null) => void;
  children: ReactNode;
  triggerClassName?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // Focus after the popup is positioned, so the page does not jump.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const q = query.trim().toLowerCase();
  const kinds: CategoryKind[] = preferKind === "income" ? ["income", "expense"] : ["expense", "income"];
  const selectable = (c: Category) => !(index.children.get(c.id)?.length);
  const matches = q
    ? [...index.byId.values()].filter((c) => selectable(c) && pathOf(index, c).toLowerCase().includes(q))
    : [];

  const finish = (c: Category | null) => {
    setOpen(false);
    setQuery("");
    onSelect(c);
  };

  const row = (c: Category, label: string, indent: boolean) => (
    <button
      key={c.id}
      type="button"
      onClick={() => finish(c)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent",
        indent && "ps-7",
      )}
    >
      <span className="w-5 shrink-0 text-center leading-none">{c.emoji}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value === c.id && <Check className="size-3.5 text-primary" />}
    </button>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger className={triggerClassName}>{children}</PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-72 p-0">
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) {
                e.preventDefault();
                finish(matches[0]);
              }
            }}
            placeholder={s.picker.search}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {q ? (
            matches.length ? (
              matches.map((c) => row(c, pathOf(index, c), false))
            ) : (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">{s.picker.noMatch}</p>
            )
          ) : (
            <>
              {kinds.map((kind) => {
                const roots = index.roots.filter((r) => r.kind === kind);
                if (!roots.length) return null;
                return (
                  <div key={kind} className="pb-1">
                    <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                      {kind === "expense" ? s.picker.spending : s.picker.income}
                    </div>
                    {roots.flatMap((r) => {
                      const kids = index.children.get(r.id) ?? [];
                      if (!kids.length) return [row(r, r.name, false)];
                      return [
                        <div key={`h${r.id}`} className="flex items-center gap-2.5 px-2 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground">
                          <span className="w-5 text-center">{r.emoji}</span>
                          {r.name}
                        </div>,
                        ...kids.map((c) => row(c, c.name, true)),
                      ];
                    })}
                  </div>
                );
              })}
              {value != null && (
                <button
                  type="button"
                  onClick={() => finish(null)}
                  className="mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-border px-2 py-2 text-start text-sm text-muted-foreground transition-colors hover:bg-accent"
                >
                  <span className="w-5" />
                  {s.picker.none}
                </button>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
