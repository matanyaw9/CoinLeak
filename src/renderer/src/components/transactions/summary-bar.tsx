// Income, Spent and Left for the shown month at the top of Transactions
// (spec 17, F22). The same numbers and words as the Home hero, from core.

import type { MonthSummary } from "@shared/types";
import { s } from "@/strings";
import { Money } from "@/components/common/money";
import { Skeleton } from "@/components/ui/misc";

export function SummaryBar({ summary, current }: { summary: MonthSummary | undefined; current: boolean }) {
  if (!summary) return <Skeleton className="mb-4 h-[76px] w-full rounded-3xl" />;
  const left = summary.income - summary.spending;
  return (
    <div className="mb-4 grid grid-cols-3 divide-x divide-border rounded-3xl border border-border bg-card py-4 rtl:divide-x-reverse">
      <Stat label={s.home.income}>
        <Money amount={summary.income} className="text-status-on-track" />
      </Stat>
      <Stat label={s.home.spent}>
        <Money amount={summary.spending} />
      </Stat>
      <Stat label={current ? s.home.leftSoFar : s.home.left} hint={left < 0 ? s.home.overspent : undefined}>
        <Money amount={left} className={left < 0 ? "text-status-over" : "text-foreground"} />
      </Stat>
    </div>
  );
}

function Stat({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-6">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{label}</span>
        {hint && <span className="truncate text-xs text-status-over">{hint}</span>}
      </div>
      <div className="mt-1.5 text-[22px] leading-none tracking-tight">{children}</div>
    </div>
  );
}
