// The one tooltip every chart uses: a title, colored rows with amounts, and
// an optional hint line. Charts map their hovered point to these props.

import type { ReactNode } from "react";
import type { Agorot } from "@shared/types";
import { cn } from "@/lib/utils";
import { Money } from "@/components/common/money";

export interface TooltipRow {
  key: string;
  label: ReactNode;
  amount: Agorot;
  color?: string;
  /** Draw the swatch as a dashed line (for comparison series). */
  dashed?: boolean;
  /** Extra text after the amount, e.g. a share. */
  note?: string;
  strong?: boolean;
}

// Chart animations run on animation frames, which a window in the
// background (or the hidden screenshot run) stops getting, leaving charts
// blank. Charts appear at once instead; calm beats flashy here.
export function chartAnimation(): { isAnimationActive: false } {
  return { isAnimationActive: false };
}

export function ChartTooltip({ title, rows, hint }: { title: ReactNode; rows: TooltipRow[]; hint?: ReactNode }) {
  return (
    <div className="min-w-48 rounded-2xl border border-border bg-popover px-4 py-3 text-popover-foreground shadow-lg shadow-black/5 dark:shadow-black/30">
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2.5 text-sm">
            {r.color &&
              (r.dashed ? (
                <span className="w-3 shrink-0 border-t-2 border-dashed" style={{ borderColor: r.color }} />
              ) : (
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
              ))}
            <span className={cn("min-w-0 flex-1 truncate", !r.strong && "text-muted-foreground")}>{r.label}</span>
            <Money amount={r.amount} decimals={false} className={cn("ms-4", r.strong && "font-medium")} />
            {r.note && <span className="w-9 text-end text-xs text-muted-foreground tabular-nums">{r.note}</span>}
          </div>
        ))}
      </div>
      {hint && <div className="mt-2.5 border-t border-border pt-2 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}
