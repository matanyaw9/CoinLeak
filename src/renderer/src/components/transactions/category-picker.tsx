// Searchable category popover: the three-level tree while browsing (every
// level pickable, spec 34), a flat list of full paths while searching.
// Arrow keys move, Enter picks (the first match while searching), Esc closes.
// Adapted from Spent (github.com/Shaya16/Spent), src/components/transactions/category-picker.tsx.

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Check, Search } from "lucide-react";
import type { Category, CategoryKind } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { pathOf, treeOf, type CategoryIndex } from "@/lib/categories";
import { useShot } from "@/lib/shot";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const KIND_LABEL: Record<CategoryKind, () => string> = {
  expense: () => s.picker.spending,
  transfer: () => s.flow.pickerTransfer,
  income: () => s.picker.income,
};

export interface PickerItem {
  category: Category;
  /** The name while browsing, the full path while searching. */
  label: string;
  /** Indent level: 1 for a top-level category, and always 1 while searching. */
  depth: number;
}

/** Transfers (savings, investments) can go either way, so they sit in the middle. */
export function kindsFor(preferKind: CategoryKind): CategoryKind[] {
  return preferKind === "income" ? ["income", "transfer", "expense"] : ["expense", "transfer", "income"];
}

/** What the picker lists, in order: the tree by kind, or the categories whose full path holds the search. */
export function pickerItems(index: CategoryIndex, preferKind: CategoryKind, query: string): PickerItem[] {
  const q = query.trim().toLowerCase();
  const tree = kindsFor(preferKind).flatMap((kind) => treeOf(index, kind));
  if (!q) return tree.map(({ category, depth }) => ({ category, label: category.name, depth }));
  return tree
    .map(({ category }) => ({ category, label: pathOf(index, category), depth: 1 }))
    .filter((item) => item.label.toLowerCase().includes(q));
}

const INDENT = ["", "ps-2", "ps-7", "ps-12"];

/** The picker that answers `?shot=pick-<text>`: the first one on the page. */
let demoOwner: string | null = null;

/**
 * Screenshot aid (spec 34): `?shot=pick-<text>` opens the first picker on the
 * page with `<text>` typed in its search. Null for every other picker.
 */
function useDemoQuery(id: string): string | null {
  const shot = useShot();
  if (!shot?.startsWith("pick-")) return null;
  demoOwner ??= id;
  return demoOwner === id ? shot.slice("pick-".length) : null;
}

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
  const idBase = useId();
  const demo = useDemoQuery(idBase);
  const [open, setOpen] = useState(demo !== null);
  const [query, setQuery] = useState(demo ?? "");
  const [active, setActive] = useState(demo ? 0 : -1);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  // Focus after the popup is positioned, so the page does not jump.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const searching = query.trim() !== "";
  const items = pickerItems(index, preferKind, query);
  // "No category" is the last choice while browsing, when there is one to clear.
  const withNone = !searching && value != null;
  const count = items.length + (withNone ? 1 : 0);

  // Keep the highlighted line in view as the arrow keys move it.
  useEffect(() => {
    list.current?.querySelector("[data-active='true']")?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const finish = (c: Category | null) => {
    setOpen(false);
    setQuery("");
    onSelect(c);
  };
  const pick = (i: number) => {
    if (i >= 0 && i < items.length) finish((items[i] as PickerItem).category);
    else if (withNone && i === items.length) finish(null);
  };
  const optionId = (i: number) => `${idBase}-${i}`;

  const row = (item: PickerItem, i: number) => {
    const c = item.category;
    return (
      <button
        key={c.id}
        id={optionId(i)}
        type="button"
        role="option"
        aria-selected={active === i}
        data-active={active === i}
        tabIndex={-1}
        onClick={() => finish(c)}
        onMouseMove={() => active !== i && setActive(i)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg py-1.5 pe-2 text-start text-sm transition-colors",
          INDENT[item.depth] ?? "ps-12",
          item.depth === 1 && !searching && (index.children.get(c.id)?.length ?? 0) > 0 && "font-medium",
          active === i && "bg-accent",
        )}
      >
        <span className="w-5 shrink-0 text-center leading-none">{c.emoji}</span>
        {searching ? (
          // The full path wraps rather than hiding the name; what is above it is muted.
          <span className="min-w-0 flex-1 break-words">
            <span className="text-muted-foreground">{item.label.slice(0, item.label.length - c.name.length)}</span>
            <span className="whitespace-nowrap">{c.name}</span>
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        )}
        {value === c.id && <Check className="size-3.5 text-primary" />}
      </button>
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setQuery("");
        setActive(next ? items.findIndex((item) => item.category.id === value) : -1);
      }}
    >
      <PopoverTrigger className={triggerClassName}>{children}</PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-80 p-0">
        <div className="flex items-center gap-2 border-b border-border px-3.5 py-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={input}
            value={query}
            role="combobox"
            aria-expanded
            aria-controls={`${idBase}-list`}
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(e.target.value.trim() ? 0 : -1);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const step = e.key === "ArrowDown" ? 1 : -1;
                setActive((i) => Math.min(count - 1, Math.max(0, i + step)));
              } else if (e.key === "Enter" && active >= 0) {
                e.preventDefault();
                pick(active);
              }
            }}
            placeholder={s.picker.search}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div ref={list} id={`${idBase}-list`} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {searching && items.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">{s.picker.noMatch}</p>
          )}
          {items.map((item, i) => {
            const kind = item.category.kind;
            const header = !searching && (i === 0 || (items[i - 1] as PickerItem).category.kind !== kind);
            return (
              <div key={item.category.id} className={cn(header && i > 0 && "pt-1")}>
                {header && (
                  <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    {KIND_LABEL[kind]()}
                  </div>
                )}
                {row(item, i)}
              </div>
            );
          })}
          {withNone && (
            <button
              id={optionId(items.length)}
              type="button"
              role="option"
              aria-selected={active === items.length}
              data-active={active === items.length}
              tabIndex={-1}
              onClick={() => finish(null)}
              onMouseMove={() => active !== items.length && setActive(items.length)}
              className={cn(
                "mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-border px-2 py-2 text-start text-sm text-muted-foreground transition-colors",
                active === items.length && "bg-accent",
              )}
            >
              <span className="w-5" />
              {s.picker.none}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
