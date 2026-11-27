// Spending by top-level category as a donut with a clickable list, drawn
// from core's lists (spec 44). The ring holds the groups with spending, small
// ones folded into "Other"; the list shows every group, one whose refunds
// beat its spending as money back, so it adds up to the total in the middle.
// Pointing at a slice or a name shows it there, so nothing ever covers the
// slice (spec 16).

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Ellipsis, Tag } from "lucide-react";
import type { Agorot, PeriodSummary } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { groupKey, groupSlice, otherSlice, type CategoryIndex, type Slice } from "@/lib/categories";
import { percent } from "@/lib/format";
import { useShot } from "@/lib/shot";
import { Card, CardHeader } from "@/components/common/card";
import { EmptyState } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { chartAnimation } from "@/components/charts/chart-tooltip";
import type { PeriodWords } from "./period-words";

/** An amount below zero, said as money back: "₪300 back" (spec 44). */
export function MoneyBack({ amount, className }: { amount: Agorot; className?: string }) {
  return (
    <span className={cn("whitespace-nowrap text-status-on-track", className)}>
      <Money amount={-amount} decimals={false} /> {s.moneyBack.word}
    </span>
  );
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
  const { donut, spending: total } = summary;
  const all = donut.groups.map((g) => groupSlice(index, g));
  const slices = donut.ring.map((g) => groupSlice(index, g));
  if (donut.other) slices.push(otherSlice(donut.other.amount));
  const otherKeys = donut.other?.categoryIds.map(groupKey) ?? [];
  const shot = useShot();
  // Demo screenshots: `?shot=donut-hover` points at the second slice.
  const [hover, setHover] = useState<string | null>(shot === "donut-hover" ? (slices[1]?.key ?? null) : null);

  // A hovered list row lights its chart slice, which may be "Other".
  const litSlice = hover && otherKeys.includes(hover) ? "other" : hover;
  const litRows = new Set(hover === "other" ? otherKeys : hover ? [hover] : []);
  const focus = hover ? (slices.find((x) => x.key === hover) ?? all.find((x) => x.key === hover)) : undefined;
  // Shares are of what the ring draws; money back has none.
  const share = (amount: Agorot) => (amount < 0 ? "" : percent(amount, donut.ringTotal));

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
                    <span className="truncate">{focus.key === "other" ? s.periodHome.donutOther(otherKeys.length) : focus.name}</span>
                  </span>
                  {focus.amount < 0 ? (
                    <MoneyBack amount={focus.amount} className="mt-1 text-xl tracking-tight" />
                  ) : (
                    <Money amount={focus.amount} decimals={false} className="mt-1 text-xl tracking-tight" />
                  )}
                  <span className="mt-0.5 text-xs text-muted-foreground tabular-nums">{share(focus.amount)}</span>
                </>
              ) : total < 0 ? (
                <MoneyBack amount={total} className="text-2xl tracking-tight" />
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
                  {x.amount < 0 ? (
                    <MoneyBack amount={x.amount} className="text-[15px]" />
                  ) : (
                    <Money amount={x.amount} decimals={false} className="text-[15px]" />
                  )}
                  <span className="w-9 text-end text-xs text-muted-foreground tabular-nums">{share(x.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
