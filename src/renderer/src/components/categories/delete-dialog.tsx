// Deleting a category. When nothing uses it, one plain question. When rows
// or rules use it, the user picks a category of the same kind to move them
// to first: nothing is ever dropped, and core refuses anything else.

import { useState } from "react";
import { toast } from "sonner";
import type { Category } from "@shared/types";
import { s } from "@/strings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Choices } from "./category-editor";
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
  const [moveTo, setMoveTo] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const rows = category.rowCount ?? 0;
  const rules = category.ruleCount ?? 0;
  const inUse = rows + rules > 0;
  const hasChildren = categories.some((c) => c.parentId === category.id);
  const targets = categories.filter((c) => c.kind === category.kind && c.id !== category.id);
  const byId = new Map(categories.map((c) => [c.id, c]));
  const label = (c: Category) => {
    const parent = c.parentId != null ? byId.get(c.parentId) : undefined;
    return `${c.emoji ?? ""} ${parent ? `${parent.name} › ` : ""}${c.name}`.trim();
  };

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
              ? s.catEdit.problem["has_children"]
              : inUse
                ? s.catEdit.deleteInUse(s.catEdit.usage(rows, rules))
                : s.catEdit.deleteFree}
          </DialogDescription>
          {inUse && !hasChildren && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">{s.catEdit.moveTo}</p>
              <div className="max-h-56 overflow-y-auto">
                <Choices value={moveTo} options={targets.map((c) => ({ value: c.id, label: label(c) }))} onChange={setMoveTo} />
              </div>
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
              <Button variant="destructive" disabled={remove.isPending || (inUse && moveTo === null)} onClick={confirm}>
                {inUse ? s.catEdit.deleteAndMove : s.catEdit.delete}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
