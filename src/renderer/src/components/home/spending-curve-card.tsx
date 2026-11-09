// Cumulative spending through the period, against the period before (spec 16).
// Core cuts the series into days, weeks or months and stops it at today; this
// card only lays the points out.

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PeriodSummary } from "@shared/types";
import { s } from "@/strings";
import type { PeriodChoice } from "@/lib/month";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { chartAnimation, ChartTooltip, type TooltipRow } from "@/components/charts/chart-tooltip";
import type { PeriodWords } from "./period-words";
import { axisOf } from "./period-axis";

interface Point {
  i: number;
  label: string;
  title: string;
  current?: number;
  previous?: number;
}

const PREV_COLOR = "var(--muted-foreground)";

export function SpendingCurveCard({ choice, words, summary }: { choice: PeriodChoice; words: PeriodWords; summary: PeriodSummary }) {
  const axis = axisOf(summary, summary.bucket);
  const prev = summary.previous;
  const lastIndex = summary.series.length - 1;
  const data: Point[] = axis.points.map((p, i) => ({
    i,
    label: p.label,
    title: p.title,
    current: summary.series[i]?.amount,
    previous: prev.series[i]?.amount,
  }));
  const hasData = summary.spending > 0 || prev.spending > 0;
  const title = choice.kind === "month" ? s.home.curveTitle : s.periodHome.curveTitle;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        label={title}
        action={
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full bg-primary" />
              {words.name}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 border-t-2 border-dashed border-muted-foreground/70" />
              <span className="first-letter:uppercase">{words.before}</span>
            </span>
          </span>
        }
      />
      {!hasData ? (
        <EmptyState compact title={s.home.curveEmpty} className="flex-1" />
      ) : (
        <div className="-mx-2 min-h-60 flex-1">
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 12 }}>
              <defs>
                <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="i"
                type="number"
                domain={[0, Math.max(data.length - 1, 1)]}
                ticks={axis.ticks}
                tickFormatter={(i: number) => data[i]?.label ?? ""}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <YAxis hide domain={[0, (max: number) => Math.max(max, 1) * 1.08]} />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1.5 }}
                content={({ active, payload }) => {
                  const p = payload?.[0]?.payload as Point | undefined;
                  if (!active || !p) return null;
                  const rows: TooltipRow[] = [];
                  if (p.current != null)
                    rows.push({ key: "c", label: words.name, amount: p.current, color: "var(--primary)", strong: true });
                  if (p.previous != null)
                    rows.push({
                      key: "p",
                      label: choice.kind === "month" ? s.home.curveByDay(p.i + 1, words.before) : words.before,
                      amount: p.previous,
                      color: PREV_COLOR,
                      dashed: true,
                    });
                  return <ChartTooltip title={p.title} rows={rows} />;
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
