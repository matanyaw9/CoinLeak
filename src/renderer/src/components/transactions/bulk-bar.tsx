// Floating bar while rows are selected: how many, categorize, make a rule,
// ignore or count again, move to trash, clear.
// Adapted from Spent (github.com/Shaya16/Spent), src/components/transactions/bulk-action-bar.tsx.

import { Eye, EyeOff, LoaderCircle, Tags, Trash2, WandSparkles, X } from "lucide-react";
import type { Category } from "@shared/types";
import { s } from "@/strings";
import type { CategoryIndex } from "@/lib/categories";
import { useShot } from "@/lib/shot";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CategoryPicker } from "./category-picker";

const ACTION = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50";

export function BulkBar({
  count,
  pending,
  index,
  ignored,
  onCategory,
  onMakeRule,
  onIgnore,
  onTrash,
  onClear,
}: {
  count: number;
  pending: boolean;
  index: CategoryIndex;
  /** Every selected row is ignored already, so the action counts them again. */
  ignored: boolean;
  onCategory: (category: Category | null) => void;
  onMakeRule: () => void;
  onIgnore: () => void;
  onTrash: () => void;
  onClear: () => void;
}) {
  // Hidden screenshot runs never advance animations, so demo shots skip it.
  const still = useShot() !== null;
  return (
    <div className="pointer-events-none sticky bottom-6 z-30 mt-6 flex justify-center">
      <div
        className={cn(
          "pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-popover py-1.5 ps-4 pe-1.5 shadow-xl shadow-black/10 dark:shadow-black/40",
          !still && "animate-in fade-in-0 slide-in-from-bottom-2",
        )}
      >
        <span className="flex min-w-20 items-center text-sm font-medium tabular-nums">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : s.transactions.selected(count)}
        </span>
        <span className="mx-1 h-5 w-px bg-border" />
        <CategoryPicker index={index} side="top" align="center" onSelect={onCategory} triggerClassName={ACTION}>
          <Tags className="size-4" />
          {s.transactions.categorize}
        </CategoryPicker>
        <button type="button" className={ACTION} onClick={onMakeRule} disabled={pending}>
          <WandSparkles className="size-4" />
          {s.bulk.makeRule}
        </button>
        <button type="button" className={ACTION} onClick={onIgnore} disabled={pending}>
          {ignored ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          {ignored ? s.rowMenu.countAgain : s.bulk.ignore}
        </button>
        <button type="button" className={ACTION} onClick={onTrash} disabled={pending}>
          <Trash2 className="size-4" />
          {s.bulk.trash}
        </button>
        <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={s.transactions.clearSelection} onClick={onClear}>
          <X />
        </Button>
      </div>
    </div>
  );
}
