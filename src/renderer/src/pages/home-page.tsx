// Home: money left this month, then the chosen period at a glance (specs 16
// and 22). Hero, spending curve, categories, money flow, category curves,
// month by month, saved or overspent, all of the period's spending. Before the
// first sync it greets instead.

import { useMemo } from "react";
import { useNavigate } from "react-router";
import type { IsoMonth } from "@shared/types";
import { s } from "@/strings";
import { useCategories, useFirstRun } from "@/lib/hooks";
import { usePeriod } from "@/lib/month-context";
import { indexCategories, type Slice } from "@/lib/categories";
import { useShot } from "@/lib/shot";
import { Page } from "@/components/layout/page";
import { Card, CardSkeleton } from "@/components/common/card";
import { QueryError } from "@/components/common/empty-state";
import { Welcome } from "@/components/common/welcome";
import { HeroCard } from "@/components/home/hero-card";
import { LeftCard, useOverspentShot } from "@/components/home/left-card";
import { SpendingCurveCard } from "@/components/home/spending-curve-card";
import { CategoryDonutCard } from "@/components/home/category-donut-card";
import { TrendCard } from "@/components/home/trend-card";
import { NetCard } from "@/components/home/net-card";
import { CategoryCurvesCard } from "@/components/home/category-curves-card";
import { MoneyFlowCard } from "@/components/home/money-flow-card";
import { BudgetCard } from "@/components/home/budget-card";
import { periodWords } from "@/components/home/period-words";
import { usePeriodFlow, usePeriodSummary, useThisMonth } from "@/components/home/period-data";

/** The Transactions link for a chart slice: a category, uncategorized, or all. */
export function sliceLink(slice: Slice): string {
  if (slice.categoryId === undefined) return "/transactions";
  return `/transactions?category=${slice.categoryId ?? "none"}`;
}

const minMonth = (a: IsoMonth, b: IsoMonth): IsoMonth => (a < b ? a : b);

export function HomePage() {
  const { choice, range, today, showMonth } = usePeriod();
  const navigate = useNavigate();
  const shot = useShot();
  const summary = usePeriodSummary(range);
  const flow = usePeriodFlow(range);
  const left = useThisMonth();
  const categories = useCategories();
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);
  const firstRun = useFirstRun();
  const words = periodWords(choice, range, today);
  // spec 27: budgets follow the chosen month; any other period shows the month it ends in.
  const budgetMonth = choice.kind === "month" ? choice.month : minMonth(range.to.slice(0, 7), today.slice(0, 7));
  useOverspentShot(shot, left.data);

  const open = (slice: Slice, m?: IsoMonth) => {
    if (m) showMonth(m);
    void navigate(sliceLink(slice));
  };
  /** One month's transactions, all of them (the Saved or overspent bars). */
  const openMonth = (m: IsoMonth) => {
    showMonth(m);
    void navigate("/transactions");
  };

  if (firstRun) {
    return (
      <Page title={s.home.title}>
        <Welcome />
      </Page>
    );
  }

  const error = summary.error;

  return (
    <Page title={s.home.title} withMonth>
      {error ? (
        <Card>
          <QueryError error={error} />
        </Card>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12">
            {left.data ? <LeftCard left={left.data} /> : <CardSkeleton label={s.left.title} height={70} />}
          </div>
          <div className="col-span-12">
            <BudgetCard month={budgetMonth} index={index} />
          </div>
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
              <CategoryCurvesCard
                choice={choice}
                words={words}
                summary={summary.data}
                index={index}
                onOpen={(x) => open(x)}
              />
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
          <div className="col-span-12">
            <NetCard range={range} onMonth={openMonth} />
          </div>
        </div>
      )}
    </Page>
  );
}
