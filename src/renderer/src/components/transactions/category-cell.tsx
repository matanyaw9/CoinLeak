// A row's category (spec 17): the chip filters the list to that category
// (F34), hovering it says who set it with a link to the rule (F32), and the
// pencil next to it opens the picker. No category: the picker button.

import { ChevronDown, Pencil, WandSparkles } from "lucide-react";
import type { Category, TransactionRow as Row } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { colorOf, type CategoryIndex } from "@/lib/categories";
import { useRules } from "@/lib/hooks";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRuleEditor } from "@/components/rules/rule-editor-provider";
import { CategoryPicker } from "./category-picker";
import { categoryOrigin, originText } from "./origin";

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
  return (
    <div className="flex min-w-0 items-center">
      <Tooltip key={String(hintOpen)} defaultOpen={hintOpen}>
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
        </TooltipTrigger>
        {/* Hidden screenshot runs never advance animations; demo shots skip them. */}
        <TooltipContent side="top" className={cn(hintOpen && "!animate-none")}>
          <span className="flex items-center gap-1.5 font-medium">
            {origin.kind === "rule" && <WandSparkles className="size-3 shrink-0" strokeWidth={2.25} />}
            <span dir="auto">{originText(origin)}</span>
          </span>
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
