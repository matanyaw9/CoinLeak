// The color swatches in the category editor. Spec 36 (F83): one Tab stop
// for the whole grid, arrow keys move in all four directions, Enter or
// Space picks.

import { Check } from "lucide-react";
import { s } from "@/strings";
import { useRoving } from "@/lib/roving";

/** As many as `grid-cols-9` below. */
const COLUMNS = 9;

export function ColorGrid({ colors, value, onChange }: { colors: readonly string[]; value: string | null; onChange: (color: string) => void }) {
  const chosen = value?.toUpperCase();
  const { list, item } = useRoving(colors.length, { columns: COLUMNS, start: Math.max(0, colors.indexOf(chosen ?? "")) });
  return (
    <div ref={list} role="radiogroup" aria-label={s.catEdit.color} className="grid w-fit grid-cols-9 gap-2">
      {colors.map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          {...item(i)}
          aria-checked={chosen === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className="flex size-7 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          style={{ backgroundColor: c }}
        >
          {chosen === c && <Check className="size-3.5 text-white" strokeWidth={3} />}
        </button>
      ))}
    </div>
  );
}
