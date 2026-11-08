// One transaction line: category bubble, bank text, chips, category picker,
// account and amount. Rows that do not count are muted with a reason chip;
// ignored rows are greyed with the amount struck through. Rows with a
// question for the user (card bill, gone) carry a strip below. The left
// gutter selects; right click or "..." opens the row menu.

import { ArrowLeftRight, Check, ChevronDown, CircleDashed, Clock, EyeOff, WandSparkles } from "lucide-react";
import type { Account, Category, TransactionRow as Row } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { colorOf, type CategoryIndex } from "@/lib/categories";
import { awaitingShekels, formatForeign } from "@/lib/format";
import { isGone, isPossibleCardBill, type InternalChoice } from "@/lib/review";
import { ruleChipId } from "@/lib/review-rows";
import { useRules } from "@/lib/hooks";
import { Hint } from "@/components/ui/tooltip";
import { useRuleEditor } from "@/components/rules/rule-editor-provider";
import { Money } from "@/components/common/money";
import { AccountChip, CategoryBubble, IconBubble } from "@/components/common/chips";
import { CategoryPicker } from "./category-picker";
import { CardBillPrompt, GonePrompt, InternalMenu } from "./review-prompt";
import { RowContextMenu, RowMenuButton, type RowMenuModel } from "./row-menu";

export interface RowReview {
  /** The Needs review view is showing, where gone rows ask delete or keep. */
  reviewing: boolean;
  /** The user chose to keep this gone row for now. */
  kept: boolean;
  /** A call for this row is on its way. */
  busy: boolean;
  onAnswer: (row: Row, internal: InternalChoice) => void;
  onDelete: (row: Row) => void;
  onKeep: (row: Row) => void;
}

export function TransactionRow({
  row,
  account,
  index,
  selected,
  selecting,
  onToggle,
  onCategory,
  review,
  menu,
  menuOpen,
}: {
  row: Row;
  account: Account | undefined;
  index: CategoryIndex;
  selected: boolean;
  /** Some row is selected, so every checkbox shows. */
  selecting: boolean;
  onToggle: (id: number, range: boolean) => void;
  onCategory: (row: Row, category: Category | null) => void;
  review: RowReview;
  /** The row menu's entries, built when it opens. */
  menu: () => RowMenuModel;
  /** Demo screenshots: open the "..." menu at once. */
  menuOpen?: boolean;
}) {
  const category = row.categoryId != null ? index.byId.get(row.categoryId) : undefined;
  const gone = isGone(row);
  const counted = row.flow !== "internal" && row.flow !== "excluded" && !gone;
  const moneyIn = row.amount > 0;
  const askCardBill = isPossibleCardBill(row);
  const askGone = gone && review.reviewing && !review.kept;
  const abroad = awaitingShekels(row);
  const ignored = row.flow === "excluded";
  const chipRule = ruleChipId(row);

  return (
    <RowContextMenu menu={menu}>
      <div
        className={cn(
          "group relative border-t border-border/70 transition-colors hover:bg-accent/35",
          selected && "bg-primary/[0.07] hover:bg-primary/10",
        )}
      >
        <div className="flex h-16 items-center gap-4 pe-3">
          {/* The whole gutter selects (shift for a range). The bubble turns into
              a checkbox on hover, and stays one while selecting. */}
          <button
            type="button"
            role="checkbox"
            aria-checked={selected}
            aria-label={s.transactions.select}
            onMouseDown={(e) => e.shiftKey && e.preventDefault()}
            onClick={(e) => onToggle(row.id, e.shiftKey)}
            className="group/gutter relative flex h-16 w-[62px] shrink-0 items-center ps-6 outline-none select-none"
          >
            <span
              className={cn(
                "block transition-opacity",
                selecting || selected ? "opacity-0" : "group-hover:opacity-0 group-has-focus-visible:opacity-0",
              )}
            >
              {counted ? (
                <CategoryBubble category={category} size={38} />
              ) : (
                <IconBubble
                  icon={gone ? CircleDashed : row.flow === "internal" ? ArrowLeftRight : EyeOff}
                  size={38}
                  className={cn(ignored && "opacity-60")}
                />
              )}
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
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/30 bg-card group-hover/gutter:border-foreground/60",
                )}
              >
                {selected && <Check className="size-3.5" strokeWidth={3} />}
              </span>
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span
                dir="auto"
                className={cn("truncate text-[15px] font-medium", !counted && "text-muted-foreground", ignored && "text-muted-foreground/80")}
              >
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
              {gone && (
                <Hint label={s.review.goneHint}>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    <CircleDashed className="size-3" strokeWidth={2.25} />
                    {s.review.goneChip}
                  </span>
                </Hint>
              )}
              {row.installment && (
                <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground tabular-nums">
                  {s.transactions.installment(row.installment.number, row.installment.total)}
                </span>
              )}
              {chipRule !== null && <RuleChip ruleId={chipRule} />}
            </div>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {row.memo && (
                <span dir="auto" className="truncate">
                  {row.memo}
                </span>
              )}
              {row.originalAmount != null && row.originalCurrency && !abroad && (
                <>
                  {row.memo && <span>·</span>}
                  <span className="shrink-0">{s.transactions.foreign(formatForeign(row.originalAmount, row.originalCurrency))}</span>
                </>
              )}
            </div>
          </div>

          <div className="w-36 shrink-0 xl:w-44">
            {row.flow === "internal" ? (
              <InternalMenu row={row} busy={review.busy} onAnswer={(internal) => review.onAnswer(row, internal)} />
            ) : gone ? (
              <span className="block truncate px-3 text-sm text-muted-foreground">{s.review.goneColumn}</span>
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
            {abroad ? (
              <>
                <span className="num text-[17px] leading-none whitespace-nowrap text-foreground" dir="ltr">
                  {row.originalAmount > 0 && "+"}
                  {formatForeign(row.originalAmount, row.originalCurrency)}
                </span>
                <Hint label={s.transactions.awaitingShekelsHint} side="left">
                  <span className="text-end text-[11px] leading-tight text-balance text-muted-foreground">
                    {s.transactions.awaitingShekels}
                  </span>
                </Hint>
              </>
            ) : (
              <>
                <Money
                  amount={moneyIn ? row.amount : -row.amount}
                  sign={moneyIn}
                  className={cn(
                    "text-[17px] leading-none",
                    !counted ? "text-muted-foreground/70" : moneyIn ? "text-status-on-track" : "text-foreground",
                    ignored && "line-through decoration-muted-foreground/60 decoration-1",
                  )}
                />
                <Reason row={row} />
              </>
            )}
          </div>

          <RowMenuButton key={String(menuOpen)} menu={menu} defaultOpen={menuOpen} />
        </div>

        {(askCardBill || askGone) && (
          <div className="ps-[78px] pe-6 pb-3">
            {askCardBill ? (
              <CardBillPrompt row={row} busy={review.busy} onAnswer={(internal) => review.onAnswer(row, internal)} />
            ) : (
              <GonePrompt busy={review.busy} onDelete={() => review.onDelete(row)} onKeep={() => review.onKeep(row)} />
            )}
          </div>
        )}
      </div>
    </RowContextMenu>
  );
}

/** The rule that sorted this row; a click opens it in the editor. */
function RuleChip({ ruleId }: { ruleId: number }) {
  const rules = useRules();
  const { openEditor } = useRuleEditor();
  const rule = rules.data?.find((r) => r.id === ruleId);
  return (
    <Hint label={rule ? s.rules.chip.hint(rule.name) : s.rules.chip.unknown}>
      <button
        type="button"
        disabled={!rule}
        onClick={() => rule && openEditor({ rule })}
        className="inline-flex max-w-40 shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-foreground/75 transition-colors outline-none hover:bg-primary/18 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <WandSparkles className="size-3 shrink-0 text-primary" strokeWidth={2.25} />
        <span dir="auto" className="truncate">
          {rule?.name ?? s.rules.chip.fallback}
        </span>
      </button>
    </Hint>
  );
}

function Reason({ row }: { row: Row }) {
  const r = s.transactions.reason;
  if (row.flow === "internal") return <ReasonChip label={r.internal} hint={r.internalHint} />;
  if (row.flow === "excluded") return <ReasonChip label={r.excluded} hint={r.excludedHint} />;
  if (isPossibleCardBill(row)) return <ReasonChip label={r.possibleCardBill} hint={r.possibleCardBillHint} warn />;
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
