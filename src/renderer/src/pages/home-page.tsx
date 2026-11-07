// Home: the month at a glance. Hero, spending curve, categories, 12 months.

import { useMemo } from "react";
import { useNavigate } from "react-router";
import type { IsoMonth } from "@shared/types";
import { s } from "@/strings";
import { useCategories, useMonthSummary, useTrend } from "@/lib/hooks";
import { useMonth } from "@/lib/month-context";
import { shiftMonth } from "@/lib/month";
import { indexCategories, type Slice } from "@/lib/categories";
import { Page } from "@/components/layout/page";
import { Card, CardSkeleton } from "@/components/common/card";
import { QueryError } from "@/components/common/empty-state";
import { HeroCard } from "@/components/home/hero-card";
import { SpendingCurveCard } from "@/components/home/spending-curve-card";
import { CategoryDonutCard } from "@/components/home/category-donut-card";
import { TrendCard } from "@/components/home/trend-card";

/** The Transactions link for a chart slice: a category, uncategorized, or all. */
export function sliceLink(slice: Slice): string {
  if (slice.categoryId === undefined) return "/transactions";
  return `/transactions?category=${slice.categoryId ?? "none"}`;
}

export function HomePage() {
  const { month, current, setMonth } = useMonth();
  const navigate = useNavigate();
  const summary = useMonthSummary(month);
  const prev = useMonthSummary(shiftMonth(month, -1));
  const trend = useTrend(12);
  const categories = useCategories();
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);

  const open = (slice: Slice, m?: IsoMonth) => {
    if (m) setMonth(m);
    void navigate(sliceLink(slice));
  };

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
              <HeroCard month={month} current={current} summary={summary.data} prev={prev.data} />
            ) : (
              <CardSkeleton height={250} />
            )}
          </div>
          <div className="col-span-12 lg:col-span-7">
            {summary.data ? (
              <SpendingCurveCard month={month} summary={summary.data} prev={prev.data} />
            ) : (
              <CardSkeleton label={s.home.curveTitle} height={300} />
            )}
          </div>
          <div className="col-span-12 lg:col-span-5">
            {summary.data && categories.data ? (
              <CategoryDonutCard summary={summary.data} index={index} onOpen={(x) => open(x)} />
            ) : (
              <CardSkeleton label={s.home.donutTitle} height={300} />
            )}
          </div>
          <div className="col-span-12">
            {trend.data && categories.data ? (
              <TrendCard trend={trend.data} index={index} month={month} onOpen={open} />
            ) : trend.isError ? (
              <Card>
                <QueryError compact error={trend.error} />
              </Card>
            ) : (
              <CardSkeleton label={s.home.trendTitle} height={280} />
            )}
          </div>
        </div>
      )}
    </Page>
  );
}
