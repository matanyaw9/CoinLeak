// Budgets (spec 37, F73): plan the month. The total first, beside the average
// income, then every spending category in tree order with its usual month,
// what it spent in the chosen month and its budget box. Core keeps children
// inside their parent and top budgets inside the total; this page lays out.

import { useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Shapes } from "lucide-react";
import type { BudgetPlanLine, IsoMonth } from "@shared/types";
import { s } from "@/strings";
import { useBudgetPlan, useCategories } from "@/lib/hooks";
import { usePeriod } from "@/lib/month-context";
import { formatMonth } from "@/lib/format";
import { indexCategories } from "@/lib/categories";
import { Page } from "@/components/layout/page";
import { Skeleton } from "@/components/ui/misc";
import { Card } from "@/components/common/card";
import { EmptyState, QueryError } from "@/components/common/empty-state";
import { TotalCard } from "@/components/budgets/total-card";
import { BudgetLine } from "@/components/budgets/budget-line";

const minMonth = (a: IsoMonth, b: IsoMonth): IsoMonth => (a < b ? a : b);

/** The lines cut into one group per top-level category, each starting with it. */
function byTopLevel(lines: BudgetPlanLine[]): BudgetPlanLine[][] {
  const groups: BudgetPlanLine[][] = [];
  for (const line of lines) {
    if (line.depth === 1 || groups.length === 0) groups.push([line]);
    else groups.at(-1)?.push(line);
  }
  return groups;
}

export function BudgetsPage() {
  const { choice, range, today } = usePeriod();
  // As on Home (spec 27): the chosen month, or the month another period ends in.
  const month = choice.kind === "month" ? choice.month : minMonth(range.to.slice(0, 7), today.slice(0, 7));
  const plan = useBudgetPlan(month);
  const categories = useCategories();
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);
  const nameOf = (id: number) => index.byId.get(id)?.name ?? "";
  // Opened from a category's budget on Categories: that line's box takes focus.
  const [params] = useSearchParams();
  const focusId = Number(params.get("category"));

  let body: ReactNode;
  if (plan.isError) {
    body = (
      <Card>
        <QueryError error={plan.error} />
      </Card>
    );
  } else if (!plan.data || !categories.data) {
    body = <Skeleton className="h-96 w-full rounded-3xl" />;
  } else if (plan.data.lines.length === 0) {
    body = (
      <Card>
        <EmptyState icon={Shapes} title={s.plan.emptyTitle} body={s.plan.emptyBody} />
      </Card>
    );
  } else {
    body = (
      <>
        <TotalCard plan={plan.data} />
        <p className="mt-8 mb-3 px-1 text-xs text-muted-foreground">{s.plan.keysHint}</p>
        <div className="space-y-5">
          {byTopLevel(plan.data.lines).map((group) => (
            <div key={group[0]?.categoryId} className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
              {group.map((line) => (
                <BudgetLine
                  key={line.categoryId}
                  line={line}
                  category={index.byId.get(line.categoryId)}
                  nameOf={nameOf}
                  focus={line.categoryId === focusId}
                />
              ))}
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <Page title={s.plan.title} withMonth>
      <div className="mx-auto max-w-4xl">
        <p className="mb-6 text-[15px] text-muted-foreground">
          {s.plan.intro} <span className="text-foreground">{formatMonth(month)}</span>.
        </p>
        {body}
      </div>
    </Page>
  );
}
