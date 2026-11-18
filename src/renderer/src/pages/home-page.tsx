// Home: money left this month, then the chosen period at a glance (specs 16
// and 22). Hero, spending curve, categories, money flow, category curves,
// month by month, saved or overspent. One control shows all spending, essentials or extras on
// the spending charts. Before the first sync it greets instead.

import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight } from "lucide-react";
import type { IsoMonth } from "@shared/types";
import { s } from "@/strings";
import { ils } from "@/lib/format";
import { useCategories, useFirstRun } from "@/lib/hooks";
import { usePeriod } from "@/lib/month-context";
import { indexCategories, type Slice } from "@/lib/categories";
import { useShot } from "@/lib/shot";
import { Page } from "@/components/layout/page";
import { Card, CardSkeleton } from "@/components/common/card";
import { QueryError } from "@/components/common/empty-state";
import { Segmented } from "@/components/common/segmented";
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
import { useSpendingFilter, type SpendingFilter } from "@/components/home/spending-filter";

/** The Transactions link for a chart slice: a category, uncategorized, or all. */
export function sliceLink(slice: Slice): string {
  if (slice.categoryId === undefined) return "/transactions";
  return `/transactions?category=${slice.categoryId ?? "none"}`;
}

const minMonth = (a: IsoMonth, b: IsoMonth): IsoMonth => (a < b ? a : b);

/** Demo screenshots: `?shot=home-essential` or `?shot=home-extra` start filtered. */
function shotFilter(shot: string | null): SpendingFilter | undefined {
  return shot === "home-essential" ? "essential" : shot === "home-extra" ? "extra" : undefined;
}

export function HomePage() {
  const { choice, range, today, showMonth } = usePeriod();
  const navigate = useNavigate();
  const shot = useShot();
  const [filter, setFilter] = useSpendingFilter(shotFilter(shot));
  const all = usePeriodSummary(range);
  const summary = usePeriodSummary(range, filter);
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

  const error = summary.error ?? all.error;
  const untagged = filter !== "all" ? (summary.data?.untagged ?? 0) : 0;

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
          <div className="col-span-12 -mb-2 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            {untagged > 0 && (
              <p className="me-auto text-sm text-muted-foreground">
                {s.essentials.untagged(ils(untagged, { decimals: false }))}{" "}
                <Link
                  to="/transactions?category=none"
                  className="group inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                >
                  {s.essentials.untaggedLink}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </p>
            )}
            <Segmented<SpendingFilter>
              label={s.essentials.label}
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: s.essentials.all },
                { value: "essential", label: s.essentials.essential },
                { value: "extra", label: s.essentials.extra },
              ]}
            />
          </div>
          <div className="col-span-12">
            {summary.data && all.data ? (
              <HeroCard
                words={words}
                today={today}
                summary={summary.data}
                all={all.data}
                filter={filter}
                shortfall={flow.data?.shortfall ?? 0}
              />
            ) : (
              <CardSkeleton height={250} />
            )}
          </div>
          <div className="col-span-12 lg:col-span-7">
            {summary.data ? (
              <SpendingCurveCard choice={choice} words={words} summary={summary.data} filter={filter} />
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
                filter={filter}
                index={index}
                onOpen={(x) => open(x)}
              />
            ) : (
              <CardSkeleton label={s.curves.title} height={300} />
            )}
          </div>
          <div className="col-span-12">
            {categories.data ? (
              <TrendCard range={range} index={index} filter={filter} onFilter={setFilter} onOpen={open} />
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
