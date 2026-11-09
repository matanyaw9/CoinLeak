// Period picker for the top bar (spec 16): this month (the default, with
// arrows, arrow keys and Today), the last 7 or 30 days, the last 12 months,
// a year, or any days. Arrows show only for a month or a year.
// Look adapted from Spent (github.com/Shaya16/Spent), src/components/dashboard/period-selector.tsx.

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { IsoDate } from "@shared/types";
import { s } from "@/strings";
import { usePeriod } from "@/lib/month-context";
import {
  canStep,
  customDaysProblem,
  canStepNext,
  monthKeyDelta,
  periodShowsToday,
  periodToday,
  shiftMonth,
  stepPeriod,
  PERIOD_KINDS,
  type PeriodChoice,
  type PeriodKind,
} from "@/lib/month";
import { useShot } from "@/lib/shot";
import { cn } from "@/lib/utils";
import { periodWords } from "@/components/home/period-words";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function MonthPicker() {
  const { choice, range, today, current, setChoice } = usePeriod();
  const shot = useShot();
  const [open, setOpen] = useState(shot === "period-custom" || shot === "custom-wrong");
  const words = periodWords(choice, range, today);

  // Demo screenshots: a past month for the Today button, or another period.
  const shotDone = useRef(false);
  useEffect(() => {
    if (!shot || shotDone.current) return;
    shotDone.current = true;
    if (shot === "past-month") setChoice({ ...choice, kind: "month", month: shiftMonth(current, -2) });
    if (shot === "period-12") setChoice({ ...choice, kind: "last12" });
    if (shot === "period-custom" || shot === "custom-wrong") setChoice({ ...choice, kind: "custom" });
    if (shot === "overspent" || shot === "overspent-flow") setChoice({ ...choice, kind: "month", month: shiftMonth(current, -3) });
  }, [shot, current, choice, setChoice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const delta = monthKeyDelta(e);
      if (delta == null || !canStep(choice.kind) || document.querySelector("[data-slot=popover-content]")) return;
      e.preventDefault();
      setChoice(stepPeriod(choice, delta, current));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [choice, current, setChoice]);

  const pick = (kind: PeriodKind) => {
    const next: PeriodChoice = { ...choice, kind };
    if (kind === "month" && choice.kind !== "month") next.month = current;
    if (kind === "year" && choice.kind !== "year") next.year = Number(current.slice(0, 4));
    setChoice(next);
    if (kind !== "custom") setOpen(false);
  };
  const stepping = canStep(choice.kind);
  const isYear = choice.kind === "year";

  return (
    <div className="flex items-center gap-2">
      {periodShowsToday(choice, current) && (
        <Button
          variant="outline"
          className="h-9 rounded-xl px-3.5"
          title={s.period.todayHint}
          onClick={() => setChoice(periodToday(choice, current))}
        >
          {s.today.label}
        </Button>
      )}
      <div
        className="flex h-9 items-center rounded-xl border border-input bg-card px-1"
        title={stepping ? s.period.keysHint : undefined}
      >
        {stepping && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={isYear ? s.period.previousYear : s.month.previous}
            onClick={() => setChoice(stepPeriod(choice, -1, current))}
          >
            <ChevronLeft />
          </Button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            aria-label={s.period.choose}
            className={cn(
              "inline-flex h-7 min-w-34 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium tabular-nums transition-colors outline-none select-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
          >
            <span aria-live="polite">{words.label}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-1.5">
            <div role="listbox" aria-label={s.period.choose}>
              {PERIOD_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="option"
                  aria-selected={choice.kind === kind}
                  onClick={() => pick(kind)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-start text-sm transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1">{s.period.kinds[kind]}</span>
                  {choice.kind === kind && <Check className="size-3.5 text-primary" />}
                </button>
              ))}
            </div>
            {choice.kind === "custom" && (
              <CustomDays
                from={choice.custom.from}
                to={choice.custom.to}
                today={today}
                onApply={(custom) => {
                  setChoice({ ...choice, kind: "custom", custom });
                  setOpen(false);
                }}
              />
            )}
          </PopoverContent>
        </Popover>
        {stepping && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={isYear ? s.period.nextYear : s.month.next}
            disabled={!canStepNext(choice, current)}
            onClick={() => setChoice(stepPeriod(choice, 1, current))}
          >
            <ChevronRight />
          </Button>
        )}
      </div>
    </div>
  );
}

function CustomDays({
  from,
  to,
  today,
  onApply,
}: {
  from: IsoDate;
  to: IsoDate;
  today: IsoDate;
  onApply: (range: { from: IsoDate; to: IsoDate }) => void;
}) {
  const shot = useShot();
  const [a, setA] = useState(shot === "custom-wrong" ? to : from);
  const [b, setB] = useState(shot === "custom-wrong" ? from : to);
  const problem = customDaysProblem(a, b);
  const field = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <input
        type="date"
        value={value}
        max={today}
        aria-invalid={problem === "fromAfterTo"}
        onChange={(e) => set(e.target.value)}
        className="h-8 rounded-lg border border-input bg-card px-2 text-sm text-foreground tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:scheme-dark"
      />
    </label>
  );
  return (
    <div className="mt-1.5 border-t border-border px-1.5 pt-2.5 pb-1">
      <div className="flex gap-2">
        {field(s.period.from, a, setA)}
        {field(s.period.to, b, setB)}
      </div>
      {problem ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {problem === "fromAfterTo" ? s.period.fromAfterTo : s.period.missingDay}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{s.period.customHint}</p>
      )}
      <Button className="mt-2.5 h-8 w-full rounded-lg" disabled={problem !== null} onClick={() => onApply({ from: a, to: b })}>
        {s.period.apply}
      </Button>
    </div>
  );
}
