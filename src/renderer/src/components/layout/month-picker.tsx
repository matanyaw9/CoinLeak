// Month picker for the top bar: arrows, plus the left and right arrow keys.
// Look adapted from Spent (github.com/Shaya16/Spent), src/components/dashboard/period-selector.tsx.

import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { s } from "@/strings";
import { useMonth } from "@/lib/month-context";
import { canGoNext, monthKeyDelta, stepMonth } from "@/lib/month";
import { formatMonth } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function MonthPicker() {
  const { month, current, setMonth } = useMonth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const delta = monthKeyDelta(e);
      if (delta == null || document.querySelector("[data-slot=popover-content]")) return;
      e.preventDefault();
      setMonth(stepMonth(month, delta, current));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [month, current, setMonth]);

  return (
    <div className="flex h-9 items-center rounded-xl border border-input bg-card px-1" title={s.month.hint}>
      <Button variant="ghost" size="icon-xs" aria-label={s.month.previous} onClick={() => setMonth(stepMonth(month, -1, current))}>
        <ChevronLeft />
      </Button>
      <span className="min-w-34 text-center text-sm font-medium tabular-nums select-none" aria-live="polite">
        {formatMonth(month)}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={s.month.next}
        disabled={!canGoNext(month, current)}
        onClick={() => setMonth(stepMonth(month, 1, current))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
