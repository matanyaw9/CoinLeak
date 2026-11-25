// The emoji choices in the category editor (F74): big enough to tell apart
// and to hit, eight to a row. Spec 36 (F83): one Tab stop for the whole
// grid, arrow keys move in all four directions, Enter or Space picks.

import { useEffect } from "react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { useRoving } from "@/lib/roving";
import { useShot } from "@/lib/shot";

/** As many as `grid-cols-8` below. */
const COLUMNS = 8;

export function EmojiGrid({ emojis, value, onChange }: { emojis: readonly string[]; value: string; onChange: (emoji: string) => void }) {
  const { list, item } = useRoving(emojis, { columns: COLUMNS, start: Math.max(0, emojis.indexOf(value)) });
  useFocusShot();
  return (
    <div ref={list} data-emoji-grid="" role="group" aria-label={s.catEdit.emoji} className="mt-3 grid grid-cols-8 gap-1.5">
      {emojis.map((e, i) => (
        <button
          key={e}
          type="button"
          {...item(i)}
          onClick={() => onChange(e)}
          aria-pressed={value === e}
          className={cn(
            "flex aspect-square min-h-11 items-center justify-center rounded-xl text-[2rem] leading-none outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover",
            value === e && "bg-accent ring-2 ring-primary/50",
          )}
        >
          {e}
        </button>
      ))}
    </div>
  );
}

/**
 * Screenshot aid (dev start route only, see lib/shot.ts): with
 * `?shot=edit-Groceries-emoji` the categories page opens the editor and an
 * emoji in the second line takes keyboard focus, as arrow keys would.
 */
function useFocusShot(): void {
  const focus = useShot()?.endsWith("-emoji") ?? false;
  useEffect(() => {
    if (!focus) return;
    const id = setTimeout(() => document.querySelector<HTMLElement>(`[data-emoji-grid] > :nth-child(${COLUMNS + 3})`)?.focus(), 800);
    return () => clearTimeout(id);
  }, [focus]);
}
