// One row in Trash: a checkbox gutter, the bank text, its date and account,
// the amount muted, and Restore. Spec 36: selects like a Transactions row
// (Shift+click and Ctrl+click on the row, Space on its box, arrow keys
// between rows); the gutter box is the row's one Tab stop.

import { Check, RotateCcw, Trash2 } from "lucide-react";
import type { Account, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { formatDayShort } from "@/lib/format";
import type { RovingItem } from "@/lib/roving";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/common/money";
import { AccountChip, IconBubble } from "@/components/common/chips";
import { rowClickKind } from "@/components/transactions/selection";
import { ROW_FOCUS } from "@/components/transactions/transaction-row";
import { isMac } from "@/components/transactions/find";

export function TrashRow({
  row,
  account,
  selected,
  selecting,
  busy,
  onToggle,
  onRestore,
  roving,
}: {
  row: TransactionRow;
  account: Account | undefined;
  selected: boolean;
  selecting: boolean;
  busy: boolean;
  onToggle: (id: number, range: boolean) => void;
  onRestore: () => void;
  roving: RovingItem;
}) {
  // Destructured: React's lint reads `roving.ref` as a ref and then flags the rest.
  const { ref: focusRef, tabIndex, onFocus, onBlur, onKeyDown } = roving;
  const moneyIn = row.amount > 0;

  // Shift+click and Ctrl+click on the row itself; its box and Restore keep their own click.
  const selectClick = (e: React.MouseEvent<HTMLDivElement>) =>
    (e.target as Element).closest("button") ? null : rowClickKind(e, isMac());

  return (
    <div
      data-row-id={row.id}
      onMouseDown={(e) => {
        if (selectClick(e) === "range") e.preventDefault();
      }}
      onClick={(e) => {
        const kind = selectClick(e);
        if (kind) onToggle(row.id, kind === "range");
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={cn(
        "group flex h-16 items-center gap-4 border-t border-border/70 pe-6 transition-colors hover:bg-accent/35",
        selected && "bg-primary/[0.07] hover:bg-primary/10",
        ROW_FOCUS,
      )}
    >
      <button
        ref={focusRef}
        tabIndex={tabIndex}
        data-row-focus=""
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={s.transactions.select}
        onMouseDown={(e) => e.shiftKey && e.preventDefault()}
        onClick={(e) => onToggle(row.id, e.shiftKey)}
        className="group/gutter relative flex h-16 w-[62px] shrink-0 scroll-mt-20 scroll-mb-6 items-center ps-6 outline-none select-none"
      >
        <span className={cn("block transition-opacity", selecting || selected ? "opacity-0" : "group-hover:opacity-0 group-has-focus-visible:opacity-0")}>
          <IconBubble icon={Trash2} size={38} className="opacity-70" />
        </span>
        <span
          className={cn(
            "absolute start-6 top-1/2 flex size-[38px] -translate-y-1/2 items-center justify-center transition-opacity",
            selecting || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-has-focus-visible:opacity-100",
          )}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-[6px] border-[1.5px] transition-colors group-focus-visible/gutter:ring-2 group-focus-visible/gutter:ring-ring/50",
              selected ? "border-foreground bg-foreground text-background" : "border-foreground/30 bg-card group-hover/gutter:border-foreground/60",
            )}
          >
            {selected && <Check className="size-3.5" strokeWidth={3} />}
          </span>
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0">
          <span dir="auto" className="truncate text-[15px] font-medium text-foreground/80">
            {row.description}
          </span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0">{formatDayShort(row.date)}</span>
          {row.memo && (
            <>
              <span>·</span>
              <span dir="auto" className="truncate">
                {row.memo}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="hidden w-32 shrink-0 lg:block">
        <AccountChip account={account} />
      </div>

      <Money amount={moneyIn ? row.amount : -row.amount} sign={moneyIn} className="inline-block w-28 shrink-0 text-end text-[17px] text-muted-foreground" />

      <Button variant="outline" size="sm" className="shrink-0 rounded-full" disabled={busy} onClick={onRestore}>
        <RotateCcw className="size-3.5" />
        {s.trash.restore}
      </Button>
    </div>
  );
}
