// The last twelve months as bars stacked by top-level category. Hover shows
// the month, clicking a segment opens that month's transactions for it.

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { IsoMonth, TrendPoint } from "@shared/types";
import { s } from "@/strings";
import { groupByRoot, OTHER_COLOR, type CategoryIndex, type Slice } from "@/lib/categories";
import { formatMonth, formatMonthShort, percent } from "@/lib/format";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { chartAnimation, ChartTooltip } from "@/components/charts/chart-tooltip";

type Row = { month: IsoMonth; label: string; total: number } & Record<string, number | string>;

const MAX_SERIES = 6;

export function TrendCard({
  trend,
  index,
  month,
  onOpen,
}: {
  trend: TrendPoint[];
  index: CategoryIndex;
  month: IsoMonth;
  onOpen: (slice: Slice, month: IsoMonth) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);

  // Series: the biggest top-level categories over the whole year, rest in "Other".
  const overall = groupByRoot(index, trend.flatMap((t) => t.byCategory));
  const series = overall.slice(0, MAX_SERIES);
  const other = overall.length > MAX_SERIES;
  const kept = new Set(series.map((x) => x.key));
  const otherSlice: Slice = { key: "other", categoryId: undefined, name: s.common.other, emoji: null, color: OTHER_COLOR, amount: 0 };
  const allSeries = other ? [...series, otherSlice] : series;

  const data: Row[] = trend.map((t) => {
    const row: Row = { month: t.month, label: formatMonthShort(t.month), total: t.spending };
    for (const x of groupByRoot(index, t.byCategory)) {
      const k = kept.has(x.key) ? x.key : "other";
      row[k] = ((row[k] as number | undefined) ?? 0) + x.amount;
    }
    return row;
  });

  const focus = hover != null ? data[hover] : (data.find((d) => d.month === month) ?? data.at(-1));
  const hasData = trend.some((t) => t.spending > 0);

  return (
    <Card>
      <CardHeader label={s.home.trendTitle} action={s.home.trendHint} />
      {!hasData ? (
        <EmptyState compact title={s.home.trendEmpty} />
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
                onMouseMove={(st) => setHover(typeof st.activeTooltipIndex === "number" ? st.activeTooltipIndex : null)}
                onMouseLeave={() => setHover(null)}
              >
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={(p: { x?: number | string; y?: number | string; payload?: { value?: string }; index?: number }) => {
                    const selected = data[p.index ?? -1]?.month === month;
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
                      .map(({ x, amount }) => ({ key: x.key, label: x.name, amount, color: x.color, note: percent(amount, row.total) }));
                    return <ChartTooltip title={formatMonth(row.month)} rows={rows} hint={s.home.trendHint} />;
                  }}
                />
                {allSeries.map((x, i) => (
                  <Bar
                    key={x.key}
                    dataKey={x.key}
                    stackId="spend"
                    fill={x.color}
                    radius={i === allSeries.length - 1 ? [6, 6, 0, 0] : 0}
                    {...chartAnimation()}
                    className="cursor-pointer"
                    onClick={(entry: { payload?: Row }) => entry.payload && onOpen(x, entry.payload.month)}
                  >
                    {data.map((d) => (
                      <Cell key={d.month} opacity={hover == null || data[hover]?.month === d.month ? 1 : 0.4} className="transition-opacity" />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            {allSeries.map((x) => (
              <span key={x.key} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: x.color }} />
                {x.name}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
