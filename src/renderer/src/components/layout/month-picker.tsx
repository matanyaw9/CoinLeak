// Month picker for the top bar: arrows, the left and right arrow keys, and a
// Today button that appears whenever another month is on screen.
// Look adapted from Spent (github.com/Shaya16/Spent), src/components/dashboard/period-selector.tsx.

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { s } from "@/strings";
import { useMonth } from "@/lib/month-context";
import { canGoNext, monthKeyDelta, shiftMonth, showToday, stepMonth } from "@/lib/month";
import { useShot } from "@/lib/shot";
import { formatMonth } from "@/lib/format";
import { Button } from "@/components/ui/button";

export function MonthPicker() {
  const { month, current, setMonth } = useMonth();
  const shot = useShot();

  // Demo screenshots of the Today button need a past month on screen.
  const shotDone = useRef(false);
  useEffect(() => {
    if (shot !== "past-month" || shotDone.current) return;
    shotDone.current = true;
    setMonth(shiftMonth(current, -2));
  }, [shot, current, setMonth]);

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
    <div className="flex items-center gap-2">
      {showToday(month, current) && (
        <Button variant="outline" className="h-9 rounded-xl px-3.5" title={s.today.hint} onClick={() => setMonth(current)}>
          {s.today.label}
        </Button>
      )}
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
    </div>
  );
}
