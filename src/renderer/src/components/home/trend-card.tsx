// Month by month: the months the period covers (at least three) as bars
// stacked by top-level category (spec 16). Ticking categories (in the list,
// or by clicking a bar segment or legend name) shows only theirs, stacked,
// with a clear way back. Core sends one series per ticked category.

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarShapeProps } from "recharts";
import { ArrowLeft } from "lucide-react";
import type { DateRange, IsoMonth, TrendPoint } from "@shared/types";
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
import { TrendCategoryPicker } from "./trend-category-picker";
import { toggleTick, type TrendTicks } from "./trend-filter";
import { usePeriodTrend } from "./period-data";

type Row = { month: IsoMonth; label: string; total: number; top?: string } & Record<string, number | string | undefined>;

const MAX_SERIES = 6;

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
  const [ticks, setTicks] = useState<TrendTicks>(() => (shot === "trend-some" ? firstGroups(index, 2) : []));
  const [hover, setHover] = useState<number | null>(null);
  const trend = usePeriodTrend(range, ticks);
  const points = trend.data ?? [];
  const inPeriod = (m: IsoMonth) => m >= monthOf(range.from) && m <= monthOf(range.to);

  const filtered = ticks.length > 0;
  const toggle = (id: number | null) => setTicks((t) => toggleTick(t, id, index));
  const series = filtered ? ticks.map((id) => sliceOf(index, id)) : topGroups(index, points);
  const data = points.map((t) => rowOf(t, series, filtered, index));

  const focus = hover != null ? data[hover] : (data.findLast((d) => inPeriod(d.month)) ?? data.at(-1));
  const hasData = points.some((t) => t.spending > 0);

  // Clicking a segment of all spending ticks its group; when filtered, it opens that month's rows.
  const clickSegment = (x: Slice, month: IsoMonth | undefined) => {
    if (!month) return;
    if (filtered || x.categoryId === undefined) onOpen(x, month);
    else toggle(x.categoryId);
  };

  return (
    <Card>
      <CardHeader
        label={s.periodHome.trendTitle}
        action={
          <span className="flex items-center gap-2">
            {filtered && (
              <Button variant="ghost" className="h-8 rounded-xl px-2.5" title={s.periodHome.trendBackHint} onClick={() => setTicks([])}>
                <ArrowLeft />
                {s.periodHome.trendBack}
              </Button>
            )}
            <TrendCategoryPicker
              index={index}
              ticks={ticks}
              onToggle={toggle}
              onClear={() => setTicks([])}
              defaultOpen={shot === "trend-picker"}
            />
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
              <span className="text-sm text-muted-foreground">{formatMonth(focus.month)}</span>
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
                    const rows = series
                      .map((x) => ({ x, amount: Number(row[x.key] ?? 0) }))
                      .filter((r) => r.amount > 0)
                      .sort((a, b) => b.amount - a.amount)
                      .map(({ x, amount }) => ({ key: x.key, label: x.name, amount, color: x.color, note: percent(amount, row.total) }));
                    return (
                      <ChartTooltip
                        title={formatMonth(row.month)}
                        rows={rows}
                        hint={filtered ? s.periodHome.trendFilterHint : s.periodHome.trendPickHint}
                      />
                    );
                  }}
                />
                {series.map((x) => (
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
                    onClick={(entry: { payload?: Row }) => clickSegment(x, entry.payload?.month)}
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
          <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {series.map((x) => (
              <button
                key={x.key}
                type="button"
                disabled={x.categoryId === undefined}
                title={x.categoryId === undefined ? undefined : filtered ? s.periodHome.trendUntickHint : s.periodHome.trendPickHint}
                onClick={() => x.categoryId !== undefined && toggle(x.categoryId)}
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
        </>
      )}
    </Card>
  );
}

/** A ticked category (or uncategorized) as a chart series, keyed like `groupByRoot`. */
function sliceOf(index: CategoryIndex, id: number | null): Slice {
  const c = id === null ? undefined : index.byId.get(id);
  const parent = c?.parentId != null ? index.byId.get(c.parentId) : undefined;
  return {
    key: id === null ? "none" : String(id),
    categoryId: id,
    name: c?.name ?? s.common.uncategorized,
    emoji: c?.emoji ?? null,
    color: c ? (c.color ?? colorOf(parent ?? c)) : UNCATEGORIZED_COLOR,
    amount: 0,
  };
}

/** All spending: the biggest groups over these months, the rest as "Other". */
function topGroups(index: CategoryIndex, points: TrendPoint[]): Slice[] {
  const groups = groupByRoot(index, points.flatMap((t) => t.byCategory));
  if (groups.length <= MAX_SERIES) return groups;
  const other: Slice = { key: "other", categoryId: undefined, name: s.common.other, emoji: null, color: OTHER_COLOR, amount: 0 };
  return [...groups.slice(0, MAX_SERIES), other];
}

/** One bar: each series' amount under its key. Core already split the month by series when filtered. */
function rowOf(t: TrendPoint, series: Slice[], filtered: boolean, index: CategoryIndex): Row {
  const row: Row = { month: t.month, label: formatMonthShort(t.month), total: t.spending };
  const keys = new Set(series.map((x) => x.key));
  const parts = filtered
    ? t.byCategory.map((c) => ({ key: c.categoryId === null ? "none" : String(c.categoryId), amount: c.amount }))
    : groupByRoot(index, t.byCategory);
  for (const part of parts) {
    const key = keys.has(part.key) ? part.key : "other";
    row[key] = Number(row[key] ?? 0) + Math.max(0, part.amount);
  }
  // Only the highest visible segment of each bar gets rounded corners.
  row.top = series.findLast((x) => Number(row[x.key] ?? 0) > 0)?.key;
  return row;
}

/** The first spending groups, for the demo screenshot of a filtered chart. */
function firstGroups(index: CategoryIndex, n: number): TrendTicks {
  return index.roots
    .filter((r) => r.kind === "expense")
    .slice(0, n)
    .map((r) => r.id);
}
