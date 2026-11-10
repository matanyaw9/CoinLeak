// Month by month: the last 12 months up to the period (more if it is longer) as stacked
// bars (specs 16 and 22). Under All they split into essential, extra and
// neither, or by top-level category; under Essentials, Extras or Neither, by category
// with core's filter. Ticking categories (in the list, or by clicking a bar
// segment or legend name) shows only theirs, with a clear way back. Pointing
// at a segment or a legend name lights that series in every bar (F60).

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarShapeProps } from "recharts";
import { ArrowLeft } from "lucide-react";
import type { DateRange, IsoMonth, TrendPoint } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { colorOf, OTHER_COLOR, parentSlices, UNCATEGORIZED_COLOR, type CategoryIndex, type Slice } from "@/lib/categories";
import { monthOf, shiftMonth, toIsoMonth } from "@/lib/month";
import { formatMonth, formatMonthShort, percent } from "@/lib/format";
import { useShot } from "@/lib/shot";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { Segmented } from "@/components/common/segmented";
import { Button } from "@/components/ui/button";
import { chartAnimation, ChartTooltip } from "@/components/charts/chart-tooltip";
import { TrendCategoryPicker } from "./trend-category-picker";
import { toggleTick, type TrendTicks } from "./trend-filter";
import { usePeriodTrend, type TrendFilter } from "./period-data";
import type { SpendingFilter } from "./spending-filter";

type Row = { month: IsoMonth; label: string; total: number; top?: string } & Record<string, number | string | undefined>;
type View = "split" | "groups";

const MAX_SERIES = 6;

/** The three parts of all spending under the split view, keyed like core's `split`. */
const SPLIT: Slice[] = [
  { key: "essential", categoryId: undefined, name: s.essentials.essential, emoji: null, color: "var(--chart-5)", amount: 0 },
  { key: "extra", categoryId: undefined, name: s.essentials.extra, emoji: null, color: "var(--chart-2)", amount: 0 },
  { key: "untagged", categoryId: null, name: s.essentials.untaggedName, emoji: null, color: UNCATEGORIZED_COLOR, amount: 0 },
];

export function TrendCard({
  range,
  index,
  filter,
  onFilter,
  onOpen,
}: {
  range: DateRange;
  index: CategoryIndex;
  filter: SpendingFilter;
  onFilter: (filter: SpendingFilter) => void;
  onOpen: (slice: Slice, month: IsoMonth) => void;
}) {
  const shot = useShot();
  const [ticks, setTicks] = useState<TrendTicks>(() => (shot === "trend-some" || shot === "trend-picker" ? firstGroups(index, 2) : []));
  const [view, setView] = useState<View>(shot === "trend-hover" ? "groups" : "split");
  const [hover, setHover] = useState<number | null>(null);
  // The series under the pointer; demo screenshots (`?shot=trend-hover`) light the first group.
  const [lit, setLit] = useState<string | null>(shot === "trend-hover" ? String(firstGroups(index, 1)[0]) : null);
  const box = useRef<HTMLDivElement>(null);
  // Demo screenshots: `?shot=trend...` scroll here.
  useEffect(() => {
    if (shot?.startsWith("trend")) box.current?.scrollIntoView({ block: "center" });
  }, [shot]);
  // Clicking "Neither" shows only that spending here; it is not one of Home's filters.
  const [neither, setNeither] = useState(false);
  // A change of Home's filter leaves Neither (React's "adjust state while rendering").
  const [seenFilter, setSeenFilter] = useState(filter);
  if (filter !== seenFilter) {
    setSeenFilter(filter);
    setNeither(false);
  }
  const tag: TrendFilter = filter === "all" && neither ? "untagged" : filter;
  const trend = usePeriodTrend(trendRange(range), ticks, tag);
  const points = trend.data ?? [];
  const inPeriod = (m: IsoMonth) => m >= monthOf(range.from) && m <= monthOf(range.to);

  const filtered = ticks.length > 0;
  const canSplit = tag === "all" && !filtered;
  const showAll = () => {
    setTicks([]);
    setNeither(false);
    if (filter !== "all") onFilter("all");
  };
  const split = canSplit && view === "split";
  const toggle = (id: number | null) => setTicks((t) => toggleTick(t, id, index));
  const series = split ? SPLIT : filtered ? ticks.map((id) => sliceOf(index, id)) : topGroups(index, points);
  const data = points.map((t) => rowOf(t, series, split, filtered));

  const focus = hover != null ? data[hover] : (data.findLast((d) => inPeriod(d.month)) ?? data.at(-1));
  const hasData = points.some((t) => t.spending > 0);

  /** Essential and extra switch Home's filter, neither shows its own bars; anything else is a category. */
  const pick = (x: Slice, month: IsoMonth | undefined) => {
    if (x.key === "essential" || x.key === "extra") return onFilter(x.key);
    if (split && x.key === "untagged") return setNeither(true);
    if (!month) return;
    if (filtered || split || x.categoryId === undefined) onOpen(x, month);
    else toggle(x.categoryId);
  };
  const legendClickable = (x: Slice) => split || x.categoryId !== undefined;
  const tagName = tag === "untagged" ? s.essentials.untaggedName : tag === "all" ? null : s.essentials[tag];
  const legendClick = (x: Slice) => {
    if (split) pick(x, undefined);
    else if (x.categoryId !== undefined) toggle(x.categoryId);
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
          label={tagName ? `${s.periodHome.trendTitle} · ${tagName}` : s.periodHome.trendTitle}
          action={
            <span className="flex items-center gap-2">
              {canSplit && (
                <Segmented<View>
                  label={s.essentials.viewLabel}
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "split", label: s.essentials.splitView },
                    { value: "groups", label: s.essentials.groupView },
                  ]}
                />
              )}
              {(filtered || tag === "untagged") && (
                <Button variant="ghost" className="h-8 rounded-xl px-2.5" title={s.periodHome.trendBackHint} onClick={showAll}>
                  <ArrowLeft />
                  {s.periodHome.trendBack}
                </Button>
              )}
              <TrendCategoryPicker
                index={index}
                ticks={ticks}
                onToggle={toggle}
                onClear={showAll}
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
                  onMouseLeave={() => {
                    setHover(null);
                    setLit(null);
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
                    content={({ active, payload }) => {
                      const row = payload?.[0]?.payload as Row | undefined;
                      if (!active || !row) return null;
                      const rows = series
                        .map((x) => ({ x, amount: Number(row[x.key] ?? 0) }))
                        // The split view always names all three parts.
                        .filter((r) => split || r.amount > 0)
                        .sort((a, b) => (split ? 0 : b.amount - a.amount))
                        .map(({ x, amount }) => ({
                          key: x.key,
                          label: x.name,
                          amount,
                          color: x.color,
                          note: percent(amount, row.total),
                          strong: x.key === lit,
                        }));
                      return (
                        <ChartTooltip
                          title={formatMonth(row.month)}
                          rows={rows}
                          hint={split ? s.essentials.splitHint : filtered ? s.periodHome.trendFilterHint : s.periodHome.trendPickHint}
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
                      onClick={(entry: { payload?: Row }) => pick(x, entry.payload?.month)}
                    >
                      {data.map((d) => (
                        <Cell key={d.month} opacity={cellOpacity(x.key, d.month)} className="transition-opacity" />
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
                  // aria-disabled, not disabled: a disabled button gets no hover, so it could not light its bars.
                  aria-disabled={!legendClickable(x)}
                  title={!legendClickable(x) ? undefined : split ? s.essentials.splitHint : filtered ? s.periodHome.trendUntickHint : s.periodHome.trendPickHint}
                  onClick={() => legendClickable(x) && legendClick(x)}
                  onMouseEnter={() => setLit(x.key)}
                  onMouseLeave={() => setLit(null)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-[color,background-color,opacity]",
                    legendClickable(x) && "cursor-pointer hover:bg-accent/60 hover:text-foreground",
                    lit !== null && lit !== x.key && "opacity-55",
                    lit === x.key && "bg-accent/60 text-foreground",
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
    </div>
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

/** A ticked category (or uncategorized) as a chart series, keyed like core's `byParent`. */
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

/** All spending: the groups that are biggest over these months (by core's roll-up), the rest as "Other". */
function topGroups(index: CategoryIndex, points: TrendPoint[]): Slice[] {
  const size = new Map<number | null, number>();
  for (const g of points.flatMap((t) => t.byParent)) size.set(g.categoryId, (size.get(g.categoryId) ?? 0) + g.amount);
  const groups = parentSlices(index, [...size].map(([categoryId, amount]) => ({ categoryId, amount })));
  if (groups.length <= MAX_SERIES) return groups;
  const other: Slice = { key: "other", categoryId: undefined, name: s.common.other, emoji: null, color: OTHER_COLOR, amount: 0 };
  return [...groups.slice(0, MAX_SERIES), other];
}

/** One bar: each series' amount under its key. Core already split the month by tag, or by series when filtered. */
function rowOf(t: TrendPoint, series: Slice[], split: boolean, filtered: boolean): Row {
  const row: Row = { month: t.month, label: formatMonthShort(t.month), total: t.spending };
  const keys = new Set(series.map((x) => x.key));
  const parts = split
    ? Object.entries(t.split ?? {}).map(([key, amount]) => ({ key, amount }))
    : filtered
      ? t.byCategory.map((c) => ({ key: c.categoryId === null ? "none" : String(c.categoryId), amount: c.amount }))
      : t.byParent.map((g) => ({ key: g.categoryId === null ? "none" : String(g.categoryId), amount: g.amount }));
  for (const part of parts) {
    const key = keys.has(part.key) ? part.key : "other";
    row[key] = Number(row[key] ?? 0) + Math.max(0, part.amount);
  }
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
