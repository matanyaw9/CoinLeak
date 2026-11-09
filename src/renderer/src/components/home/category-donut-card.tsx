// Spending by top-level category as a donut with a clickable list, from
// core's per-parent totals. Small slices fold into "Other" in the chart only;
// the list shows every category. Pointing at a slice or a name shows it in
// the donut's middle, so nothing ever covers the slice (spec 16).

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Ellipsis, Tag } from "lucide-react";
import type { PeriodSummary } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { OTHER_COLOR, parentSlices, type CategoryIndex, type Slice } from "@/lib/categories";
import { percent } from "@/lib/format";
import { useShot } from "@/lib/shot";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { chartAnimation } from "@/components/charts/chart-tooltip";
import type { PeriodWords } from "./period-words";

/** Slices smaller than this share of spending fold into "Other" in the chart. */
const MIN_SHARE = 0.04;
const MAX_SLICES = 7;

/** The chart's slices, and which list keys each chart slice stands for. */
function chartSlices(all: Slice[], total: number): { slices: Slice[]; members: Map<string, string[]> } {
  const big = all.filter((x, i) => i < MAX_SLICES - 1 && x.amount >= total * MIN_SHARE);
  const rest = all.slice(big.length);
  const members = new Map(all.map((x) => [x.key, [x.key]]));
  if (rest.length <= 1) return { slices: all, members };
  const other: Slice = {
    key: "other",
    categoryId: undefined,
    name: s.common.other,
    emoji: null,
    color: OTHER_COLOR,
    amount: rest.reduce((a, x) => a + x.amount, 0),
  };
  members.set("other", rest.map((x) => x.key));
  return { slices: [...big, other], members };
}

export function CategoryDonutCard({
  summary,
  words,
  index,
  onOpen,
}: {
  summary: PeriodSummary;
  words: PeriodWords;
  index: CategoryIndex;
  onOpen: (slice: Slice) => void;
}) {
  const all = parentSlices(index, summary.byParent);
  const total = summary.spending;
  const { slices, members } = chartSlices(all, total);
  const shot = useShot();
  // Demo screenshots: `?shot=donut-hover` points at the second slice.
  const [hover, setHover] = useState<string | null>(shot === "donut-hover" ? (slices[1]?.key ?? null) : null);

  // A hovered list row lights its chart slice, which may be "Other".
  const sliceOf = (key: string) => slices.find((x) => members.get(x.key)?.includes(key))?.key ?? key;
  const litSlice = hover ? sliceOf(hover) : null;
  const litRows = new Set(hover ? (members.get(hover) ?? [hover]) : []);
  const focus = hover ? (slices.find((x) => x.key === hover) ?? all.find((x) => x.key === hover)) : undefined;
  const otherCount = members.get("other")?.length ?? 0;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader label={s.home.donutTitle} action={s.periodHome.spentWhen(words.when)} />
      {all.length === 0 ? (
        <EmptyState compact title={s.home.donutEmpty} className="flex-1" />
      ) : (
        <div className="flex flex-1 flex-col gap-5">
          <div className="relative mx-auto size-48" data-testid="donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius="72%"
                  outerRadius="100%"
                  paddingAngle={2}
                  cornerRadius={5}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                  {...chartAnimation()}
                  onMouseEnter={(_, i) => setHover(slices[i]?.key ?? null)}
                  onMouseLeave={() => setHover(null)}
                  onClick={(_, i) => {
                    const slice = slices[i];
                    if (slice) onOpen(slice);
                  }}
                  className="cursor-pointer outline-none"
                >
                  {slices.map((x) => (
                    <Cell
                      key={x.key}
                      fill={x.color}
                      opacity={litSlice && litSlice !== x.key ? 0.3 : 1}
                      className="outline-none transition-opacity"
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-9 text-center" aria-live="polite">
              {focus ? (
                <>
                  <span className="flex max-w-full items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: focus.color }} />
                    <span className="truncate">{focus.key === "other" ? s.periodHome.donutOther(otherCount) : focus.name}</span>
                  </span>
                  <Money amount={focus.amount} decimals={false} className="mt-1 text-xl tracking-tight" />
                  <span className="mt-0.5 text-xs text-muted-foreground tabular-nums">{percent(focus.amount, total)}</span>
                </>
              ) : (
                <>
                  <Money amount={total} decimals={false} className="text-2xl tracking-tight" />
                  <span className="mt-0.5 text-xs text-muted-foreground">{s.home.donutCenter}</span>
                </>
              )}
            </div>
          </div>

          <ul className="-mx-2 max-h-72 space-y-0.5 overflow-y-auto">
            {all.map((x) => (
              <li key={x.key}>
                <button
                  type="button"
                  onClick={() => onOpen(x)}
                  onMouseEnter={() => setHover(x.key)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent/60",
                    hover && !litRows.has(x.key) && "opacity-55",
                    hover && litRows.has(x.key) && "bg-accent/60",
                  )}
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: x.color }} />
                  <span className="flex w-5 shrink-0 justify-center text-[15px] leading-none text-muted-foreground">
                    {x.emoji ?? (x.categoryId === null ? <Tag className="size-3.5" /> : <Ellipsis className="size-3.5" />)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{x.name}</span>
                  <Money amount={x.amount} decimals={false} className="text-[15px]" />
                  <span className="w-9 text-end text-xs text-muted-foreground tabular-nums">{percent(x.amount, total)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
