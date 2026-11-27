// Deleting a category. When nothing uses it, one plain question. When rows
// or rules use it, the user picks a category of the same kind to move them
// to first: nothing is ever dropped, and core refuses anything else.
// A budget does go with its category, so the dialog says so first (spec 44).

import { useState } from "react";
import { toast } from "sonner";
import type { Category } from "@shared/types";
import { s } from "@/strings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { indexCategories, treeOf } from "@/lib/categories";
import { useBudgetPlan } from "@/lib/hooks";
import { usePeriod } from "@/lib/month-context";
import { money } from "@/components/budgets/offer-words";
import { TreeChoice } from "./tree-choice";
import { problemText, useCategoryActions } from "./category-actions";

export function DeleteDialog({
  category,
  categories,
  open,
  onOpenChange,
}: {
  category: Category;
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { remove } = useCategoryActions();
  // Budgets are the same every month; the page's month reuses its loaded plan.
  const plan = useBudgetPlan(usePeriod().choice.month);
  const budget = plan.data?.lines.find((l) => l.categoryId === category.id)?.budget ?? null;
  const [moveTo, setMoveTo] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const rows = category.rowCount ?? 0;
  const rules = category.ruleCount ?? 0;
  const inUse = rows + rules > 0;
  const hasChildren = categories.some((c) => c.parentId === category.id);
  // spec 34: any other category of its kind, at any level, shown as the tree.
  const targets = treeOf(indexCategories(categories), category.kind).filter((e) => e.category.id !== category.id);

  const confirm = () => {
    setProblem(null);
    remove.mutate(
      { id: category.id, moveTo: inUse ? moveTo : null },
      {
        onSuccess: (r) => {
          if (!r.ok) return setProblem(problemText(r.problem));
          toast.success(s.catEdit.deleted(category.name));
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" closeLabel={s.catEdit.cancel}>
        <div className="overflow-y-auto px-7 pt-7 pb-6">
          <DialogTitle>{s.catEdit.deleteTitle(category.name)}</DialogTitle>
          <DialogDescription className="mt-2 leading-relaxed text-pretty">
            {hasChildren
              ? s.nested.hasChildren
              : inUse
                ? s.catEdit.deleteInUse(s.catEdit.usage(rows, rules))
                : s.catEdit.deleteFree}
            {!hasChildren && budget !== null && (
              <span className="mt-2 block font-medium text-foreground">{s.deleteBudget.goes(money(budget))}</span>
            )}
          </DialogDescription>
          {inUse && !hasChildren && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">{s.catEdit.moveTo}</p>
              <TreeChoice value={moveTo} entries={targets} onChange={setMoveTo} label={s.catEdit.moveTo} />
            </div>
          )}
          {problem && (
            <p role="alert" className="mt-5 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
              {problem}
            </p>
          )}
          <div className="mt-7 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {s.catEdit.cancel}
            </Button>
            {!hasChildren && (
              <Button variant="destructive" disabled={remove.isPending || plan.isPending || (inUse && moveTo === null)} onClick={confirm}>
                {inUse ? s.catEdit.deleteAndMove : s.catEdit.delete}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
