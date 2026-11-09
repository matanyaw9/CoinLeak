// Add or edit a cash transaction (spec 20): date, money out or in, amount,
// description, optional category and note. Saved rows live in the cash
// wallet, which core makes on the first one.

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown } from "lucide-react";
import type { TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { toIsoDate } from "@/lib/month";
import { pathOf, type CategoryIndex } from "@/lib/categories";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/misc";
import { Segmented } from "@/components/common/segmented";
import { CategoryBubble } from "@/components/common/chips";
import { CategoryPicker } from "./category-picker";
import { useSaveManual } from "./cash-actions";
import { DESCRIPTION_MAX, NOTE_MAX, emptyForm, formOf, inputOf, type Direction, type ManualForm } from "./manual-form";

const LABEL = "mb-1.5 block text-[13px] font-medium";

export function ManualDialog({
  open,
  onOpenChange,
  row,
  index,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The cash row to edit; null adds a new one. */
  row: TransactionRow | null;
  index: CategoryIndex;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-7" closeLabel={s.cash.cancel}>
        {/* A fresh form each time it opens, for the row it opens on. */}
        {open && <Form key={row?.id ?? "new"} row={row} index={index} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ row, index, onDone }: { row: TransactionRow | null; index: CategoryIndex; onDone: () => void }) {
  const [form, setForm] = useState<ManualForm>(() => (row ? formOf(row) : emptyForm(toIsoDate(new Date()))));
  const set = (patch: Partial<ManualForm>) => setForm((f) => ({ ...f, ...patch }));
  const save = useSaveManual();
  const input = inputOf(form);
  const category = form.categoryId != null ? index.byId.get(form.categoryId) : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input) return;
    save.mutate(
      { id: row?.id ?? null, input },
      {
        onSuccess: () => {
          toast.success(row ? s.cash.updated : s.cash.added);
          onDone();
        },
        onError: (err) => toast.error(err instanceof ApiError ? err.message : s.errors.crashBody),
      },
    );
  };

  return (
    <form onSubmit={submit}>
      <DialogTitle>{row ? s.cash.editTitle : s.cash.addTitle}</DialogTitle>
      <DialogDescription className="mt-1.5">{s.cash.body}</DialogDescription>

      <div className="mt-6 space-y-4">
        <Segmented<Direction>
          value={form.direction}
          onChange={(direction) => set({ direction })}
          options={[
            { value: "out", label: s.cash.out },
            { value: "in", label: s.cash.in },
          ]}
        />

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className={LABEL}>{s.cash.amount}</span>
            <Input
              autoFocus
              dir="ltr"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value })}
              placeholder="0.00"
              className="h-10 num"
            />
          </label>
          <label>
            <span className={LABEL}>{s.cash.date}</span>
            <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className="h-10" />
          </label>
        </div>

        <label className="block">
          <span className={LABEL}>{s.cash.description}</span>
          <Input
            dir="auto"
            value={form.description}
            maxLength={DESCRIPTION_MAX}
            onChange={(e) => set({ description: e.target.value })}
            placeholder={s.cash.descriptionPlaceholder}
            className="h-10"
          />
        </label>

        <div>
          <span className={LABEL}>{s.cash.category}</span>
          <CategoryPicker
            index={index}
            value={form.categoryId}
            preferKind={form.direction === "in" ? "income" : "expense"}
            onSelect={(c) => set({ categoryId: c?.id ?? null })}
            triggerClassName="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {category && <CategoryBubble category={category} size={22} />}
            <span className={cn("min-w-0 flex-1 truncate text-start", !category && "text-muted-foreground")}>
              {category ? pathOf(index, category) : s.cash.categoryOptional}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </CategoryPicker>
        </div>

        <label className="block">
          <span className={LABEL}>{s.cash.note}</span>
          <textarea
            dir="auto"
            rows={2}
            value={form.note}
            maxLength={NOTE_MAX}
            onChange={(e) => set({ note: e.target.value })}
            className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </label>
      </div>

      <div className="mt-7 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          {s.cash.cancel}
        </Button>
        <Button type="submit" disabled={!input || save.isPending}>
          {s.cash.save}
        </Button>
      </div>
    </form>
  );
}
