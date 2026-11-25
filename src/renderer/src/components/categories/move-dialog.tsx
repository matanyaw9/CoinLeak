// Moving a category without dragging (spec 34: at every level, with everything
// inside it): one button per category it may go inside, shown as the tree,
// plus "top level". Keyboard users get here from the row's Move button; the
// arrow keys move between the choices. Drops and this dialog both call `move`.

import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { indexCategories, parentChoices, type TreeEntry } from "@/lib/categories";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CategoryBubble } from "@/components/common/chips";
import { problemText, useCategoryActions } from "./category-actions";
import { arrowFocus } from "./tree-choice";

const INDENT = ["", "", "ps-8", "ps-14"];

/** Where a category may go: the parents it fits under (as the tree), then top level (null) unless it is there. */
export function moveTargets(category: Category, categories: Category[]): (TreeEntry | null)[] {
  const parents = parentChoices(indexCategories(categories), category.kind, category);
  return category.parentId === null ? parents : [...parents, null];
}

export function useMoveCategory() {
  const { update } = useCategoryActions();
  return {
    pending: update.isPending,
    move(category: Category, target: Category | null, onDone?: () => void) {
      update.mutate(
        { id: category.id, patch: { parentId: target?.id ?? null } },
        {
          onSuccess: (r) => {
            if (!r.ok) return void toast.error(problemText(r.problem));
            toast.success(target ? s.catEdit.moved(category.name, target.name) : s.catEdit.movedTop(category.name));
            onDone?.();
          },
        },
      );
    },
  };
}

export function MoveDialog({
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
  const mover = useMoveCategory();
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const targets = useMemo(() => moveTargets(category, categories), [category, categories]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" closeLabel={s.catEdit.cancel}>
        <div className="overflow-y-auto px-7 pt-7 pb-6">
          <div className="flex items-center gap-3">
            <CategoryBubble category={category} size={40} />
            <DialogTitle>{s.catEdit.moveTitle(category.name)}</DialogTitle>
          </div>
          <DialogDescription className="mt-3 leading-relaxed">
            {targets.length === 0 ? s.nested.moveNowhere : s.nested.moveIntro}
          </DialogDescription>
          {targets.length > 0 && (
            <ul className="mt-5 max-h-[22rem] space-y-1.5 overflow-y-auto p-0.5" onKeyDown={arrowFocus}>
              {targets.map((t) => {
                const target = t?.category ?? null;
                const id = target?.id ?? null;
                const current = id === category.parentId;
                return (
                  <li key={id ?? "top"} className={t ? INDENT[t.depth] : undefined}>
                    <button
                      type="button"
                      disabled={current || mover.pending}
                      onClick={() => {
                        setPicked(id);
                        mover.move(category, target, () => onOpenChange(false));
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border border-border px-3.5 py-2.5 text-start text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
                        picked === id && "border-primary/50 bg-primary/10",
                      )}
                    >
                      {target ? (
                        <CategoryBubble category={target} size={28} />
                      ) : (
                        <span className="size-7 rounded-full border border-dashed border-foreground/25" />
                      )}
                      <span className="flex-1">{target ? target.name : s.catEdit.moveTop}</span>
                      {current ? (
                        <span className="text-xs text-muted-foreground">{s.catEdit.current}</span>
                      ) : (
                        <ArrowRight className="size-4 text-muted-foreground" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-6 flex justify-end">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {s.catEdit.cancel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
