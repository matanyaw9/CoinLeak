// "This rule will also change 4 transactions you categorized by hand" (F45):
// the rows the rule matches that the user put in another category, listed
// before saving. Saving always hands them to the rule; there is no tick box.

import type { TransactionRow } from "@shared/types";
import { s } from "@/strings";
import type { CategoryIndex } from "@/lib/categories";
import { formatDayShort } from "@/lib/format";
import { CategoryBubble } from "@/components/common/chips";
import { Money } from "@/components/common/money";

const SHOWN = 6;

/** The ids a save sends as `alsoChange`: every listed row, never a subset. */
export function handSetIds(rows: TransactionRow[]): number[] {
  return rows.map((row) => row.id);
}

export function HandSetList({ rows, index }: { rows: TransactionRow[]; index: CategoryIndex }) {
  const h = s.rulesV2.handSet;
  if (rows.length === 0) return null;
  return (
    <div data-hand-set className="rounded-2xl border border-status-heads-up/45 bg-status-heads-up/[0.08] px-4 py-3.5">
      <p className="text-sm font-medium">{h.willChange(rows.length)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{h.hint}</p>
      <ul className="mt-2.5 space-y-0.5">
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
      {rows.length > SHOWN && <p className="mt-1 text-xs text-muted-foreground">{h.more(rows.length - SHOWN)}</p>}
    </div>
  );
}
