// Saved or overspent (spec 30, F62): one bar per month from a zero line, up
// and green when income beat spending, down and red when it did not. Core
// works out every number (summary:monthlyNet); this card only draws them.
// Clicking a month shows it on Home, like the month-by-month bars.

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  usePlotArea,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";
import type { DateRange, IsoMonth, MonthNet } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { monthOf } from "@/lib/month";
import { formatMonth, formatMonthShort, ils } from "@/lib/format";
import { useShot } from "@/lib/shot";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { chartAnimation, ChartTooltip } from "@/components/charts/chart-tooltip";
import { useMonthlyNet } from "./period-data";

/** `net` is null for a month that came out even, so it draws no bar. */
type Row = MonthNet & { label: string; bar: number | null };

const SAVED = "var(--status-on-track)";
const OVER = "var(--status-over)";
const Y_AXIS_WIDTH = 64;
/** About how wide one character of a 12px bar label is. */
const LABEL_CHAR_PX = 7;

const colorOf = (net: number) => (net > 0 ? SAVED : OVER);
const signed = (amount: number) => ils(amount, { sign: true, decimals: false });
const whole = (amount: number) => ils(amount, { decimals: false });
/** Recharts names the month under the pointer by its index, as a number or a numeric string. */
const indexOf = (index: unknown): number | undefined => (index == null || index === "" ? undefined : Number(index));
const monthTitle = (row: MonthNet) => (row.partial ? s.net.soFar(formatMonth(row.month)) : formatMonth(row.month));

export function NetCard({ range, onMonth }: { range: DateRange; onMonth: (month: IsoMonth) => void }) {
  const shot = useShot();
  const net = useMonthlyNet({ from: range.from, to: range.to });
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // Demo screenshots: `?shot=net...` scroll here.
  useEffect(() => {
    if (shot?.startsWith("net")) box.current?.scrollIntoView({ block: "center" });
  }, [shot, net.data]);

  const points = net.data ?? [];
  const data: Row[] = points.map((p) => ({ ...p, label: formatMonthShort(p.month), bar: p.net === 0 ? null : p.net }));
  const hasData = points.some((p) => p.income !== 0 || p.spending !== 0 || p.transfers !== 0);
  const inPeriod = (m: IsoMonth) => m >= monthOf(range.from) && m <= monthOf(range.to);
  const focus = hover != null ? data[hover] : (data.findLast((d) => inPeriod(d.month)) ?? data.at(-1));

  // Bar labels show only when the widest one fits a month's slot; otherwise the tooltip has them.
  const longest = Math.max(0, ...data.map((d) => (d.bar === null ? 0 : signed(d.bar).length)));
  const label = { width: longest * LABEL_CHAR_PX + 8, months: data.length };

  const ticks = axisTicks(points.map((p) => p.net));
  // Demo screenshot of the tooltip: the last month with a savings move.
  const tooltipIndex = shot === "net-tooltip" ? data.findLastIndex((d) => d.transfers !== 0 && d.bar !== null) : -1;

  const pick = (index: number | undefined) => {
    const row = index === undefined ? undefined : data[index];
    if (row) onMonth(row.month);
  };

  return (
    <div ref={box}>
      <Card>
        <CardHeader label={<span title={s.net.hint}>{s.net.title}</span>} />
        {!net.data ? (
          <div className="h-[330px]" />
        ) : !hasData ? (
          <EmptyState compact title={s.net.empty} />
        ) : (
          <>
            {focus && (
              <div className="mb-4 flex items-baseline gap-2.5">
                <Money
                  amount={focus.net}
                  sign
                  decimals={false}
                  className={cn(
                    "text-[28px] leading-none tracking-tight",
                    focus.net > 0 && "text-status-on-track",
                    focus.net < 0 && "text-status-over",
                  )}
                />
                <span className="text-sm text-muted-foreground">{monthTitle(focus)}</span>
              </div>
            )}
            <div className="-mx-2 h-64 cursor-pointer">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                  barCategoryGap="28%"
                  maxBarSize={72}
                  onMouseMove={(st) => setHover(indexOf(st.activeTooltipIndex) ?? null)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(st) => pick(indexOf(st.activeTooltipIndex))}
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
                          onClick={() => pick(p.index)}
                        >
                          {p.payload?.value}
                        </text>
                      );
                    }}
                  />
                  <YAxis
                    width={Y_AXIS_WIDTH}
                    domain={[ticks[0] ?? 0, ticks.at(-1) ?? 0]}
                    ticks={ticks}
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    // Room above the highest bar and below the deepest one for their labels.
                    padding={{ top: 20, bottom: (ticks[0] ?? 0) < 0 ? 20 : 0 }}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: number) => whole(v)}
                  />
                  <ReferenceLine y={0} stroke="var(--foreground)" strokeOpacity={0.35} />
                  <Tooltip
                    cursor={{ fill: "var(--accent)", opacity: 0.5, radius: 10 } as object}
                    {...(tooltipIndex >= 0 ? { defaultIndex: tooltipIndex } : {})}
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as Row | undefined;
                      if (!active || !row) return null;
                      return <NetTooltip row={row} />;
                    }}
                  />
                  <Bar
                    dataKey="bar"
                    {...chartAnimation()}
                    shape={(props: BarShapeProps) => (
                      <NetBar {...props} dim={hover != null && data[hover]?.month !== (props.payload as Row).month} label={label} />
                    )}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/** One month's bar, rounded at its far end, with its signed net above (saved) or below (overspent). */
function NetBar(props: BarShapeProps & { dim: boolean; label: { width: number; months: number } }) {
  const plot = usePlotArea();
  const showLabel = plot !== undefined && plot.width / props.label.months >= props.label.width;
  const row = props.payload as Row;
  if (row.bar === null) return <g />;
  const x = Number(props.x ?? 0);
  const width = Number(props.width ?? 0);
  const y = Number(props.y ?? 0);
  const height = Number(props.height ?? 0);
  // Recharts may hand a bar below zero a negative height; draw from the top edge either way.
  const top = Math.min(y, y + height);
  const size = Math.abs(height);
  const saved = row.bar > 0;
  const color = colorOf(row.bar);
  return (
    <g className="transition-opacity" opacity={props.dim ? 0.4 : 1}>
      <Rectangle
        x={x}
        y={top}
        width={width}
        // A tiny month still shows next to a big one.
        height={Math.max(size, 2)}
        radius={saved ? [6, 6, 0, 0] : [0, 0, 6, 6]}
        fill={color}
        // The current month is not over yet: lighter. Its label stays readable.
        fillOpacity={row.partial ? 0.45 : 1}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={saved ? top - 6 : top + size + 15}
          textAnchor="middle"
          fontSize={12}
          fontWeight={500}
          fill={color}
          className="num"
        >
          {signed(row.bar)}
        </text>
      )}
    </g>
  );
}

function NetTooltip({ row }: { row: Row }) {
  const word = row.net > 0 ? s.net.saved : row.net < 0 ? s.net.overspent : s.net.even;
  const color = row.net === 0 ? "var(--muted-foreground)" : colorOf(row.net);
  const savings =
    row.transfers > 0 ? s.net.toSavings(whole(row.transfers)) : row.transfers < 0 ? s.net.fromSavings(whole(-row.transfers)) : null;
  return (
    <ChartTooltip
      title={monthTitle(row)}
      rows={[
        { key: "income", label: s.net.income, amount: row.income },
        { key: "spending", label: s.net.spending, amount: row.spending },
        { key: "net", label: <span style={{ color }}>{word}</span>, amount: row.net, color, strong: true },
      ]}
      hint={
        <>
          {savings && <div className="mb-1">{savings}</div>}
          {s.net.clickHint}
        </>
      }
    />
  );
}

/**
 * Round y-axis ticks in whole shekels from the lowest month to the highest,
 * always through zero, about four steps apart.
 */
export function axisTicks(nets: number[]): number[] {
  const low = Math.min(0, ...nets);
  const high = Math.max(0, ...nets);
  const raw = (high - low) / 4;
  if (raw <= 0) return [0];
  const power = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * power).find((step) => step >= raw) ?? power * 10;
  // Agorot: never a step under one shekel.
  const step = Math.max(100, nice);
  const ticks: number[] = [];
  for (let t = Math.floor(low / step) * step; t <= Math.ceil(high / step) * step; t += step) ticks.push(t);
  return ticks;
}
