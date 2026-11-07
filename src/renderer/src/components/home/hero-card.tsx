// Home hero: what was spent this month in one big sentence, how that
// compares with last month, and income, spending and what was left.
// Look adapted from Spent (github.com/Shaya16/Spent), src/components/dashboard/hero-card.tsx.

import { Link } from "react-router";
import { ArrowRight, CircleHelp } from "lucide-react";
import type { IsoMonth, MonthSummary } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { daysInMonth, shiftMonth, toIsoDate } from "@/lib/month";
import { formatDayLong, formatMonth, formatMonthName, ils } from "@/lib/format";
import { Card } from "@/components/common/card";
import { Money } from "@/components/common/money";

/** What to compare against: last month by the same day, or all of it. */
function comparison(summary: MonthSummary, prev: MonthSummary | undefined, isCurrent: boolean, day: number) {
  if (!prev || prev.spending <= 0) return null;
  const base = isCurrent ? (prev.byDay[Math.min(day, prev.byDay.length) - 1]?.amount ?? prev.spending) : prev.spending;
  if (base <= 0) return null;
  return { diff: summary.spending - base, base };
}

export function HeroCard({
  month,
  current,
  summary,
  prev,
}: {
  month: IsoMonth;
  current: IsoMonth;
  summary: MonthSummary;
  prev: MonthSummary | undefined;
}) {
  const isCurrent = month === current;
  const today = new Date();
  const day = today.getDate();
  const prevName = formatMonthName(shiftMonth(month, -1));
  const cmp = comparison(summary, prev, isCurrent, day);
  const left = summary.income - summary.spending;
  const spent = summary.spending > 0;

  return (
    <Card className="relative overflow-hidden px-10 pt-9 pb-8">
      <div className="flex items-start justify-between gap-6">
        <p className="text-sm text-muted-foreground">
          {isCurrent
            ? s.home.todayLine(formatDayLong(toIsoDate(today)), daysInMonth(month) - day)
            : s.home.pastLine(formatMonth(month))}
        </p>
        {summary.needsReview > 0 && (
          <Link
            to="/transactions?review=1"
            className="group -mt-1 inline-flex shrink-0 items-center gap-2 rounded-full bg-status-heads-up/12 py-1.5 ps-2.5 pe-3 text-sm text-foreground transition-colors hover:bg-status-heads-up/20"
          >
            <CircleHelp className="size-4 text-status-heads-up" />
            {s.home.review(summary.needsReview)}
            <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>

      <h2 className="mt-5 max-w-4xl font-heading text-[46px] leading-[1.06] tracking-tight text-balance">
        {!spent ? (
          isCurrent ? s.home.nothingYet : s.home.nothingPast(formatMonthName(month))
        ) : (
          <>
            {isCurrent ? s.home.headlineSoFar : s.home.headlinePast}{" "}
            <span className="text-primary">{ils(summary.spending, { decimals: false })}</span>{" "}
            {isCurrent ? s.home.headlineSoFarTail : s.home.headlinePastTail(formatMonthName(month))}
          </>
        )}
      </h2>

      {spent && cmp && (
        <p className="mt-3 font-heading text-2xl tracking-tight text-muted-foreground">
          {Math.abs(cmp.diff) < cmp.base * 0.02 ? (
            s.home.vsSame(prevName)
          ) : (
            <>
              {s.home.thatIs}
              <span className={cn(cmp.diff < 0 ? "text-status-on-track" : "text-status-over")}>
                {cmp.diff < 0
                  ? s.home.vsLess(ils(-cmp.diff, { decimals: false }))
                  : s.home.vsMore(ils(cmp.diff, { decimals: false }))}
              </span>
              {isCurrent ? s.home.vsSameDay(prevName) : s.home.vsWholeMonth(prevName)}
            </>
          )}
        </p>
      )}

      <div className="mt-9 grid grid-cols-3 gap-6 border-t border-border pt-7">
        <Kpi label={s.home.income} hint={s.home.incomeHint}>
          <Money amount={summary.income} className="text-status-on-track" />
        </Kpi>
        <Kpi label={s.home.spent} hint={s.home.spentHint}>
          <Money amount={summary.spending} />
        </Kpi>
        <Kpi label={isCurrent ? s.home.leftSoFar : s.home.left} hint={left < 0 ? s.home.overspent : s.home.leftHint}>
          <Money amount={left} className={left < 0 ? "text-status-over" : "text-foreground"} />
        </Kpi>
      </div>
    </Card>
  );
}

function Kpi({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</div>
      <div className="mt-2 text-[28px] leading-none tracking-tight">{children}</div>
      <div className="mt-2 truncate text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
