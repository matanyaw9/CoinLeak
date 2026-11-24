// A row's category (spec 17): the chip filters the list to that category
// (F34), hovering it says who set it with a link to the rule (F32), and the
// pencil next to it opens the picker. No category: the picker button.
// Spec 33: a row paid back for a purchase names the purchase on hover.

import { useEffect, useRef, useState } from "react";
import { ChevronDown, HandCoins, Pencil, WandSparkles } from "lucide-react";
import type { Category, TransactionRow as Row } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { formatDayShort, ils } from "@/lib/format";
import { colorOf, type CategoryIndex } from "@/lib/categories";
import { useRules } from "@/lib/hooks";
import { useShot } from "@/lib/shot";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRuleEditor } from "@/components/rules/rule-editor-provider";
import { CategoryPicker } from "./category-picker";
import { categoryOrigin, originText } from "./origin";
import { useRowDialog } from "./row-menu";
import { isolated } from "./paid-back-dialog";
import { paidBackEntry } from "./row-menu-entries";

export function CategoryCell({
  row,
  category,
  index,
  onCategory,
  onFilter,
  hintOpen,
}: {
  row: Row;
  category: Category | undefined;
  index: CategoryIndex;
  onCategory: (category: Category | null) => void;
  onFilter?: (categoryId: number) => void;
  /** Demo screenshots: show the hover card at once. */
  hintOpen?: boolean;
}) {
  const rules = useRules();
  const { openEditor } = useRuleEditor();
  const { hint: shotHint, ref: shotRef } = usePaidBackShot(row);
  const picker = (children: React.ReactNode, className: string, label?: string) => (
    <CategoryPicker
      index={index}
      value={row.categoryId}
      preferKind={row.amount > 0 ? "income" : "expense"}
      onSelect={onCategory}
      triggerClassName={className}
    >
      {label ? <span className="sr-only">{label}</span> : null}
      {children}
    </CategoryPicker>
  );

  if (!category) {
    return picker(
      <>
        <span className="truncate">{s.transactions.chooseCategory}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/pick:opacity-100" />
      </>,
      "group/pick inline-flex h-8 max-w-full items-center gap-2 rounded-full border border-dashed border-status-heads-up/60 bg-status-heads-up/8 px-3 text-sm text-foreground/80 transition-colors outline-none hover:bg-status-heads-up/15 focus-visible:ring-2 focus-visible:ring-ring/50",
    );
  }

  const origin = categoryOrigin(row, rules.data);
  const rule = origin.kind === "rule" ? origin.rule : null;
  const paidBack = row.paidBackFor;
  const showHint = hintOpen || shotHint;
  return (
    <div ref={shotRef} className="flex min-w-0 items-center">
      <Tooltip key={String(showHint)} defaultOpen={showHint}>
        <TooltipTrigger
          render={
            <button
              type="button"
              onClick={() => onFilter?.(category.id)}
              className="inline-flex h-8 min-w-0 items-center gap-2 rounded-full px-3 text-sm text-foreground/85 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          }
        >
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(category) }} />
          <span className="truncate">{category.name}</span>
          {paidBack && <HandCoins className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />}
        </TooltipTrigger>
        {/* Hidden screenshot runs never advance animations; demo shots skip them. */}
        <TooltipContent side="top" className={cn(showHint && "!animate-none")}>
          {paidBack ? (
            <span className="flex items-center gap-1.5 font-medium">
              <HandCoins className="size-3 shrink-0" strokeWidth={2.25} />
              <span>
                {s.paidBack.tooltip(isolated(paidBack.description), formatDayShort(paidBack.date), ils(-paidBack.amount))}
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 font-medium">
              {origin.kind === "rule" && <WandSparkles className="size-3 shrink-0" strokeWidth={2.25} />}
              <span dir="auto">{originText(origin)}</span>
            </span>
          )}
          {rule && (
            <button
              type="button"
              onClick={() => openEditor({ rule })}
              className="mt-0.5 block text-xs font-medium underline underline-offset-2 opacity-90 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {s.txTools.origin.editRule}
            </button>
          )}
          <span className="mt-1 block text-[11px] opacity-70">{s.txTools.origin.showOnly}</span>
        </TooltipContent>
      </Tooltip>
      {picker(
        <Pencil className="size-3.5" />,
        cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-[opacity,background-color] outline-none group-hover:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:opacity-100",
        ),
        s.txTools.origin.change,
      )}
    </div>
  );
}

/** Set once a row took the screenshot below, so only the first row shown does. */
let paidBackShotTaken = false;

/**
 * Screenshot aid (dev start route only, see lib/shot.ts): `?shot=paid-back`
 * opens the Paid back dialog on the first money-in row shown, and
 * `?shot=paid-back-hint` shows the first linked row's hover card. Returns
 * the hover card's state, and a ref that scrolls the row into view for it.
 */
function usePaidBackShot(row: Row): { hint: boolean; ref: React.RefObject<HTMLDivElement | null> } {
  const shot = useShot();
  const openDialog = useRowDialog();
  const [hint, setHint] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (shot !== "paid-back" && shot !== "paid-back-hint") return;
    const id = setTimeout(() => {
      if (paidBackShotTaken) return;
      const entry = paidBackEntry(row);
      if (shot === "paid-back" && entry?.key === "paidBack" && entry.dialog && openDialog) {
        paidBackShotTaken = true;
        openDialog(entry.dialog);
      }
      if (shot === "paid-back-hint" && row.paidBackFor) {
        paidBackShotTaken = true;
        ref.current?.scrollIntoView({ block: "center" });
        setHint(true);
      }
    }, 400);
    return () => clearTimeout(id);
    // Once per load: refreshed rows must not repeat it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot]);
  return { hint, ref };
}
