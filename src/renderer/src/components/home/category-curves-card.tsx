// How spending builds up through the month per category: one chosen category
// against last month, or the top five side by side with a toggling legend.
// Core draws the curves (summary:curves); this card only lays them out.

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CategoryCurve, IsoMonth, MonthSummary } from "@shared/types";
import { s } from "@/strings";
import { call } from "@/lib/api";
import { useShot } from "@/lib/shot";
import { cn } from "@/lib/utils";
import { colorOf, parentSlices, type CategoryIndex, type Slice } from "@/lib/categories";
import { daysInMonth, shiftMonth, toIsoDate } from "@/lib/month";
import { formatDayShort, formatMonthName } from "@/lib/format";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Segmented } from "@/components/common/segmented";
import { chartAnimation, ChartTooltip, type TooltipRow } from "@/components/charts/chart-tooltip";
import { CurveCategoryPicker } from "./curve-category-picker";

type Mode = "one" | "top";
type Row = { day: number; date: string } & Record<string, number | string | undefined>;

const TOP = 5;
const PREV_COLOR = "var(--muted-foreground)";

const useCurves = (month: IsoMonth, categoryIds: (number | null)[]) =>
  useQuery({
    queryKey: ["summary:curves", { month, categoryIds }],
    queryFn: () => call("summary:curves", { month, categoryIds }),
    enabled: categoryIds.length > 0,
    placeholderData: (prev) => prev,
  });

/** One row per day of the month; this month stops at today. */
function rowsOf(month: IsoMonth, series: { key: string; points?: CategoryCurve["byDay"]; cutAtToday: boolean }[]): Row[] {
  const today = toIsoDate(new Date());
  return Array.from({ length: daysInMonth(month) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const row: Row = { day: i + 1, date };
    for (const x of series) {
      if (x.cutAtToday && date > today) continue;
      row[x.key] = x.points?.[i]?.amount;
    }
    return row;
  });
}

export function CategoryCurvesCard({
  month,
  summary,
  index,
  onOpen,
}: {
  month: IsoMonth;
  summary: MonthSummary;
  index: CategoryIndex;
  onOpen: (slice: Slice) => void;
}) {
  const shot = useShot();
  const [mode, setMode] = useState<Mode>(shot === "curves-top" ? "top" : "one");
  const ref = useRef<HTMLDivElement>(null);

  // Demo screenshots: bring this card into view.
  useEffect(() => {
    if (shot?.startsWith("curves")) ref.current?.scrollIntoView({ block: "center" });
  }, [shot]);
  const top = parentSlices(index, summary.byParent).slice(0, TOP);
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const chosen = picked !== undefined ? picked : (top[0]?.categoryId ?? index.roots.find((r) => r.kind === "expense")?.id ?? null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const ids = mode === "one" ? [chosen ?? null] : top.map((x) => x.categoryId ?? null);
  const curves = useCurves(month, ids);
  const byId = new Map((curves.data ?? []).map((c) => [c.categoryId, c]));

  const chosenCat = chosen === null ? null : (index.byId.get(chosen) ?? null);
  const chosenSlice: Slice = {
    key: chosen === null ? "none" : String(chosen),
    categoryId: chosen,
    name: chosenCat?.name ?? s.common.uncategorized,
    emoji: chosenCat?.emoji ?? null,
    color: colorOf(chosenCat),
    amount: 0,
  };
  const one = byId.get(chosen ?? null);
  const prevMonth = shiftMonth(month, -1);

  const data =
    mode === "one"
      ? rowsOf(month, [
          { key: "current", points: one?.byDay, cutAtToday: true },
          { key: "previous", points: one?.previousByDay, cutAtToday: false },
        ])
      : rowsOf(
          month,
          top.map((x) => ({ key: x.key, points: byId.get(x.categoryId ?? null)?.byDay, cutAtToday: true })),
        );

  const hasData =
    mode === "one"
      ? (one?.byDay.at(-1)?.amount ?? 0) > 0 || (one?.previousByDay.at(-1)?.amount ?? 0) > 0
      : top.length > 0;
  const ticks = [1, 8, 15, 22, 29].filter((d) => d <= daysInMonth(month));
  const toggle = (key: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
  const lastIndex = data.findLastIndex((r) => Object.keys(r).some((k) => k !== "previous" && k !== "day" && k !== "date" && r[k] !== undefined));
  const endDot = (color: string) => (p: { cx?: number; cy?: number; index?: number }) =>
    p.index === lastIndex && p.cx != null && p.cy != null ? (
      <circle key="end" cx={p.cx} cy={p.cy} r={4} fill={color} stroke="var(--card)" strokeWidth={2} />
    ) : (
      <g key={p.index} />
    );

  return (
    <div ref={ref} className="h-full">
      <Card className="flex h-full flex-col">
        <CardHeader
          label={s.curves.title}
          action={
            <Segmented<Mode>
              label={s.curves.modeLabel}
              value={mode}
              onChange={setMode}
              options={[
                { value: "one", label: s.curves.modeOne },
                { value: "top", label: s.curves.modeTop },
              ]}
            />
          }
        />

        <div className="mb-4 flex min-h-8 flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          {mode === "one" ? (
            <>
              <CurveCategoryPicker index={index} value={chosen} onSelect={setPicked} />
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: chosenSlice.color }} />
                {formatMonthName(month)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-muted-foreground/70" />
                {formatMonthName(prevMonth)}
              </span>
            </>
          ) : (
            top.map((x) => {
              const off = hidden.has(x.key);
              return (
                <button
                  key={x.key}
                  type="button"
                  aria-pressed={!off}
                  title={s.curves.legendHint}
                  onClick={() => toggle(x.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-accent/60 hover:text-foreground",
                    off && "opacity-45 line-through",
                  )}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: x.color }} />
                  {x.name}
                </button>
              );
            })
          )}
        </div>

        {!hasData ? (
          <EmptyState compact title={mode === "one" ? s.curves.empty : s.curves.emptyTop} className="flex-1" />
        ) : (
          <div className="-mx-2 min-h-60 flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={240}>
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="day"
                  ticks={ticks}
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
                    if (mode === "one") {
                      if (typeof p.current === "number")
                        rows.push({ key: "c", label: chosenSlice.name, amount: p.current, color: chosenSlice.color, strong: true });
                      if (typeof p.previous === "number")
                        rows.push({ key: "p", label: s.curves.byDay(p.day, formatMonthName(prevMonth)), amount: p.previous, color: PREV_COLOR, dashed: true });
                    } else {
                      for (const x of top) {
                        const v = p[x.key];
                        if (!hidden.has(x.key) && typeof v === "number") rows.push({ key: x.key, label: x.name, amount: v, color: x.color });
                      }
                      rows.sort((a, b) => b.amount - a.amount);
                    }
                    if (!rows.length) return null;
                    return <ChartTooltip title={formatDayShort(p.date)} rows={rows} hint={s.curves.hint} />;
                  }}
                />
                {mode === "one" ? (
                  [
                    <Line
                      key="previous"
                      type="monotone"
                      dataKey="previous"
                      stroke={PREV_COLOR}
                      strokeOpacity={0.6}
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 3.5, fill: PREV_COLOR, stroke: "var(--card)", strokeWidth: 2 }}
                      {...chartAnimation()}
                    />,
                    <Line
                      key="current"
                      type="monotone"
                      dataKey="current"
                      stroke={chosenSlice.color}
                      strokeWidth={2.5}
                      dot={endDot(chosenSlice.color)}
                      activeDot={dot(chosenSlice, chosenSlice.color)}
                      connectNulls={false}
                      {...chartAnimation()}
                    />,
                  ]
                ) : (
                  top
                    .filter((x) => !hidden.has(x.key))
                    .map((x) => (
                      <Line
                        key={x.key}
                        type="monotone"
                        dataKey={x.key}
                        stroke={x.color}
                        strokeWidth={2}
                        dot={endDot(x.color)}
                        activeDot={dot(x, x.color)}
                        connectNulls={false}
                        {...chartAnimation()}
                      />
                    ))
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
