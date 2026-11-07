// One transaction line: category bubble, bank text, chips, category picker,
// account and amount. Rows that do not count are muted with a reason chip.

import { ArrowLeftRight, ChevronDown, Clock, EyeOff } from "lucide-react";
import type { Account, Category, TransactionRow as Row } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { colorOf, type CategoryIndex } from "@/lib/categories";
import { formatForeign } from "@/lib/format";
import { Checkbox } from "@/components/ui/misc";
import { Hint } from "@/components/ui/tooltip";
import { Money } from "@/components/common/money";
import { AccountChip, CategoryBubble, IconBubble } from "@/components/common/chips";
import { CategoryPicker } from "./category-picker";

export function TransactionRow({
  row,
  account,
  index,
  selected,
  selecting,
  onToggle,
  onCategory,
}: {
  row: Row;
  account: Account | undefined;
  index: CategoryIndex;
  selected: boolean;
  /** Some row is selected, so every checkbox shows. */
  selecting: boolean;
  onToggle: (id: number, range: boolean) => void;
  onCategory: (row: Row, category: Category | null) => void;
}) {
  const category = row.categoryId != null ? index.byId.get(row.categoryId) : undefined;
  const counted = row.flow !== "internal" && row.flow !== "excluded";
  const moneyIn = row.amount > 0;

  return (
    <div
      className={cn(
        "group relative flex h-16 items-center gap-4 border-t border-border/70 ps-6 pe-6 transition-colors hover:bg-accent/35",
        selected && "bg-primary/[0.07] hover:bg-primary/10",
      )}
    >
      {/* The bubble turns into a checkbox on hover, and stays one while selecting. */}
      <div className="relative size-[38px] shrink-0">
        <div
          className={cn(
            "transition-opacity",
            selecting || selected ? "opacity-0" : "group-hover:opacity-0 group-has-focus-visible:opacity-0",
          )}
        >
          {counted ? (
            <CategoryBubble category={category} size={38} />
          ) : (
            <IconBubble icon={row.flow === "internal" ? ArrowLeftRight : EyeOff} size={38} />
          )}
        </div>
        <span
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full transition-opacity",
            selecting || selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-has-focus-visible:opacity-100",
          )}
        >
          <Checkbox
            checked={selected}
            aria-label={s.transactions.select}
            onClick={(e) => onToggle(row.id, e.shiftKey)}
            className="size-[18px]"
          />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span dir="auto" className={cn("truncate text-[15px] font-medium", !counted && "text-muted-foreground")}>
            {row.description}
          </span>
          {row.status === "pending" && (
            <Hint label={s.transactions.pendingHint}>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-heads-up/14 px-2 py-0.5 text-[11px] font-medium text-foreground/75">
                <Clock className="size-3 text-status-heads-up" strokeWidth={2.25} />
                {s.transactions.pending}
              </span>
            </Hint>
          )}
          {row.installment && (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
              {s.transactions.installment(row.installment.number, row.installment.total)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {row.memo && (
            <span dir="auto" className="truncate">
              {row.memo}
            </span>
          )}
          {row.memo && row.originalCurrency && <span>·</span>}
          {row.originalAmount != null && row.originalCurrency && (
            <span className="shrink-0">{s.transactions.foreign(formatForeign(row.originalAmount, row.originalCurrency))}</span>
          )}
        </div>
      </div>

      <div className="w-36 shrink-0 xl:w-44">
        {row.flow === "internal" ? (
          <span className="block truncate px-3 text-sm text-muted-foreground">{s.transactions.reason.internalColumn}</span>
        ) : (
          <CategoryPicker
            index={index}
            value={row.categoryId}
            preferKind={moneyIn ? "income" : "expense"}
            onSelect={(c) => onCategory(row, c)}
            triggerClassName={cn(
              "group/pick inline-flex h-8 max-w-full items-center gap-2 rounded-full px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              category
                ? "text-foreground/85 hover:bg-accent"
                : "border border-dashed border-status-heads-up/60 bg-status-heads-up/8 text-foreground/80 hover:bg-status-heads-up/15",
            )}
          >
            {category && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(category) }} />}
            <span className="truncate">{category ? category.name : s.transactions.chooseCategory}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/pick:opacity-100" />
          </CategoryPicker>
        )}
      </div>

      <div className="hidden w-32 shrink-0 lg:block">
        <AccountChip account={account} />
      </div>

      <div className="flex w-28 shrink-0 flex-col items-end justify-center gap-1 xl:w-36">
        <Money
          amount={moneyIn ? row.amount : -row.amount}
          sign={moneyIn}
          className={cn(
            "text-[17px] leading-none",
            !counted ? "text-muted-foreground/70" : moneyIn ? "text-status-on-track" : "text-foreground",
          )}
        />
        <Reason row={row} />
      </div>
    </div>
  );
}

function Reason({ row }: { row: Row }) {
  const r = s.transactions.reason;
  if (row.flow === "internal") return <ReasonChip label={r.internal} hint={r.internalHint} />;
  if (row.flow === "excluded") return <ReasonChip label={r.excluded} hint={r.excludedHint} />;
  if (row.flags.includes("possible_card_bill")) return <ReasonChip label={r.possibleCardBill} hint={r.possibleCardBillHint} warn />;
  if (row.flow === "refund") return <span className="text-[11px] text-status-on-track">{r.refund}</span>;
  return null;
}

function ReasonChip({ label, hint, warn }: { label: string; hint: string; warn?: boolean }) {
  return (
    <Hint label={hint} side="left">
      <span
        className={cn(
          "rounded-full px-2 py-px text-[11px] leading-4 font-medium",
          warn ? "bg-status-heads-up/16 text-foreground/80" : "bg-secondary text-muted-foreground",
        )}
      >
        {label}
      </span>
    </Hint>
  );
}
