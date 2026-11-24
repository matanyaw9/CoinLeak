// The Transactions column headers (spec 31, F80): Date, Description,
// Category and Amount, lined up with the row columns. Date, Description and
// Amount sort the list; a second click flips the order. Sizes match
// transaction-row.tsx.

import { ArrowDown, ArrowUp } from "lucide-react";
import type { TransactionSort } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { Hint } from "@/components/ui/tooltip";
import { clickColumn, columnOf, sortArrow, type SortColumn } from "./list-view";

const LABEL = "text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase";

function SortButton({
  column,
  label,
  sort,
  onSort,
  className,
}: {
  column: SortColumn;
  label: string;
  sort: TransactionSort;
  onSort: (sort: TransactionSort) => void;
  className?: string;
}) {
  const active = columnOf(sort) === column;
  const next = clickColumn(sort, column);
  const Arrow = sortArrow(sort) === "down" ? ArrowDown : ArrowUp;
  return (
    <Hint label={s.listHeader.sortBy(s.listHeader.order[next] ?? next)}>
      <button
        type="button"
        onClick={() => onSort(next)}
        aria-label={active ? `${label}, ${s.listHeader.order[sort] ?? sort}` : label}
        className={cn(
          LABEL,
          "-mx-1.5 inline-flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
          active && "text-foreground",
          className,
        )}
      >
        {label}
        {active && <Arrow className="size-3" strokeWidth={2.5} />}
      </button>
    </Hint>
  );
}

export function ListHeader({ sort, onSort }: { sort: TransactionSort; onSort: (sort: TransactionSort) => void }) {
  const h = s.listHeader;
  return (
    <div className="flex h-9 items-center gap-4 border-t border-border pe-3">
      {/* The rows' gutter (box and bubble), then their columns. */}
      <span className="w-[62px] shrink-0" />
      <div className="flex min-w-0 flex-1 items-center gap-5">
        <SortButton column="date" label={h.date} sort={sort} onSort={onSort} />
        <SortButton column="name" label={h.description} sort={sort} onSort={onSort} />
      </div>
      <span className={cn(LABEL, "w-36 shrink-0 px-3 xl:w-44")}>{h.category}</span>
      <span className="hidden w-32 shrink-0 lg:block" />
      <div className="flex w-28 shrink-0 justify-end xl:w-36">
        <SortButton column="amount" label={h.amount} sort={sort} onSort={onSort} />
      </div>
      {/* The note and menu buttons. */}
      <span className="w-20 shrink-0" />
    </div>
  );
}
