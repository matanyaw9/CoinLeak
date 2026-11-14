// Home's "Budgets" card (spec 27): one bar per budgeted category, spent as a
// percent of its budget, this month or this week (Sunday to Saturday). Core
// sends spent and budget; this card only divides them for display.

import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight } from "lucide-react";
import type { BudgetLine, BudgetStatus, IsoMonth } from "@shared/types";
import { s } from "@/strings";
import { ils } from "@/lib/format";
import { useBudgetStatus } from "@/lib/hooks";
import { usePeriod } from "@/lib/month-context";
import { useShot } from "@/lib/shot";
import { cn } from "@/lib/utils";
import type { CategoryIndex } from "@/lib/categories";
import { Card, CardHeader, CardSkeleton } from "@/components/common/card";
import { CategoryBubble } from "@/components/common/chips";
import { QueryError } from "@/components/common/empty-state";
import { Segmented } from "@/components/common/segmented";

type BudgetPeriod = "month" | "week";

/** One bar as shown: spent and budget for the chosen period. */
export interface BudgetBar {
  categoryId: number;
  spent: number;
  budget: number;
}

/** Spent as a whole percent of the budget. A weekly budget can be 0 agorot (a monthly one under 4). */
export function percentOf(bar: BudgetBar): number {
  return Math.round((bar.spent * 100) / Math.max(1, bar.budget));
}

/** The chosen period's figures, highest share of the budget first. */
export function budgetBars(lines: BudgetLine[], period: BudgetPeriod): BudgetBar[] {
  return lines
    .map((l) =>
      period === "month"
        ? { categoryId: l.categoryId, spent: l.spentMonth, budget: l.monthlyBudget }
        : { categoryId: l.categoryId, spent: l.spentWeek, budget: l.weeklyBudget },
    )
    .sort((a, b) => b.spent / Math.max(1, b.budget) - a.spent / Math.max(1, a.budget) || a.categoryId - b.categoryId);
}

/** Under 80% calm, 80 to 100% a warning, over 100% red. */
export function budgetTone(bar: BudgetBar): "calm" | "warning" | "over" {
  if (bar.spent > bar.budget) return "over";
  return bar.spent * 100 >= bar.budget * 80 ? "warning" : "calm";
}

const TONE = {
  calm: { bar: "bg-status-on-track", text: "text-muted-foreground" },
  warning: { bar: "bg-status-heads-up", text: "text-foreground" },
  over: { bar: "bg-status-over", text: "text-status-over" },
};

export function BudgetCard({ month, index }: { month: IsoMonth; index: CategoryIndex }) {
  const shot = useShot();
  const [chosen, setChosen] = useState<BudgetPeriod>(shot === "budgets-week" ? "week" : "month");
  const status = useBudgetStatus(month);
  const label = s.budgets.title;

  if (status.isError) {
    return (
      <Card>
        <CardHeader label={label} />
        <QueryError compact error={status.error} />
      </Card>
    );
  }
  if (!status.data) return <CardSkeleton label={label} height={120} />;

  // "This week" only for the current month; another month always shows its month.
  const period: BudgetPeriod = status.data.currentMonth ? chosen : "month";
  const toggle = status.data.currentMonth && status.data.lines.length > 0 && (
    <Segmented<BudgetPeriod>
      label={s.budgets.periodLabel}
      value={period}
      onChange={setChosen}
      options={[
        { value: "month", label: s.budgets.month },
        { value: "week", label: s.budgets.week },
      ]}
    />
  );

  return (
    <Card>
      <CardHeader label={label} action={toggle} />
      {status.data.lines.length === 0 ? (
        <Link
          to="/categories"
          className="group inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {s.budgets.empty}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2">
          {budgetBars(status.data.lines, period).map((bar) => (
            <li key={bar.categoryId}>
              <Bar bar={bar} status={status.data} period={period} index={index} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Bar({ bar, status, period, index }: { bar: BudgetBar; status: BudgetStatus; period: BudgetPeriod; index: CategoryIndex }) {
  const navigate = useNavigate();
  const { choice, setChoice, showMonth } = usePeriod();
  const category = index.byId.get(bar.categoryId);
  const name = category?.name ?? "";
  const tone = TONE[budgetTone(bar)];
  const percent = percentOf(bar);
  const money = (a: number) => ils(a, { decimals: false });

  const open = () => {
    if (period === "month") showMonth(status.month);
    else setChoice({ ...choice, kind: "custom", custom: status.week });
    void navigate(`/transactions?category=${bar.categoryId}`);
  };

  return (
    <button
      type="button"
      onClick={open}
      title={s.budgets.open(name)}
      className="group w-full rounded-xl text-start outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <div className="flex items-center gap-3">
        <CategoryBubble category={category} size={28} />
        <span dir="auto" className="min-w-0 flex-1 truncate text-sm font-medium group-hover:underline">
          {name}
        </span>
        <span className={cn("text-sm tabular-nums", tone.text)}>{s.budgets.percent(percent)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", tone.bar)} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
        <span>{s.budgets.of(money(bar.spent), money(bar.budget))}</span>
        {bar.spent > bar.budget && <span className="text-status-over">{s.budgets.over(money(bar.spent - bar.budget))}</span>}
      </div>
    </button>
  );
}
