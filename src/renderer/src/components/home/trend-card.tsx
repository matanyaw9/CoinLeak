// Month by month: the last 12 months up to the period (more if it is longer) as stacked
// bars by top-level category (spec 16). Ticking categories (in the chooser, or by
// clicking a bar segment or legend name) shows only theirs, one level down,
// with a clear way back. Once ticked, a click opens Transactions (spec 38,
// trend-filter.ts says which). Pointing at a segment or a legend name lights
// that series in every bar (F60). Keys: the bars are one Tab stop (Left and
// Right light a month, Enter opens it); the legend is one roving list. Core
// sends each bar ready to draw; a group whose refunds beat its spending has no
// bar and shows as money back in the tooltip and the legend (spec 44).

import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts";
import { ArrowLeft, Layers } from "lucide-react";
import type { DateRange, IsoMonth, TrendBar, TrendPoint } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { categorySlice, groupKey, groupSlice, otherSlice, ownRowsSlice, type CategoryIndex, type Slice } from "@/lib/categories";
import { monthOf, monthRange, shiftMonth, toIsoMonth } from "@/lib/month";
import { formatMonth, formatMonthShort, ils, percent } from "@/lib/format";
import { useRoving } from "@/lib/roving";
import { useShot } from "@/lib/shot";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { Button } from "@/components/ui/button";
import { chartAnimation, ChartTooltip } from "@/components/charts/chart-tooltip";
import { CategoryChooser } from "./category-chooser";
import { MoneyBack } from "./category-donut-card";
import {
  legendAction,
  monthAction,
  segmentAction,
  toggleTick,
  TREND_LIMIT,
  type TrendAction,
  type TrendTicks,
} from "./trend-filter";
import { usePeriodTrend } from "./period-data";

type Row = { month: IsoMonth; label: string; total: number; drawn: number; top?: string } & Record<string, number | string | undefined>;

export function TrendCard({
  range,
  index,
  onOpen,
}: {
  range: DateRange;
  index: CategoryIndex;
  /** Transactions for one month or a range of days, filtered to these categories (none: all spending). */
  onOpen: (categories: TrendTicks, when: IsoMonth | DateRange) => void;
}) {
  const shot = useShot();
  const [ticks, setTicks] = useState<TrendTicks>(() => shotTicks(shot, index));
  // The month lit by the pointer or the arrow keys; `keyed` while the keys lead.
  const [hover, setHover] = useState<number | null>(null);
  const [keyed, setKeyed] = useState(false);
  // The series under the pointer; demo screenshots (`?shot=trend-hover`) light the first group.
  const [lit, setLit] = useState<string | null>(shot === "trend-hover" ? String(firstGroups(index, 1)[0]) : null);
  const box = useRef<HTMLDivElement>(null);
  // Demo screenshots: `?shot=trend...` scroll here.
  useEffect(() => {
    if (shot?.startsWith("trend")) box.current?.scrollIntoView({ block: "center" });
  }, [shot]);
  const trend = usePeriodTrend(trendRange(range), ticks);
  const points = trend.data?.points ?? [];
  const bars = trend.data?.bars ?? [];
  const average = trend.data?.average ?? null;
  // More money back than spending on average leaves no line to draw.
  const averageLine = average && average.amount >= 0 ? average : null;
  const averageNote = average && s.average.months(average.count, formatMonth(average.from), formatMonth(average.to));
  const inPeriod = (m: IsoMonth) => m >= monthOf(range.from) && m <= monthOf(range.to);

  const filtered = ticks.length > 0;
  const showAll = () => setTicks([]);
  const toggle = (id: number | null) => setTicks((t) => toggleTick(t, id, index));
  const series = filtered
    ? tickedSeries(index, ticks, points)
    : (trend.data?.groups ?? []).map((id) => groupSlice(index, { categoryId: id, amount: 0 }));
  if (!filtered && trend.data?.hasOther) series.push(otherSlice(0));
  const data = points.map((t, i) => rowOf(t, bars[i] as TrendBar, series));
  /** A series' money back that month (below zero), if it had any. */
  const backOf = (month: IsoMonth, key: string) =>
    bars[points.findIndex((p) => p.month === month)]?.back.find((g) => groupKey(g.categoryId) === key)?.amount;
  const { list: legendList, item: legendItem } = useRoving(
    series.map((x) => x.key),
    // One line of names: Left and Right move along it.
    { columns: series.length },
  );

  // The month shown when nothing is lit: the period's last, else the last bar.
  const lastInPeriod = data.findLastIndex((d) => inPeriod(d.month));
  const restIndex = lastInPeriod >= 0 ? lastInPeriod : data.length - 1;
  const focus = hover != null ? data[hover] : data[restIndex];
  const hasData = bars.some((b) => b.drawn > 0 || b.back.length > 0);

  const act = (a: TrendAction | null) => {
    if (a?.kind === "tick") toggle(a.id);
    else if (a?.kind === "month") onOpen(a.categories, a.month);
    else if (a?.kind === "range") {
      // Every month the bars show, first day to last.
      const first = points[0]?.month;
      const last = points.at(-1)?.month;
      if (first && last) onOpen(a.categories, { from: monthRange(first).from, to: monthRange(last).to });
    }
  };

  /** The tooltip's last line: what a click on the segment under the pointer does. */
  const tooltipHint = (month: IsoMonth) => {
    if (!filtered) return s.periodHome.trendPickHint;
    const x = series.find((y) => y.key === lit);
    if (!x) return s.periodHome.trendFilterHint;
    return segmentAction(ticks, index, x, month).kind === "tick" ? s.trendClick.drill(x.name) : s.trendClick.month(formatMonth(month));
  };

  // Demo screenshots (`?shot=trend-legend`): the first legend name, clicked once the bars are in.
  const clicked = useRef(false);
  useEffect(() => {
    if (shot !== "trend-legend" || clicked.current || !trend.data || series.length === 0) return;
    clicked.current = true;
    act(legendAction(ticks, series[0] as Slice));
  });

  /** The bars' keys: Left and Right (Home, End) light a month as pointing does; Enter opens it. */
  const onBarsKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = hover ?? restIndex;
    const to =
      e.key === "ArrowLeft" ? at - 1 : e.key === "ArrowRight" ? at + 1 : e.key === "Home" ? 0 : e.key === "End" ? data.length - 1 : null;
    if (to !== null) {
      e.preventDefault();
      setKeyed(true);
      setHover(Math.min(Math.max(to, 0), data.length - 1));
    } else if (e.key === "Enter" && data[at]) {
      e.preventDefault();
      act(monthAction(ticks, data[at].month));
    }
  };
  const onBarsFocus = (e: FocusEvent<HTMLDivElement>) => {
    // From the keyboard only: a click lands here too, and the pointer already lights its month.
    if (e.target !== e.currentTarget || !e.currentTarget.matches(":focus-visible")) return;
    setKeyed(true);
    setHover(restIndex);
  };
  const onBarsBlur = () => {
    if (!keyed) return;
    setKeyed(false);
    setHover(null);
  };

  const cellOpacity = (key: string, month: IsoMonth) => {
    if (lit !== null) return lit === key ? 1 : 0.22;
    if (hover != null) return data[hover]?.month === month ? 1 : 0.4;
    return inPeriod(month) ? 1 : 0.55;
  };

  return (
    <div ref={box}>
      <Card>
        <CardHeader
          label={s.periodHome.trendTitle}
          action={
            <span className="flex items-center gap-2">
              {filtered && (
                <Button variant="ghost" className="h-8 rounded-xl px-2.5" title={s.periodHome.trendBackHint} onClick={showAll}>
                  <ArrowLeft />
                  {s.periodHome.trendBack}
                </Button>
              )}
              <CategoryChooser
                index={index}
                value={ticks}
                onApply={setTicks}
                none={s.periodHome.trendAll}
                icon={<Layers className="size-3.5 text-muted-foreground" />}
                limit={TREND_LIMIT}
                demo={shot === "trend-picker" ? { search: "", ticks } : undefined}
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
                {focus.total < 0 ? (
                  <MoneyBack amount={focus.total} className="text-[28px] leading-none tracking-tight" />
                ) : (
                  <Money amount={focus.total} decimals={false} className="text-[28px] leading-none tracking-tight" />
                )}
                <span className="text-sm text-muted-foreground">{formatMonth(focus.month)}</span>
              </div>
            )}
            <div
              tabIndex={0}
              role="group"
              aria-label={s.trendClick.barsLabel}
              onKeyDown={onBarsKey}
              onFocus={onBarsFocus}
              onBlur={onBarsBlur}
              className="-mx-2 h-64 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data}
                  margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
                  barCategoryGap="28%"
                  maxBarSize={72}
                  // The box around the chart is the one Tab stop and takes the keys.
                  accessibilityLayer={false}
                  onMouseMove={(st) => {
                    setKeyed(false);
                    setHover(typeof st.activeTooltipIndex === "number" ? st.activeTooltipIndex : null);
                  }}
                  onMouseLeave={() => {
                    setLit(null);
                    if (!keyed) setHover(null);
                  }}
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
                    // The arrow keys show the tooltip on their month, as pointing does.
                    active={keyed ? true : undefined}
                    defaultIndex={keyed && hover != null ? hover : undefined}
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as Row | undefined;
                      if (!active || !row) return null;
                      const rows = series
                        .map((x) => ({ x, amount: Number(row[x.key] ?? 0) }))
                        .filter((r) => r.amount > 0)
                        .sort((a, b) => b.amount - a.amount)
                        .map(({ x, amount }) => ({
                          key: x.key,
                          label: x.name,
                          amount,
                          color: x.color,
                          note: percent(amount, row.drawn),
                          strong: x.key === lit,
                        }));
                      // Money back has no bar: it is listed under the spending, most first.
                      const backRows = series
                        .flatMap((x) => {
                          const amount = backOf(row.month, x.key);
                          if (amount === undefined) return [];
                          return [{ key: x.key, label: x.name, amount: -amount, color: x.color, note: s.moneyBack.word, strong: x.key === lit }];
                        })
                        .sort((a, b) => b.amount - a.amount);
                      return (
                        <ChartTooltip
                          title={formatMonth(row.month)}
                          rows={[...rows, ...backRows]}
                          hint={
                            <>
                              {averageLine && (
                                <div className="mb-1">
                                  {s.average.line(ils(averageLine.amount, { decimals: false }))} · {averageNote}
                                </div>
                              )}
                              {tooltipHint(row.month)}
                            </>
                          }
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
                      onMouseEnter={() => setLit(x.key)}
                      onMouseLeave={() => setLit(null)}
                      onClick={(entry: { payload?: Row }) => entry.payload && act(segmentAction(ticks, index, x, entry.payload.month))}
                    >
                      {data.map((d) => (
                        <Cell key={d.month} opacity={cellOpacity(x.key, d.month)} className="transition-opacity" />
                      ))}
                    </Bar>
                  ))}
                  {averageLine && (
                    <ReferenceLine
                      y={averageLine.amount}
                      // The line stays inside the chart even above every bar.
                      ifOverflow="extendDomain"
                      stroke="var(--foreground)"
                      strokeOpacity={0.55}
                      strokeWidth={1.5}
                      strokeDasharray="6 5"
                      label={(p: { viewBox?: { x?: number; y?: number; width?: number } }) => (
                        <AverageLabel viewBox={p.viewBox} text={s.average.line(ils(averageLine.amount, { decimals: false }))} note={averageNote ?? ""} />
                      )}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <div ref={legendList} role="group" aria-label={s.trendClick.legendLabel} className="contents">
                {series.map((x, i) => {
                  const action = legendAction(ticks, x);
                  // The month on show: what this name gave back then.
                  const back = focus && backOf(focus.month, x.key);
                  return (
                    <button
                      key={x.key}
                      type="button"
                      {...legendItem(i)}
                      // aria-disabled, not disabled: a disabled button gets no hover, so it could not light its bars.
                      aria-disabled={!action}
                      title={!action ? undefined : filtered ? s.periodHome.trendRangeHint : s.periodHome.trendPickHint}
                      onClick={() => act(action)}
                      onMouseEnter={() => setLit(x.key)}
                      onMouseLeave={() => setLit(null)}
                      // The keys light the name's bars too.
                      onFocus={() => {
                        legendItem(i).onFocus();
                        setLit(x.key);
                      }}
                      onBlur={(e) => {
                        legendItem(i).onBlur(e);
                        setLit(null);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-[color,background-color,opacity] outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        action && "cursor-pointer hover:bg-accent/60 hover:text-foreground",
                        lit !== null && lit !== x.key && "opacity-55",
                        lit === x.key && "bg-accent/60 text-foreground",
                      )}
                    >
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: x.color }} />
                      {x.name}
                      {back !== undefined && <MoneyBack amount={back} />}
                    </button>
                  );
                })}
              </div>
              {averageLine ? (
                <span title={averageNote ?? undefined} className="flex items-center gap-1.5 px-1.5 py-1">
                  <span className="w-4 border-t-2 border-dashed border-foreground/55" />
                  {s.average.averageMonth}
                </span>
              ) : average ? null : (
                <span className="px-1.5 py-1">{s.average.none}</span>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

/** "Avg ₪X" at the line's right end, above it; pointing at it names the months (spec 26). */
function AverageLabel({ viewBox, text, note }: { viewBox?: { x?: number; y?: number; width?: number }; text: string; note: string }) {
  const x = (viewBox?.x ?? 0) + (viewBox?.width ?? 0);
  const y = (viewBox?.y ?? 0) - 6;
  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      fontSize={12}
      fontWeight={500}
      fill="var(--foreground)"
      stroke="var(--card)"
      strokeWidth={4}
      paintOrder="stroke"
      style={{ pointerEvents: "auto", cursor: "default" }}
    >
      <title>{note}</title>
      {text}
    </text>
  );
}

/**
 * The bars always show the last 12 months up to the period's end (or this
 * month, if the period runs past it), and more when the period is longer.
 */
function trendRange(range: DateRange): DateRange {
  const thisMonth = toIsoMonth(new Date());
  const end = monthOf(range.to) < thisMonth ? monthOf(range.to) : thisMonth;
  const from = `${shiftMonth(end, -11)}-01`;
  return { from: from < range.from ? from : range.from, to: range.to };
}

/**
 * The ticked categories as series. A ticked category with children shows them
 * one level down (core already counts each child with everything under it),
 * plus "Other in <name>" for rows set on the category itself, keeping only
 * those with money in these months, spent or given back, so its bars say where
 * the money went.
 */
function tickedSeries(index: CategoryIndex, ticks: TrendTicks, points: TrendPoint[]): Slice[] {
  const moved = new Set(points.flatMap((t) => t.parts ?? []).filter((p) => p.amount !== 0).map((p) => p.categoryId));
  return ticks.flatMap((id) => {
    const children = id === null ? [] : (index.children.get(id) ?? []);
    if (id === null || children.length === 0) return [categorySlice(index, id)];
    const parts = [...children.map((c) => c.id), id].filter((x) => moved.has(x));
    return parts.length > 0
      ? parts.map((x) => (x === id ? ownRowsSlice(index, id) : categorySlice(index, x)))
      : [categorySlice(index, id)];
  });
}

/** One bar: each series' amount under its key, as core sent it. */
function rowOf(t: TrendPoint, bar: TrendBar, series: Slice[]): Row {
  const row: Row = { month: t.month, label: formatMonthShort(t.month), total: t.spending, drawn: bar.drawn };
  // A zero for every series, so a month with only money back still has a tooltip.
  for (const x of series) row[x.key] = 0;
  for (const part of bar.parts) row[groupKey(part.categoryId)] = part.amount;
  if (bar.other > 0) row.other = bar.other;
  // Only the highest visible segment of each bar gets rounded corners.
  row.top = series.findLast((x) => Number(row[x.key] ?? 0) > 0)?.key;
  return row;
}

/** The first spending groups, for the demo screenshots of a filtered or hovered chart. */
function firstGroups(index: CategoryIndex, n: number): TrendTicks {
  return index.roots
    .filter((r) => r.kind === "expense")
    .slice(0, n)
    .map((r) => r.id);
}

/**
 * Demo screenshots start ticked: `trend-some` and `trend-picker` two groups,
 * `trend-one` one; `trend-deep` and `trend-legend` a second-level category
 * with its own children, so the bars show the third level (two clicks down).
 */
function shotTicks(shot: string | null, index: CategoryIndex): TrendTicks {
  if (shot === "trend-some" || shot === "trend-picker") return firstGroups(index, 2);
  if (shot === "trend-one") return firstGroups(index, 1);
  if (shot === "trend-deep" || shot === "trend-legend") {
    const roots = index.roots.filter((r) => r.kind === "expense");
    const deep = roots.flatMap((r) => index.children.get(r.id) ?? []).find((c) => (index.children.get(c.id)?.length ?? 0) > 0);
    return deep ? [deep.id] : [];
  }
  return [];
}
