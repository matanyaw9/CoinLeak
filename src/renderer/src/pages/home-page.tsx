// Home: the chosen period at a glance (spec 16). Hero, spending curve,
// categories, money flow, category curves, month by month.
// Before the first sync it greets instead, with no empty charts.

import { useMemo } from "react";
import { useNavigate } from "react-router";
import type { IsoMonth } from "@shared/types";
import { s } from "@/strings";
import { useCategories, useFirstRun } from "@/lib/hooks";
import { useMonth, usePeriod } from "@/lib/month-context";
import { indexCategories, type Slice } from "@/lib/categories";
import { Page } from "@/components/layout/page";
import { Card, CardSkeleton } from "@/components/common/card";
import { QueryError } from "@/components/common/empty-state";
import { Welcome } from "@/components/common/welcome";
import { HeroCard } from "@/components/home/hero-card";
import { SpendingCurveCard } from "@/components/home/spending-curve-card";
import { CategoryDonutCard } from "@/components/home/category-donut-card";
import { TrendCard } from "@/components/home/trend-card";
import { CategoryCurvesCard } from "@/components/home/category-curves-card";
import { MoneyFlowCard } from "@/components/home/money-flow-card";
import { periodWords } from "@/components/home/period-words";
import { usePeriodFlow, usePeriodSummary } from "@/components/home/period-data";

/** The Transactions link for a chart slice: a category, uncategorized, or all. */
export function sliceLink(slice: Slice): string {
  if (slice.categoryId === undefined) return "/transactions";
  return `/transactions?category=${slice.categoryId ?? "none"}`;
}

export function HomePage() {
  const { choice, range, today } = usePeriod();
  const { setMonth } = useMonth();
  const navigate = useNavigate();
  const summary = usePeriodSummary(range);
  const flow = usePeriodFlow(range);
  const categories = useCategories();
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);
  const firstRun = useFirstRun();
  const words = periodWords(choice, range, today);

  const open = (slice: Slice, m?: IsoMonth) => {
    if (m) setMonth(m);
    void navigate(sliceLink(slice));
  };

  if (firstRun) {
    return (
      <Page title={s.home.title}>
        <Welcome />
      </Page>
    );
  }

  return (
    <Page title={s.home.title} withMonth>
      {summary.isError ? (
        <Card>
          <QueryError error={summary.error} />
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12">
            {summary.data ? (
              <HeroCard words={words} today={today} summary={summary.data} shortfall={flow.data?.shortfall ?? 0} />
            ) : (
              <CardSkeleton height={250} />
            )}
          </div>
          <div className="col-span-12 lg:col-span-7">
            {summary.data ? (
              <SpendingCurveCard choice={choice} words={words} summary={summary.data} />
            ) : (
              <CardSkeleton label={s.home.curveTitle} height={300} />
            )}
          </div>
          <div className="col-span-12 lg:col-span-5">
            {summary.data && categories.data ? (
              <CategoryDonutCard summary={summary.data} words={words} index={index} onOpen={(x) => open(x)} />
            ) : (
              <CardSkeleton label={s.home.donutTitle} height={300} />
            )}
          </div>
          <div className="col-span-12">
            {flow.data && categories.data ? (
              <MoneyFlowCard flow={flow.data} index={index} onOpen={(x) => open(x)} />
            ) : flow.isError ? (
              <Card>
                <QueryError compact error={flow.error} />
              </Card>
            ) : (
              <CardSkeleton label={s.flow.title} height={360} />
            )}
          </div>
          <div className="col-span-12">
            {summary.data && categories.data ? (
              <CategoryCurvesCard choice={choice} words={words} summary={summary.data} index={index} onOpen={(x) => open(x)} />
            ) : (
              <CardSkeleton label={s.curves.title} height={300} />
            )}
          </div>
          <div className="col-span-12">
            {categories.data ? (
              <TrendCard range={range} index={index} onOpen={open} />
            ) : (
              <CardSkeleton label={s.periodHome.trendTitle} height={280} />
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
