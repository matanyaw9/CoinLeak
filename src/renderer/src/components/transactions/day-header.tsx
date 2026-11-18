// The Transactions list's day header: the day's select-all box (spec 20),
// its date, and core's totals for it. Also the select-all box itself, which
// the list's top bar uses too.

import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { formatDayLong } from "@/lib/format";
import type { DayGroup } from "@/lib/day-groups";
import { Checkbox } from "@/components/ui/misc";
import { Money } from "@/components/common/money";
import { checkState, checkedProp, type CheckState } from "./selection";

export function DayHeader({
  group,
  selected,
  onToggle,
}: {
  group: DayGroup;
  selected: ReadonlySet<number>;
  onToggle: (ids: number[]) => void;
}) {
  const ids = group.rows.map((r) => r.id);
  const day = formatDayLong(group.date);
  return (
    <div className="group/day flex items-center justify-between border-t border-border bg-secondary/45 pe-6">
      <span className="flex items-center gap-1">
        <SelectBox
          state={checkState(ids, selected)}
          label={s.selectAll.day(day)}
          onToggle={() => onToggle(ids)}
          className="h-10"
          quiet={selected.size === 0}
        />
        <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{day}</span>
      </span>
      <span className="flex items-center gap-3 text-xs text-muted-foreground">
        {group.income > 0 && <Money amount={group.income} sign className="text-[13px] text-status-on-track" />}
        {group.spent > 0 && (
          <span>
            <Money amount={group.spent} className="text-[13px] text-foreground/80" /> {s.transactions.daySpent}
          </span>
        )}
        {group.spent < 0 && (
          <span>
            <Money amount={-group.spent} sign className="text-[13px] text-status-on-track" /> {s.transactions.dayBack}
          </span>
        )}
      </span>
    </div>
  );
}

/**
 * A select-all box, above the list and on each day. It sits in the rows'
 * gutter so it lines up with their checkboxes. `quiet` hides it until the
 * day is hovered, like the rows' boxes before anything is selected.
 */
export function SelectBox({
  state,
  label,
  onToggle,
  className,
  quiet,
}: {
  state: CheckState;
  label: string;
  onToggle: () => void;
  className?: string;
  quiet?: boolean;
}) {
  return (
    <span className={cn("flex w-[62px] shrink-0 items-center justify-center ps-6", className)}>
      <Checkbox
        checked={checkedProp(state)}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          "size-5 rounded-[6px] border-[1.5px] [&_svg]:size-3.5",
          quiet && state === "none" && "opacity-0 group-hover/day:opacity-100 focus-visible:opacity-100",
        )}
      />
    </span>
  );
}
