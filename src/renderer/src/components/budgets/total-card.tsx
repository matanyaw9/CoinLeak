// spec 37: the Budgets page's top card. The month's total box, beside it the
// average income over the last full months (with "Use this") and the average
// spending, and under it the bar of how much of the total is split.

import { useRef } from "react";
import type { BudgetAverage, BudgetPlan } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { formatMonthShort } from "@/lib/format";
import { useSetBudgetTotal } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/common/card";
import { BudgetBox, budgetText, useBudgetEdit } from "./budget-box";
import { money, splitPercent } from "./offer-words";

const span = (a: BudgetAverage) => s.plan.monthSpan(formatMonthShort(a.from), formatMonthShort(a.to));

export function TotalCard({ plan }: { plan: BudgetPlan }) {
  const box = useRef<HTMLInputElement>(null);
  const setTotal = useSetBudgetTotal();
  const edit = useBudgetEdit(plan.total, (total) => setTotal.mutateAsync({ total }));
  const problem = edit.refused?.problem;
  const income = plan.averageIncome;

  const fillIncome = (amount: number) => {
    edit.onText(budgetText(amount));
    box.current?.focus();
  };

  return (
    <Card>
      <CardHeader label={s.plan.totalLabel} />
      <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
        <div className="w-56">
          <BudgetBox
            ref={box}
            text={edit.text}
            onText={edit.onText}
            onSave={edit.save}
            onRevert={edit.revert}
            invalid={edit.invalid}
            label={s.plan.totalField}
            placeholder={s.plan.totalPlaceholder}
            className="[&_input]:h-11 [&_input]:text-lg"
          />
          {edit.invalid && <p className="mt-1 text-end text-[11px] text-status-over">{s.budgets.invalid}</p>}
        </div>
        <div className="min-w-0 flex-1 pt-1">
          {income ? (
            <>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-[15px]">{s.plan.averageIncome(span(income), money(income.amount))}</span>
                <Button size="xs" variant="outline" onClick={() => fillIncome(income.amount)} aria-label={s.plan.useThisLabel(money(income.amount))}>
                  {s.plan.useThis}
                </Button>
              </div>
              {plan.averageSpending && (
                <p className="mt-1.5 text-xs text-muted-foreground">{s.plan.averageSpending(money(plan.averageSpending.amount))}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{s.plan.noHistory}</p>
          )}
        </div>
      </div>
      {problem?.code === "under_split" && (
        <p role="alert" className="mt-3 rounded-2xl bg-status-over/10 px-4 py-2.5 text-sm text-status-over">
          {s.plan.underSplit(money(problem.split))}
        </p>
      )}
      <SplitBar plan={plan} />
    </Card>
  );
}

/** How much of the total is split: "82% set · ₪1,200 left to split". With no total, just the split. */
function SplitBar({ plan }: { plan: BudgetPlan }) {
  const percent = splitPercent(plan.split, plan.total);
  const over = plan.left !== null && plan.left < 0;
  let label: string;
  if (percent === null) label = s.plan.splitOnly(money(plan.split));
  else if (over) label = s.plan.overSplit(percent, money(-(plan.left ?? 0)));
  else label = s.plan.set(percent, money(plan.left ?? 0));
  return (
    <div className="mt-6">
      <div className="h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
        {percent !== null && (
          <div
            className={cn("h-full rounded-full", over ? "bg-status-over" : "bg-primary")}
            style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
          />
        )}
      </div>
      <p className={cn("mt-2 text-sm tabular-nums", over && "text-status-over")}>{label}</p>
      {percent === null && <p className="mt-0.5 text-xs text-muted-foreground">{s.plan.noTotal}</p>}
    </div>
  );
}
