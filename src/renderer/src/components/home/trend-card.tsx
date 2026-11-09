// Month by month: the months the period covers (at least three) as bars
// stacked by top-level category (spec 16). Picking a category, or clicking
// its bar segment or legend name, shows only that category's spending month
// by month, with a clear way back. Core sends the per-category months.

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarShapeProps } from "recharts";
import { ArrowLeft } from "lucide-react";
import type { DateRange, IsoMonth } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { colorOf, groupByRoot, OTHER_COLOR, UNCATEGORIZED_COLOR, type CategoryIndex, type Slice } from "@/lib/categories";
import { monthOf } from "@/lib/month";
import { formatMonth, formatMonthShort, percent } from "@/lib/format";
import { useShot } from "@/lib/shot";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { Button } from "@/components/ui/button";
import { chartAnimation, ChartTooltip } from "@/components/charts/chart-tooltip";
import { CurveCategoryPicker } from "./curve-category-picker";
import { usePeriodTrend } from "./period-data";

type Row = { month: IsoMonth; label: string; total: number; top?: string } & Record<string, number | string | undefined>;

const MAX_SERIES = 6;
const ONE = "one";

export function TrendCard({
  range,
  index,
  onOpen,
}: {
  range: DateRange;
  index: CategoryIndex;
  onOpen: (slice: Slice, month: IsoMonth) => void;
}) {
  const shot = useShot();
  // undefined: all spending; null: uncategorized; a number: that category and its subcategories.
  const [filter, setFilter] = useState<number | null | undefined>(() =>
    shot === "trend-one" ? index.roots.find((r) => r.kind === "expense")?.id : undefined,
  );
  const [hover, setHover] = useState<number | null>(null);
  const trend = usePeriodTrend(range, filter);
  const points = trend.data ?? [];
  const inPeriod = (m: IsoMonth) => m >= monthOf(range.from) && m <= monthOf(range.to);

  const filtered = filter !== undefined;
  const cat = filter == null ? null : (index.byId.get(filter) ?? null);
  const parent = cat?.parentId != null ? index.byId.get(cat.parentId) : undefined;
  const oneSlice: Slice = {
    key: ONE,
    categoryId: filter ?? null,
    name: cat?.name ?? s.common.uncategorized,
    emoji: cat?.emoji ?? null,
    color: cat ? (cat.color ?? colorOf(parent ?? cat)) : UNCATEGORIZED_COLOR,
    amount: 0,
  };

  // Series: the biggest top-level categories over these months, rest in "Other".
  const overall = filtered ? [] : groupByRoot(index, points.flatMap((t) => t.byCategory));
  const series = filtered ? [oneSlice] : overall.slice(0, MAX_SERIES);
  const kept = new Set(series.map((x) => x.key));
  const otherSlice: Slice = { key: "other", categoryId: undefined, name: s.common.other, emoji: null, color: OTHER_COLOR, amount: 0 };
  const allSeries = !filtered && overall.length > MAX_SERIES ? [...series, otherSlice] : series;

  const data: Row[] = points.map((t) => {
    const row: Row = { month: t.month, label: formatMonthShort(t.month), total: t.spending };
    if (filtered) {
      row[ONE] = Math.max(0, t.spending);
    } else {
      for (const x of groupByRoot(index, t.byCategory)) {
        const k = kept.has(x.key) ? x.key : "other";
        row[k] = ((row[k] as number | undefined) ?? 0) + x.amount;
      }
    }
    // Only the highest visible segment of each bar gets rounded corners.
    row.top = allSeries.findLast((x) => Number(row[x.key] ?? 0) > 0)?.key;
    return row;
  });

  const focus = hover != null ? data[hover] : (data.findLast((d) => inPeriod(d.month)) ?? data.at(-1));
  const hasData = points.some((t) => t.spending > 0);
  const choose = (x: Slice) => {
    if (x.categoryId !== undefined) setFilter(x.categoryId);
  };

  return (
    <Card>
      <CardHeader
        label={s.periodHome.trendTitle}
        action={
          <span className="flex items-center gap-2">
            {filtered && (
              <Button variant="ghost" className="h-8 rounded-xl px-2.5" title={s.periodHome.trendBackHint} onClick={() => setFilter(undefined)}>
                <ArrowLeft />
                {s.periodHome.trendBack}
              </Button>
            )}
            <CurveCategoryPicker index={index} value={filter} all={s.periodHome.trendAll} onSelect={setFilter} />
          </span>
        }
      />
      {!trend.data ? (
        <div className="h-[330px]" />
      ) : !hasData ? (
        <EmptyState compact title={filtered ? s.periodHome.trendEmptyOne : s.home.trendEmpty} />
      ) : (
        <>
          {focus && (
            <div className="mb-4 flex items-baseline gap-2.5">
              <Money amount={focus.total} decimals={false} className="text-[28px] leading-none tracking-tight" />
              <span className="text-sm text-muted-foreground">
                {formatMonth(focus.month)}
                {filtered && ` · ${oneSlice.name}`}
              </span>
            </div>
          )}
          <div className="-mx-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
                barCategoryGap="28%"
                maxBarSize={72}
                onMouseMove={(st) => setHover(typeof st.activeTooltipIndex === "number" ? st.activeTooltipIndex : null)}
                onMouseLeave={() => setHover(null)}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  interval="preserveStartEnd"
                  tick={(p: { x?: number | string; y?: number | string; payload?: { value?: string }; index?: number }) => {
                    const selected = inPeriod(data[p.index ?? -1]?.month ?? "");
                    return (
                      <text
                        x={p.x}
                        y={p.y}
                        dy={12}
                        textAnchor="middle"
                        fontSize={12}
                        fontWeight={selected ? 600 : 400}
                        fill={selected ? "var(--foreground)" : "var(--muted-foreground)"}
                      >
                        {p.payload?.value}
                      </text>
                    );
                  }}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: "var(--accent)", opacity: 0.5, radius: 10 } as object}
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as Row | undefined;
                    if (!active || !row) return null;
                    const rows = allSeries
                      .map((x) => ({ x, amount: Number(row[x.key] ?? 0) }))
                      .filter((r) => r.amount > 0)
                      .sort((a, b) => b.amount - a.amount)
                      .map(({ x, amount }) => ({ key: x.key, label: x.name, amount, color: x.color, note: filtered ? undefined : percent(amount, row.total) }));
                    return (
                      <ChartTooltip
                        title={formatMonth(row.month)}
                        rows={rows}
                        hint={filtered ? s.periodHome.trendFilterHint : s.periodHome.trendPickHint}
                      />
                    );
                  }}
                />
                {allSeries.map((x) => (
                  <Bar
                    key={x.key}
                    dataKey={x.key}
                    stackId="spend"
                    fill={x.color}
                    shape={(props: BarShapeProps) => (
                      <Rectangle {...props} radius={(props.payload as Row | undefined)?.top === x.key ? [6, 6, 0, 0] : 0} />
                    )}
                    {...chartAnimation()}
                    className="cursor-pointer"
                    onClick={(entry: { payload?: Row }) => {
                      const m = entry.payload?.month;
                      if (!m) return;
                      if (filtered || x.categoryId === undefined) onOpen(filtered ? oneSlice : x, m);
                      else choose(x);
                    }}
                  >
                    {data.map((d) => (
                      <Cell
                        key={d.month}
                        opacity={hover != null ? (data[hover]?.month === d.month ? 1 : 0.4) : inPeriod(d.month) ? 1 : 0.55}
                        className="transition-opacity"
                      />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          {!filtered && (
            <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {allSeries.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  disabled={x.categoryId === undefined}
                  title={x.categoryId === undefined ? undefined : s.periodHome.trendPickHint}
                  onClick={() => choose(x)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors",
                    x.categoryId !== undefined && "hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: x.color }} />
                  {x.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
