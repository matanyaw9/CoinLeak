// One category out of a list shown as the tree (spec 34): indented by level,
// scrolling when long. Works as a radio group: Tab lands on the chosen line,
// the arrow keys move and choose, Home and End jump to the ends.

import type { KeyboardEvent } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TreeEntry } from "@/lib/categories";

const INDENT = ["", "ps-3", "ps-8", "ps-13"];

/** Arrow keys (and Home, End) move the focus between the list's enabled buttons. */
export function arrowFocus(e: KeyboardEvent<HTMLElement>): HTMLButtonElement | null {
  const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
  if (!keys.includes(e.key)) return null;
  const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  if (buttons.length === 0) return null;
  const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    e.key === "Home"
      ? buttons[0]
      : e.key === "End"
        ? buttons.at(-1)
        : buttons[Math.min(buttons.length - 1, Math.max(0, at + (e.key === "ArrowDown" ? 1 : -1)))];
  if (!next) return null;
  e.preventDefault();
  next.focus();
  return next;
}

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
  // Tab lands on the chosen line, or on the first one when none is chosen.
  const tabStop = options.some((o) => o.id === value) ? value : options[0]?.id;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        const next = arrowFocus(e);
        const id = next?.dataset["id"];
        if (id !== undefined) onChange(id === "" ? null : Number(id));
      }}
      className="max-h-56 overflow-y-auto rounded-2xl border border-border p-1"
    >
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id ?? "none"}
            type="button"
            role="radio"
            aria-checked={on}
            data-id={o.id ?? ""}
            tabIndex={o.id === tabStop ? 0 : -1}
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
