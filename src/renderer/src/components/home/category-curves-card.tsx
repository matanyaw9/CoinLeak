// How spending builds up through the period per category: the top five, or
// categories the owner chooses (F61), with a toggling legend. For a month the
// dashed comparison is last month (one category drawn) or each category's
// average month (spec 26). Core draws the curves (summary:periodCurves,
// stopping at today); this card only lays them out on the period's axis.

import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HomeCurveCompare, PeriodCurve, PeriodSummary } from "@shared/types";
import { s } from "@/strings";
import { useShot } from "@/lib/shot";
import { cn } from "@/lib/utils";
import { categorySlice, parentSlices, type CategoryIndex, type Slice } from "@/lib/categories";
import type { PeriodChoice } from "@/lib/month";
import { usePeriod } from "@/lib/month-context";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Segmented } from "@/components/common/segmented";
import { chartAnimation, ChartTooltip, type TooltipRow } from "@/components/charts/chart-tooltip";
import { CurveCategoryPicker } from "./curve-category-picker";
import { liveChoice, toggleChosen, type CurveChoice } from "./curve-selection";
import { shotCompare, useCurveCategories, useCurveCompare, usePeriodCurves } from "./period-data";
import { axisOf } from "./period-axis";
import { CompareSwitch } from "./spending-curve-card";
import type { SpendingFilter } from "./spending-filter";
import type { PeriodWords } from "./period-words";

type View = "top" | "choose";
type Row = { i: number; title: string } & Record<string, number | string | undefined>;

const TOP = 5;
const PREV_COLOR = "var(--muted-foreground)";
/** The row key of a category's average curve. */
const avgKey = (key: string) => `avg:${key}`;

export function CategoryCurvesCard({
  choice,
  words,
  summary,
  filter,
  index,
  onOpen,
}: {
  choice: PeriodChoice;
  words: PeriodWords;
  /** Already essentials or extras only when Home says so; the curves follow (spec 22). */
  summary: PeriodSummary;
  filter: SpendingFilter;
  index: CategoryIndex;
  onOpen: (slice: Slice) => void;
}) {
  const { range } = usePeriod();
  const shot = useShot();
  const ref = useRef<HTMLDivElement>(null);

  // Demo screenshots: bring this card into view.
  useEffect(() => {
    if (shot?.startsWith("curves")) ref.current?.scrollIntoView({ block: "center" });
  }, [shot]);
  const top = parentSlices(index, summary.byParent).slice(0, TOP);

  const [saved, setSaved] = useCurveCategories(shot === "curves-chosen" ? demoChoice(index, top) : undefined);
  const chosen = liveChoice(saved, index);
  // "Choose" with nothing ticked yet still shows the picker, not the top 5.
  const [choosing, setChoosing] = useState(false);
  const view: View = chosen.length > 0 || choosing ? "choose" : "top";
  const onView = (v: View) => {
    setChoosing(v === "choose");
    if (v === "top" && chosen.length > 0) setSaved([]);
  };
  const toggle = (id: number | null) => {
    setChoosing(true);
    setSaved(toggleChosen(chosen, id));
  };

  const [savedCompare, setCompare] = useCurveCompare(shotCompare(shot));
  const isMonth = choice.kind === "month";
  const compare: HomeCurveCompare = isMonth ? savedCompare : "previous";

  const series = view === "top" ? top : chosen.map((id) => categorySlice(index, id));
  const curves = usePeriodCurves(range, series.map((x) => x.categoryId ?? null), filter);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // F60: the category under the pointer (a line or a legend name) stands out.
  const [lit, setLit] = useState<string | null>(null);
  const byId = new Map((curves.data ?? []).map((c) => [c.categoryId, c]));
  const curveOf = (x: Slice): PeriodCurve | undefined => byId.get(x.categoryId ?? null);

  // Last month's line only when one category is drawn, as before; the average for each.
  const one = series.length === 1 ? series[0] : undefined;
  const showPrevious = compare === "previous" && one !== undefined;
  const showAverage = compare === "average";
  const noAverage = curves.data !== undefined && series.length > 0 && series.every((x) => !curveOf(x)?.average);

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

  const lastOf = (c: PeriodCurve | undefined) =>
    Math.max(c?.series.at(-1)?.amount ?? 0, showPrevious ? (c?.previous.at(-1)?.amount ?? 0) : 0, showAverage ? (c?.average?.series.at(-1)?.amount ?? 0) : 0);
  // While the curves load, keep the chart's place rather than flash "nothing to draw".
  const hasData = curves.data === undefined ? series.length > 0 : series.some((x) => lastOf(curveOf(x)) > 0);
  const toggleHidden = (key: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const shown = series.filter((x) => !hidden.has(x.key));

  const dot = (slice: Slice, color: string) => (p: { cx?: number; cy?: number; index?: number }) =>
    p.cx == null || p.cy == null ? (
      <g key={p.index} />
    ) : (
      <g key={p.index} className="cursor-pointer" onClick={() => onOpen(slice)}>
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
            <Segmented<View>
              label={s.curvePick.viewLabel}
              value={view}
              onChange={onView}
              options={[
                { value: "top", label: s.curvePick.top },
                { value: "choose", label: s.curvePick.choose },
              ]}
            />
          }
        />
        {isMonth && <CompareSwitch value={compare} onChange={setCompare} noAverage={noAverage} />}

        <div className="mb-4 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
          {view === "choose" && (
            <CurveCategoryPicker index={index} chosen={chosen} onToggle={toggle} defaultOpen={shot === "curves-picker"} />
          )}
          {series.map((x) => {
            const off = hidden.has(x.key);
            return (
              <button
                key={x.key}
                type="button"
                aria-pressed={!off}
                title={s.curves.legendHint}
                onClick={() => toggleHidden(x.key)}
                onMouseEnter={() => setLit(off ? null : x.key)}
                onMouseLeave={() => setLit(null)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent/60 hover:text-foreground",
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
          {series.length > 0 && (showPrevious || (showAverage && !noAverage)) && (
            <span className="flex items-center gap-1.5 px-1.5">
              <span className="w-4 border-t-2 border-dashed border-muted-foreground/70" />
              <span className="first-letter:uppercase">{showAverage ? s.average.averageMonth : words.before}</span>
            </span>
          )}
        </div>

        {!hasData ? (
          <EmptyState
            compact
            title={view === "choose" && series.length === 0 ? s.curvePick.empty : series.length === 1 ? s.curves.empty : s.curves.emptyTop}
            className="flex-1"
          />
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
                    onClick={() => onOpen(x)}
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

/** Demo screenshots (`?shot=curves-chosen`): a subcategory of the biggest group and the next two groups. */
function demoChoice(index: CategoryIndex, top: Slice[]): CurveChoice {
  const first = top[0]?.categoryId;
  const sub = typeof first === "number" ? index.children.get(first)?.[0]?.id : undefined;
  return [sub ?? first ?? null, top[1]?.categoryId ?? null, top[2]?.categoryId ?? null].filter((id, i, all) => all.indexOf(id) === i);
}
