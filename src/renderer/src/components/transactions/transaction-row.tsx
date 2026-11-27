// One transaction line: category bubble, bank text, chips, category picker,
// account and amount. Rows that do not count are muted with a reason chip;
// ignored rows are greyed with the amount struck through. Rows with a
// question for the user (card bill, gone) carry a strip below. The left
// gutter selects; right click or "..." opens the row menu. Spec 17: the
// category chip filters and explains itself (category-cell.tsx). Spec 20:
// the note under the description and its button, cash rows and withdrawals
// moved into the cash wallet. Spec 31: Shift+click and Ctrl+click on the row.
// Spec 36: the gutter box is the row's one Tab stop in the list; arrow keys
// move between rows (lib/roving.ts), Space selects, the menu key opens the menu.

import { useState } from "react";
import { ArrowLeftRight, Check, CircleDashed, Clock, EyeOff, StickyNote, Wallet, WandSparkles } from "lucide-react";
import type { Account, Category, TransactionRow as Row } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { type CategoryIndex } from "@/lib/categories";
import { awaitingShekels, formatDayShort, formatForeign } from "@/lib/format";
import { isGone, isPossibleCardBill, type InternalChoice } from "@/lib/review";
import { ruleChipId } from "@/lib/review-rows";
import { useRules } from "@/lib/hooks";
import { isMac, isMenuKey } from "@/lib/shortcuts";
import type { RovingItem } from "@/lib/roving";
import { Hint } from "@/components/ui/tooltip";
import { useRuleEditor } from "@/components/rules/rule-editor-provider";
import { Money } from "@/components/common/money";
import { AccountChip, CategoryBubble, IconBubble } from "@/components/common/chips";
import { CategoryCell } from "./category-cell";
import { CardBillPrompt, GonePrompt, InternalMenu } from "./review-prompt";
import { NoteButton } from "./note-editor";
import { RowContextMenu, RowMenuButton, type RowMenuModel } from "./row-menu";
import { rowClickKind } from "./selection";

/** Parts of a row that keep their own click: the box, chips, pickers, the note and menu buttons. */
const ROW_CONTROLS = 'button, a, input, textarea, select, label, [role="button"], [role="checkbox"], [role="combobox"]';

/**
 * Spec 36: the look of the row keyboard focus is on (its gutter box, the
 * row's Tab stop). A screenshot run's hidden window never has focus, so
 * `data-shot-focus` on the row shows the same look there. Trash rows too.
 */
export const ROW_FOCUS =
  "[&:is(:has([data-row-focus]:focus-visible),[data-shot-focus])]:bg-accent/50 [&:is(:has([data-row-focus]:focus-visible),[data-shot-focus])]:ring-2 [&:is(:has([data-row-focus]:focus-visible),[data-shot-focus])]:ring-ring/60 [&:is(:has([data-row-focus]:focus-visible),[data-shot-focus])]:ring-inset";

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
  onFilterCategory,
  showDate,
  hintOpen,
  noteOpen,
  onNoteOpenChange,
  roving,
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
  /** spec 17: a click on the category chip shows only that category. */
  onFilterCategory?: (categoryId: number) => void;
  /** spec 17: the list is not grouped by day, so the row says its date. */
  showDate?: boolean;
  /** Demo screenshots: show the category hover card at once. */
  hintOpen?: boolean;
  /** spec 20: the note box is open (from its button or the row menu). */
  noteOpen?: boolean;
  onNoteOpenChange?: (open: boolean) => void;
  /** spec 36: the row's place in the list's one Tab stop and its arrow keys. */
  roving: RovingItem;
}) {
  // spec 36: null until the "..." menu is opened or closed; the demo flag opens it at first.
  const [menuState, setMenuState] = useState<boolean | null>(null);
  // Destructured: React's lint reads `roving.ref` as a ref and then flags the rest.
  const { ref: focusRef, tabIndex, onFocus, onBlur, onKeyDown: listKeys } = roving;
  const category = row.categoryId != null ? index.byId.get(row.categoryId) : undefined;
  const gone = isGone(row);
  const counted = row.flow !== "internal" && row.flow !== "excluded" && !gone;
  const moneyIn = row.amount > 0;
  const askCardBill = isPossibleCardBill(row);
  const askGone = gone && review.reviewing && !review.kept;
  const abroad = awaitingShekels(row);
  const ignored = row.flow === "excluded";
  const chipRule = ruleChipId(row);

  // spec 31: Shift+click and Ctrl+click (Cmd on a Mac) on the row itself select,
  // except on its buttons, links and pickers, or inside a picker opened from it.
  const selectClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element;
    if (!e.currentTarget.contains(target) || target.closest(ROW_CONTROLS)) return null;
    return rowClickKind(e, isMac());
  };

  // spec 36: the menu key or Shift+F10 anywhere in the row opens its "..." menu.
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (isMenuKey(e) && e.currentTarget.contains(e.target as Node)) {
      e.preventDefault();
      setMenuState(true);
    } else listKeys(e);
  };

  return (
    <RowContextMenu menu={menu}>
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
          "group relative border-t border-border/70 transition-colors hover:bg-accent/35",
          selected && "bg-primary/[0.07] hover:bg-primary/10",
          ROW_FOCUS,
        )}
      >
        <div className="flex h-16 items-center gap-4 pe-3">
          {/* The whole gutter selects (shift for a range). The bubble turns into
              a checkbox on hover, and stays one while selecting. Spec 36: it
              is the row's Tab stop, and Space on it selects. The scroll
              margins keep a row reached by arrow keys clear of the sticky
              header and the bulk bar. */}
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
            className="group/gutter relative flex h-16 w-[62px] shrink-0 scroll-mt-40 scroll-mb-24 items-center ps-6 outline-none select-none"
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
                  icon={gone ? CircleDashed : row.movedToCash ? Wallet : row.flow === "internal" ? ArrowLeftRight : EyeOff}
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
              {showDate && (
                <>
                  <span className="shrink-0 tabular-nums">{formatDayShort(row.date)}</span>
                  {(row.note || row.memo || (row.originalAmount != null && row.originalCurrency && !abroad)) && <span>·</span>}
                </>
              )}
              {row.note && (
                <>
                  <span className="flex min-w-0 shrink items-center gap-1 text-foreground/65">
                    <StickyNote className="size-3 shrink-0" strokeWidth={2} />
                    <span dir="auto" className="truncate">
                      {row.note}
                    </span>
                  </span>
                  {(row.memo || (row.originalAmount != null && row.originalCurrency && !abroad)) && <span>·</span>}
                </>
              )}
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
              <CategoryCell
                row={row}
                category={category}
                index={index}
                onCategory={(c) => onCategory(row, c)}
                onFilter={onFilterCategory}
                hintOpen={hintOpen}
              />
            )}
          </div>

          <div className="hidden w-32 shrink-0 lg:block">
            {row.source === "manual" ? <CashChip /> : <AccountChip account={account} />}
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

          <NoteButton row={row} open={noteOpen ?? false} onOpenChange={(open) => onNoteOpenChange?.(open)} />
          <RowMenuButton menu={menu} open={menuState ?? Boolean(menuOpen)} onOpenChange={setMenuState} />
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

/** spec 20: in the account column for rows typed into the cash wallet. */
function CashChip() {
  return (
    <span
      title={s.cash.chipTitle}
      className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-secondary/70 py-0.5 ps-1 pe-2 text-xs text-secondary-foreground/80"
    >
      <span className="flex size-4 items-center justify-center rounded-full bg-status-on-track/20 text-status-on-track">
        <Wallet className="size-2.5" strokeWidth={2.5} />
      </span>
      <span className="truncate">{s.cash.chip}</span>
    </span>
  );
}

function Reason({ row }: { row: Row }) {
  const r = s.transactions.reason;
  if (row.movedToCash) return <ReasonChip label={s.cash.movedChip} hint={s.cash.movedHint} />;
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
