// Spending by top-level category as a donut with a clickable legend.
// Clicking a slice or a row opens the matching transactions.

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Ellipsis, Tag } from "lucide-react";
import type { MonthSummary } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { groupByRoot, topSlices, type CategoryIndex, type Slice } from "@/lib/categories";
import { percent } from "@/lib/format";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { chartAnimation, ChartTooltip } from "@/components/charts/chart-tooltip";

export function CategoryDonutCard({
  summary,
  index,
  onOpen,
}: {
  summary: MonthSummary;
  index: CategoryIndex;
  onOpen: (slice: Slice) => void;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const slices = topSlices(groupByRoot(index, summary.byCategory), 7);
  const total = summary.spending;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader label={s.home.donutTitle} />
      {slices.length === 0 ? (
        <EmptyState compact title={s.home.donutEmpty} className="flex-1" />
      ) : (
        <div className="flex flex-1 flex-col gap-5">
          <div className="relative mx-auto size-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius="70%"
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
                      opacity={hover && hover !== x.key ? 0.35 : 1}
                      className="outline-none transition-opacity"
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    const x = payload?.[0]?.payload as Slice | undefined;
                    if (!active || !x) return null;
                    return (
                      <ChartTooltip
                        title={x.name}
                        rows={[{ key: x.key, label: s.home.donutCenter, amount: x.amount, color: x.color, note: percent(x.amount, total), strong: true }]}
                      />
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <Money amount={total} decimals={false} className="text-2xl tracking-tight" />
              <span className="mt-0.5 text-xs text-muted-foreground">{s.home.donutCenter}</span>
            </div>
          </div>

          <ul className="-mx-2 space-y-0.5">
            {slices.map((x) => (
              <li key={x.key}>
                <button
                  type="button"
                  onClick={() => onOpen(x)}
                  onMouseEnter={() => setHover(x.key)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-start text-sm transition-colors hover:bg-accent/60",
                    hover && hover !== x.key && "opacity-60",
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
