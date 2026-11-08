// "Also change 4 transactions you categorized by hand?" (spec 13, F21): the
// rows the rule matches that the user put in another category, listed, with
// a box left unticked. Ticking hands exactly those rows to the rule, once.

import type { TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import type { CategoryIndex } from "@/lib/categories";
import { formatDayShort } from "@/lib/format";
import { Checkbox } from "@/components/ui/misc";
import { CategoryBubble } from "@/components/common/chips";
import { Money } from "@/components/common/money";

const SHOWN = 6;

export function HandSetPrompt({
  rows,
  ticked,
  onTick,
  index,
}: {
  rows: TransactionRow[];
  ticked: boolean;
  onTick: (ticked: boolean) => void;
  index: CategoryIndex;
}) {
  const h = s.rulesV2.handSet;
  return (
    <div
      data-hand-set
      className={cn(
        "rounded-2xl border px-4 py-3.5 transition-colors",
        ticked ? "border-primary/40 bg-primary/[0.06]" : "border-status-heads-up/45 bg-status-heads-up/[0.08]",
      )}
    >
      <label className="flex cursor-pointer items-start gap-3">
        <Checkbox className="mt-0.5" checked={ticked} onClick={() => onTick(!ticked)} aria-label={h.question(rows.length)} />
        <span>
          <span className="block text-sm font-medium">{h.question(rows.length)}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{h.hint}</span>
        </span>
      </label>
      <ul className="mt-2.5 space-y-0.5 ps-7">
        {rows.slice(0, SHOWN).map((row) => {
          const category = row.categoryId != null ? index.byId.get(row.categoryId) : undefined;
          return (
            <li key={row.id} className="flex items-center gap-2.5 py-1 text-[13px]">
              <CategoryBubble category={category} size={22} />
              <span dir="auto" className="min-w-0 flex-1 truncate text-left">
                {row.description}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDayShort(row.date)} · {category?.name ?? s.common.uncategorized}
              </span>
              <Money amount={Math.abs(row.amount)} sign={row.amount > 0} className="w-16 shrink-0 text-end text-[13px]" />
            </li>
          );
        })}
      </ul>
      {rows.length > SHOWN && <p className="mt-1 ps-7 text-xs text-muted-foreground">{h.more(rows.length - SHOWN)}</p>}
    </div>
  );
}
