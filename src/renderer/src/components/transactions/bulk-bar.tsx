// Floating bar while rows are selected: how many, categorize, clear.
// Adapted from Spent (github.com/Shaya16/Spent), src/components/transactions/bulk-action-bar.tsx.

import { LoaderCircle, Tags, X } from "lucide-react";
import type { Category } from "@shared/types";
import { s } from "@/strings";
import type { CategoryIndex } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { CategoryPicker } from "./category-picker";

export function BulkBar({
  count,
  pending,
  index,
  onCategory,
  onClear,
}: {
  count: number;
  pending: boolean;
  index: CategoryIndex;
  onCategory: (category: Category | null) => void;
  onClear: () => void;
}) {
  return (
    <div className="pointer-events-none sticky bottom-6 z-30 mt-6 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-popover py-1.5 ps-4 pe-1.5 shadow-xl shadow-black/10 animate-in fade-in-0 slide-in-from-bottom-2 dark:shadow-black/40">
        <span className="flex min-w-20 items-center text-sm font-medium tabular-nums">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : s.transactions.selected(count)}
        </span>
        <span className="mx-1 h-5 w-px bg-border" />
        <CategoryPicker
          index={index}
          side="top"
          align="center"
          onSelect={onCategory}
          triggerClassName="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
        >
          <Tags className="size-4" />
          {s.transactions.categorize}
        </CategoryPicker>
        <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={s.transactions.clearSelection} onClick={onClear}>
          <X />
        </Button>
      </div>
    </div>
  );
}
