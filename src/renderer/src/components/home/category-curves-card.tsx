// How spending builds up through the period by category: the top five, one
// line each with a legend that hides and shows them (F61), or the categories
// the owner chooses added up into one line (spec 38, F79). The dashed
// comparison is the period before (one line drawn) or, for a month, the
// average month (spec 26). Core draws the curves (summary:periodCurves and
// summary:periodCurveSum, stopping at today); this card only lays them out.

import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tag } from "lucide-react";
import type { AverageCurve, HomeCurveCompare, PeriodSummary, SeriesPoint } from "@shared/types";
import { s } from "@/strings";
import { useShot } from "@/lib/shot";
import { cn } from "@/lib/utils";
import { categorySlice, parentSlices, type CategoryIndex, type Slice } from "@/lib/categories";
import type { PeriodChoice } from "@/lib/month";
import { usePeriod } from "@/lib/month-context";
import { useRoving } from "@/lib/roving";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { chartAnimation, ChartTooltip, type TooltipRow } from "@/components/charts/chart-tooltip";
import { CategoryChooser, type ChooserDemo } from "./category-chooser";
import { chooserItems, nameOf } from "./chooser";
import { liveChoice, sumName, type CurveChoice } from "./curve-selection";
import { shotCompare, useCurveCategories, useCurveCompare, usePeriodCurveSum, usePeriodCurves } from "./period-data";
import { axisOf } from "./period-axis";
import { CompareSwitch } from "./spending-curve-card";
import type { PeriodWords } from "./period-words";

type Row = { i: number; title: string } & Record<string, number | string | undefined>;
/** What one drawn line needs: a single category's curve or the chosen ones added up. */
type Curve = { series: SeriesPoint[]; previous: SeriesPoint[]; average?: AverageCurve | null };

const TOP = 5;
const PREV_COLOR = "var(--muted-foreground)";
/** The row key of a line's average curve. */
const avgKey = (key: string) => `avg:${key}`;

export function CategoryCurvesCard({
  choice,
  words,
  summary,
  index,
  onOpen,
}: {
  choice: PeriodChoice;
  words: PeriodWords;
  summary: PeriodSummary;
  index: CategoryIndex;
  /** Transactions in this period for these categories. */
  onOpen: (categories: (number | null)[]) => void;
}) {
  const { range } = usePeriod();
  const shot = useShot();
  const ref = useRef<HTMLDivElement>(null);

  // Demo screenshots: bring this card into view.
  useEffect(() => {
    if (shot?.startsWith("curves")) ref.current?.scrollIntoView({ block: "center" });
  }, [shot]);
  const top = parentSlices(index, summary.byParent).slice(0, TOP);

  const [saved, setSaved] = useCurveCategories(shot === "curves-chosen" || shot === "curves-sum" ? demoChoice(index, top) : undefined);
  const chosen = liveChoice(saved, index);
  // Chosen categories are one line, added up; nothing chosen is the top 5.
  const summed = chosen.length > 0;

  const [savedCompare, setCompare] = useCurveCompare(shotCompare(shot));
  const isMonth = choice.kind === "month";
  const compare: HomeCurveCompare = isMonth ? savedCompare : "previous";

  const sumLine: Slice = {
    key: "sum",
    categoryId: undefined,
    name: sumName(chosen, index),
    emoji: null,
    color: chosen.length === 1 ? categorySlice(index, chosen[0] ?? null).color : "var(--primary)",
    amount: 0,
  };
  const series = summed ? [sumLine] : top;
  const tops = usePeriodCurves(range, summed ? [] : top.map((x) => x.categoryId ?? null));
  const sum = usePeriodCurveSum(range, chosen);
  const byId = new Map((tops.data ?? []).map((c) => [c.categoryId, c]));
  const curveOf = (x: Slice): Curve | undefined => (summed ? sum.data : byId.get(x.categoryId ?? null));
  const loaded = summed ? sum.data !== undefined : tops.data !== undefined;
  const openLine = (x: Slice) => onOpen(summed ? chosen : [x.categoryId ?? null]);

  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // F60: the category under the pointer (a line or a legend name) stands out.
  const [lit, setLit] = useState<string | null>(null);

  // Last month's line only when one line is drawn, as before; the average for each.
  const one = series.length === 1 ? series[0] : undefined;
  const showPrevious = compare === "previous" && one !== undefined;
  const showAverage = compare === "average";
  const noAverage = loaded && series.length > 0 && series.every((x) => !curveOf(x)?.average);

  const axis = axisOf(summary, summary.bucket);
  const data: Row[] = axis.points.map((p, i) => {
    const row: Row = { i, title: p.title };
    for (const x of series) {
      const c = curveOf(x);
      row[x.key] = c?.series[i]?.amount;
      if (showAverage) row[avgKey(x.key)] = c?.average?.series[i]?.amount;
    }
    if (showPrevious && one) row.previous = curveOf(one)?.previous[i]?.amount;
    return row;
  });

  const lastOf = (c: Curve | undefined) =>
    Math.max(c?.series.at(-1)?.amount ?? 0, showPrevious ? (c?.previous.at(-1)?.amount ?? 0) : 0, showAverage ? (c?.average?.series.at(-1)?.amount ?? 0) : 0);
  // While the curves load, keep the chart's place rather than flash "nothing to draw".
  const hasData = !loaded ? series.length > 0 : series.some((x) => lastOf(curveOf(x)) > 0);
  const toggleHidden = (key: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const shown = series.filter((x) => summed || !hidden.has(x.key));
  // The top 5's names are one Tab stop; Left and Right move along them.
  const { list: legendList, item: legendItem } = useRoving(
    series.map((x) => x.key),
    { columns: series.length },
  );

  const dot = (slice: Slice, color: string) => (p: { cx?: number; cy?: number; index?: number }) =>
    p.cx == null || p.cy == null ? (
      <g key={p.index} />
    ) : (
      <g key={p.index} className="cursor-pointer" onClick={() => openLine(slice)}>
        <circle cx={p.cx} cy={p.cy} r={12} fill="transparent" />
        <circle cx={p.cx} cy={p.cy} r={4.5} fill={color} stroke="var(--card)" strokeWidth={2} />
      </g>
    );

  // The last drawn day (today in the current month) gets a dot, like the spending curve.
  const lastIndex = data.findLastIndex((r) => series.some((x) => r[x.key] !== undefined));
  const endDot = (color: string) => (p: { cx?: number; cy?: number; index?: number }) =>
    p.index === lastIndex && p.cx != null && p.cy != null ? (
      <circle key="end" cx={p.cx} cy={p.cy} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />
    ) : (
      <g key={p.index} />
    );
  const dim = (key: string) => lit !== null && lit !== key;

  return (
    <div ref={ref} className="h-full">
      <Card className="flex h-full flex-col">
        <CardHeader
          label={isMonth ? s.curves.title : s.periodHome.curvesTitle}
          action={
            <CategoryChooser
              index={index}
              value={chosen}
              onApply={setSaved}
              none={s.curvePick.top}
              icon={<Tag className="size-3.5 text-muted-foreground" />}
              demo={shot === "curves-picker" ? demoSearch(index) : undefined}
            />
          }
        />
        {isMonth && <CompareSwitch value={compare} onChange={setCompare} noAverage={noAverage} />}

        <div className="mb-4 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          {summed ? (
            <span title={chosen.map((id) => nameOf(index, id)).join(", ")} className="flex items-center gap-1.5 px-1.5 py-1 text-foreground">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: sumLine.color }} />
              {sumLine.name}
            </span>
          ) : (
            <div ref={legendList} role="group" aria-label={s.trendClick.legendLabel} className="contents">
              {series.map((x, i) => {
                const off = hidden.has(x.key);
                return (
                  <button
                    key={x.key}
                    type="button"
                    {...legendItem(i)}
                    aria-pressed={!off}
                    title={s.curves.legendHint}
                    onClick={() => toggleHidden(x.key)}
                    onMouseEnter={() => setLit(off ? null : x.key)}
                    onMouseLeave={() => setLit(null)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
                      off && "opacity-45 line-through",
                      !off && dim(x.key) && "opacity-55",
                      lit === x.key && "bg-accent/60 text-foreground",
                    )}
                  >
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: x.color }} />
                    {x.name}
                  </button>
                );
              })}
            </div>
          )}
          {series.length > 0 && (showPrevious || (showAverage && !noAverage)) && (
            <span className="flex items-center gap-1.5 px-1.5">
              <span className="w-4 border-t-2 border-dashed border-muted-foreground/70" />
              <span className="first-letter:uppercase">{showAverage ? s.average.averageMonth : words.before}</span>
            </span>
          )}
        </div>

        {!hasData ? (
          <EmptyState compact title={summed ? s.curvePick.empty : series.length === 1 ? s.curves.empty : s.curves.emptyTop} className="flex-1" />
        ) : (
          <div className="-mx-2 min-h-60 flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={240}>
              <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 12 }} onMouseLeave={() => setLit(null)}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="i"
                  type="number"
                  domain={[0, Math.max(data.length - 1, 1)]}
                  tickFormatter={(i: number) => axis.points[i]?.label ?? ""}
                  ticks={axis.ticks}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                />
                <YAxis hide domain={[0, (max: number) => Math.max(max, 1) * 1.08]} />
                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeWidth: 1.5 }}
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as Row | undefined;
                    if (!active || !p) return null;
                    const rows: TooltipRow[] = [];
                    for (const x of shown) {
                      const v = p[x.key];
                      if (typeof v === "number") rows.push({ key: x.key, label: x.name, amount: v, color: x.color, strong: series.length === 1 });
                    }
                    rows.sort((a, b) => b.amount - a.amount);
                    if (typeof p.previous === "number")
                      rows.push({ key: "p", label: isMonth ? s.curves.byDay(p.i + 1, words.before) : words.before, amount: p.previous, color: PREV_COLOR, dashed: true });
                    for (const x of shown) {
                      const v = p[avgKey(x.key)];
                      if (typeof v === "number")
                        rows.push({ key: avgKey(x.key), label: series.length === 1 ? s.average.byDay(p.i + 1) : `${x.name} · ${s.average.averageMonth}`, amount: v, color: x.color, dashed: true });
                    }
                    if (!rows.length) return null;
                    return <ChartTooltip title={p.title} rows={rows} hint={s.curves.hint} />;
                  }}
                />
                {showPrevious && (
                  <Line
                    type="monotone"
                    dataKey="previous"
                    stroke={PREV_COLOR}
                    strokeOpacity={0.6}
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 3.5, fill: PREV_COLOR, stroke: "var(--card)", strokeWidth: 2 }}
                    {...chartAnimation()}
                  />
                )}
                {showAverage &&
                  shown.map((x) => (
                    <Line
                      key={avgKey(x.key)}
                      type="monotone"
                      dataKey={avgKey(x.key)}
                      stroke={x.color}
                      strokeOpacity={dim(x.key) ? 0.15 : 0.7}
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={false}
                      {...chartAnimation()}
                    />
                  ))}
                {shown.map((x) => (
                  <Line
                    key={x.key}
                    type="monotone"
                    dataKey={x.key}
                    stroke={x.color}
                    strokeWidth={lit === x.key || series.length === 1 ? 2.5 : 2}
                    strokeOpacity={dim(x.key) ? 0.2 : 1}
                    dot={endDot(x.color)}
                    activeDot={dim(x.key) ? false : dot(x, x.color)}
                    connectNulls={false}
                    className="cursor-pointer"
                    onMouseEnter={() => setLit(x.key)}
                    onMouseLeave={() => setLit(null)}
                    onClick={() => openLine(x)}
                    {...chartAnimation()}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}

/** Demo screenshots (`?shot=curves-chosen`, `curves-sum`): a subcategory of the biggest group and the next two groups. */
function demoChoice(index: CategoryIndex, top: Slice[]): CurveChoice {
  const first = top[0]?.categoryId;
  const sub = typeof first === "number" ? index.children.get(first)?.[0]?.id : undefined;
  return [sub ?? first ?? null, top[1]?.categoryId ?? null, top[2]?.categoryId ?? null].filter((id, i, all) => all.indexOf(id) === i);
}

/** Demo screenshots (`?shot=curves-picker`): the chooser open on "groc" with the first three lines that hold nothing else ticked. */
function demoSearch(index: CategoryIndex): ChooserDemo {
  const search = "groc";
  const leaves = chooserItems(index, search).filter((x) => x.id !== null && !index.children.get(x.id)?.length);
  return { search, ticks: leaves.slice(0, 3).map((x) => x.id) };
}
