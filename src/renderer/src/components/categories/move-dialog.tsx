// Moving a category to another group without dragging: one button per group
// of the same kind, plus "top level". Keyboard users get here from the row's
// Move button. Drops and this dialog both call `moveCategory`.

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CategoryBubble } from "@/components/common/chips";
import { problemText, useCategoryActions } from "./category-actions";

/** Where a category may go: groups of its kind other than itself. Null is top level. */
export function moveTargets(category: Category, categories: Category[]): (Category | null)[] {
  const groups = categories.filter((c) => c.parentId === null && c.kind === category.kind && c.id !== category.id);
  return category.parentId === null ? groups : [...groups, null];
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
  const targets = moveTargets(category, categories);
  const hasChildren = categories.some((c) => c.parentId === category.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" closeLabel={s.catEdit.cancel}>
        <div className="overflow-y-auto px-7 pt-7 pb-6">
          <div className="flex items-center gap-3">
            <CategoryBubble category={category} size={40} />
            <DialogTitle>{s.catEdit.moveTitle(category.name)}</DialogTitle>
          </div>
          <DialogDescription className="mt-3 leading-relaxed">
            {hasChildren ? s.catEdit.problem["has_children"] : s.catEdit.moveIntro}
          </DialogDescription>
          {!hasChildren && (
            <ul className="mt-5 space-y-1.5">
              {targets.map((t) => {
                const id = t?.id ?? null;
                const current = id === category.parentId;
                return (
                  <li key={id ?? "top"}>
                    <button
                      type="button"
                      disabled={current || mover.pending}
                      onClick={() => {
                        setPicked(id);
                        mover.move(category, t, () => onOpenChange(false));
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border border-border px-3.5 py-2.5 text-start text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
                        picked === id && "border-primary/50 bg-primary/10",
                      )}
                    >
                      {t ? (
                        <CategoryBubble category={t} size={28} />
                      ) : (
                        <span className="size-7 rounded-full border border-dashed border-foreground/25" />
                      )}
                      <span className="flex-1">{t ? t.name : s.catEdit.moveTop}</span>
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
