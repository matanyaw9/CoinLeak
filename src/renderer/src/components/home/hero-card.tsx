// Home hero: what was spent in the period in one big sentence, how that
// compares with the period before, and income, spending and what was left,
// plus what moved to savings when anything did (specs 14 and 16). When
// spending and savings outran income, it says by how much, in the warning
// color the money flow uses for the same amount.
// Look adapted from Spent (github.com/Shaya16/Spent), src/components/dashboard/hero-card.tsx.

import { Link } from "react-router";
import { ArrowRight, CircleHelp, TriangleAlert } from "lucide-react";
import type { Agorot, IsoDate, PeriodSummary } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { daysInMonth, monthOf, parseDate } from "@/lib/month";
import { formatDayLong, ils } from "@/lib/format";
import { Card } from "@/components/common/card";
import { Money } from "@/components/common/money";
import { rangeLabel, type PeriodWords } from "./period-words";

export function HeroCard({
  words,
  today,
  summary,
  shortfall,
}: {
  words: PeriodWords;
  today: IsoDate;
  summary: PeriodSummary;
  /** From core's money flow: spending plus transfers beyond income. */
  shortfall: Agorot;
}) {
  const { ongoing, calendar } = words;
  const base = summary.previous.sameTime;
  const diff = summary.spending - base;
  const left = summary.income - summary.spending;
  const spent = summary.spending > 0;
  const moved = summary.transfers;
  const isThisMonth = calendar && ongoing && summary.from.endsWith("-01") && monthOf(summary.from) === monthOf(summary.to);

  const topLine = isThisMonth
    ? s.home.todayLine(formatDayLong(today), daysInMonth(monthOf(today)) - parseDate(today).getDate())
    : ongoing
      ? `${formatDayLong(today)} · ${rangeLabel(summary)}`
      : s.periodHome.rangeLine(rangeLabel(summary));

  return (
    <Card className="relative overflow-hidden px-10 pt-9 pb-8">
      <div className="flex items-start justify-between gap-6">
        <p className="text-sm text-muted-foreground">{topLine}</p>
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
          ongoing && calendar ? (
            s.periodHome.nothingYet(words.when)
          ) : (
            s.periodHome.nothing(words.when)
          )
        ) : (
          <>
            {ongoing ? s.home.headlineSoFar : s.home.headlinePast}{" "}
            <span className="text-primary">{ils(summary.spending, { decimals: false })}</span>{" "}
            {ongoing && calendar ? s.periodHome.soFar(words.when) : s.periodHome.tail(words.when)}
          </>
        )}
      </h2>

      {spent && base > 0 && (
        <p className="mt-3 font-heading text-2xl tracking-tight text-muted-foreground">
          {Math.abs(diff) < base * 0.02 ? (
            s.home.vsSame(words.before)
          ) : (
            <>
              {s.home.thatIs}
              <span className={cn(diff < 0 ? "text-status-on-track" : "text-status-over")}>
                {diff < 0 ? s.home.vsLess(ils(-diff, { decimals: false })) : s.home.vsMore(ils(diff, { decimals: false }))}
              </span>
              {!ongoing || summary.to === today
                ? s.home.vsWholeMonth(words.before)
                : calendar
                  ? s.home.vsSameDay(words.before)
                  : s.periodHome.vsSamePoint(words.before)}
            </>
          )}
        </p>
      )}

      {shortfall > 0 && (
        <p className="mt-3 flex items-center gap-2.5 font-heading text-2xl tracking-tight text-status-over" data-testid="overspent">
          <TriangleAlert className="size-5 shrink-0" />
          {(ongoing ? s.periodHome.overspentSoFar : s.periodHome.overspent)(ils(shortfall, { decimals: false }))}
        </p>
      )}

      <div className={cn("mt-9 grid gap-6 border-t border-border pt-7", moved !== 0 ? "grid-cols-4" : "grid-cols-3")}>
        <Kpi label={s.home.income} hint={s.home.incomeHint}>
          <Money amount={summary.income} className="text-status-on-track" />
        </Kpi>
        <Kpi label={s.home.spent} hint={s.home.spentHint}>
          <Money amount={summary.spending} />
        </Kpi>
        <Kpi label={ongoing ? s.home.leftSoFar : s.home.left} hint={left < 0 ? s.home.overspent : s.home.leftHint}>
          <Money amount={left} className={left < 0 ? "text-status-over" : "text-foreground"} />
        </Kpi>
        {moved !== 0 && (
          <Kpi
            label={moved > 0 ? s.flow.movedToSavings : s.flow.takenFromSavings}
            hint={moved > 0 ? s.flow.movedHint : s.flow.takenHint}
          >
            <Money amount={Math.abs(moved)} className="text-foreground" />
          </Kpi>
        )}
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
