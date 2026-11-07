// Cumulative spending through the month, this month against last month.

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { IsoMonth, MonthSummary } from "@shared/types";
import { s } from "@/strings";
import { daysInMonth, shiftMonth } from "@/lib/month";
import { formatDayShort, formatMonthName } from "@/lib/format";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { chartAnimation, ChartTooltip, type TooltipRow } from "@/components/charts/chart-tooltip";

interface Point {
  day: number;
  date: string;
  current?: number;
  previous?: number;
}

const PREV_COLOR = "var(--muted-foreground)";

export function SpendingCurveCard({ month, summary, prev }: { month: IsoMonth; summary: MonthSummary; prev?: MonthSummary }) {
  const prevMonth = shiftMonth(month, -1);
  const length = daysInMonth(month);
  const lastIndex = summary.byDay.length - 1;
  const data: Point[] = Array.from({ length }, (_, i) => ({
    day: i + 1,
    date: `${month}-${String(i + 1).padStart(2, "0")}`,
    current: summary.byDay[i]?.amount,
    previous: prev?.byDay[i]?.amount,
  }));
  const hasData = summary.spending > 0 || (prev?.spending ?? 0) > 0;
  const ticks = [1, 8, 15, 22, 29].filter((d) => d <= length);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        label={s.home.curveTitle}
        action={
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-primary" />
              {formatMonthName(month)}
            </span>
            {prev && (
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-muted-foreground/70" />
                {formatMonthName(prevMonth)}
              </span>
            )}
          </span>
        }
      />
      {!hasData ? (
        <EmptyState compact title={s.home.curveEmpty} className="flex-1" />
      ) : (
        <div className="-mx-2 min-h-60 flex-1">
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="day"
                ticks={ticks}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis hide domain={[0, (max: number) => max * 1.08]} />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1.5 }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as Point | undefined;
                  if (!active || !p) return null;
                  const rows: TooltipRow[] = [];
                  if (p.current != null)
                    rows.push({ key: "c", label: formatMonthName(month), amount: p.current, color: "var(--primary)", strong: true });
                  if (p.previous != null)
                    rows.push({ key: "p", label: s.home.curveByDay(p.day, formatMonthName(prevMonth)), amount: p.previous, color: PREV_COLOR, dashed: true });
                  return <ChartTooltip title={formatDayShort(p.date)} rows={rows} />;
                }}
              />
              <Area
                type="monotone"
                dataKey="previous"
                stroke={PREV_COLOR}
                strokeOpacity={0.6}
                strokeWidth={1.5}
                strokeDasharray="5 5"
                fill="none"
                dot={false}
                activeDot={{ r: 3.5, fill: PREV_COLOR, stroke: "var(--card)", strokeWidth: 2 }}
                {...chartAnimation()}
              />
              <Area
                type="monotone"
                dataKey="current"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fill="url(#curve-fill)"
                dot={(p: { cx?: number; cy?: number; index?: number }) =>
                  p.index === lastIndex && p.cx != null && p.cy != null ? (
                    <circle key="today" cx={p.cx} cy={p.cy} r={4.5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2.5} />
                  ) : (
                    <g key={p.index} />
                  )
                }
                activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--card)", strokeWidth: 2.5 }}
                connectNulls={false}
                {...chartAnimation()}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
