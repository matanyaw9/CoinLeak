// Paid back for a purchase (spec 33, F65): pick the purchase a money-in row
// pays back, from a searchable list core sends, or undo the link. Keyboard:
// type to search, arrow keys move, Enter picks, Esc closes. Spec 36: the
// page opens these dialogs, and Enter waits until the list matches the text.

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Wallet } from "lucide-react";
import type { PaidBackProblem, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { showFailure } from "@/lib/failure";
import { cn } from "@/lib/utils";
import { formatDayShort } from "@/lib/format";
import { indexCategories } from "@/lib/categories";
import { useAccounts, useCategories, useClearPaidBack, useMarkPaidBack, usePaidBackCandidates } from "@/lib/hooks";
import { useDebounced } from "@/lib/use-debounced";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/misc";
import { Money } from "@/components/common/money";
import { AccountChip, CategoryBubble } from "@/components/common/chips";
import { nextIndex } from "@/lib/roving";

/** A bank text kept in one piece inside an English sentence, whatever its direction. */
export const isolated = (text: string) => `\u2068${text.trim()}\u2069`;

/** The row menu's "Paid back for a purchase..." dialog for `row`. */
export function PaidBackDialog({ row, onClose }: { row: TransactionRow; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl" closeLabel={s.paidBack.close}>
        <Picker row={row} onDone={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function Picker({ row, onDone }: { row: TransactionRow; onDone: () => void }) {
  const [text, setText] = useState("");
  const query = useDebounced(text.trim(), 150);
  const candidates = usePaidBackCandidates(row.id, query);
  const rows = useMemo(() => candidates.data ?? [], [candidates.data]);
  const index = indexCategories(useCategories().data);
  const accounts = useAccounts().data ?? [];
  const mark = useMarkPaidBack();
  const [highlight, setHighlight] = useState(0);
  const [problem, setProblem] = useState<PaidBackProblem | null>(null);
  // Fewer results than before: the highlight stays on the last one.
  const active = Math.max(0, Math.min(highlight, rows.length - 1));

  // The highlighted purchase stays in view while the arrows move it.
  useEffect(() => document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" }), [active]);

  const pick = async (purchase: TransactionRow | undefined) => {
    if (!purchase || mark.isPending) return;
    setProblem(null);
    try {
      // Awaited rather than per-call callbacks: the row may leave the list
      // (Needs review) and unmount this dialog before they would run.
      const result = await mark.mutateAsync({ rowId: row.id, purchaseId: purchase.id });
      if (!result.ok) return setProblem(result.problem);
      const category = purchase.categoryId != null ? index.byId.get(purchase.categoryId) : undefined;
      toast.success(s.paidBack.linked(isolated(purchase.description)), {
        description: category ? s.paidBack.linkedBody(category.name) : undefined,
      });
      onDone();
    } catch (e) {
      showFailure(e, s.errors.failed.update);
    }
  };

  // Enter picks only what the list shows for the text typed: while the search
  // waits or loads, the list is still the one for the earlier text.
  const caughtUp = query === text.trim() && !candidates.isPlaceholderData;

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Home and End stay the text box's; focus stays there while the arrows move.
    const to = e.key === "ArrowDown" || e.key === "ArrowUp" ? nextIndex(e.key, active, rows.length) : null;
    if (to !== null) setHighlight(to);
    else if (e.key === "Enter") {
      if (caughtUp) void pick(rows[active]);
    } else return;
    // The keys are the list's; the dialog around it must not act on them too.
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="px-7 pt-7 pb-4">
        <DialogTitle className="pe-8">{s.paidBack.title}</DialogTitle>
        <DialogDescription className="mt-1.5 leading-relaxed text-pretty">
          <bdi className="font-medium text-foreground">{row.description.trim()}</bdi>
          {" · "}
          {formatDayShort(row.date)}
          {" · "}
          <Money amount={row.amount} sign className="text-status-on-track" />
          <span className="mt-1 block">{s.paidBack.body}</span>
        </DialogDescription>
        <label className="relative mt-5 block">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="paid-back-list"
            aria-activedescendant={rows.length > 0 ? optionId(active) : undefined}
            aria-label={s.paidBack.search}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setHighlight(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={s.paidBack.search}
            className="h-10 rounded-full bg-background ps-9"
          />
        </label>
        <p className="mt-2 ps-3 text-xs text-muted-foreground">{s.paidBack.window}</p>
        {problem && (
          <p role="alert" className="mt-3 rounded-xl bg-status-heads-up/12 px-3 py-2 text-sm text-foreground">
            {s.paidBack.problems[problem]}
          </p>
        )}
      </div>

      <ul
        id="paid-back-list"
        role="listbox"
        aria-label={s.paidBack.title}
        className={cn("min-h-0 flex-1 overflow-y-auto border-t border-border px-3 py-2", mark.isPending && "opacity-60")}
        style={{ maxHeight: "22rem" }}
      >
        {rows.map((r, i) => {
          const category = r.categoryId != null ? index.byId.get(r.categoryId) : undefined;
          return (
            <li
              key={r.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onClick={() => void pick(r)}
              onMouseMove={() => setHighlight(i)}
              className={cn(
                "flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 select-none",
                i === active && "bg-accent",
              )}
            >
              <CategoryBubble category={category} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  <bdi>{r.description.trim()}</bdi>
                </p>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="shrink-0 tabular-nums">{formatDayShort(r.date)}</span>
                  {r.source === "manual" ? (
                    <span title={s.cash.chipTitle} className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2 py-0.5">
                      <Wallet className="size-3" strokeWidth={2} />
                      {s.cash.chip}
                    </span>
                  ) : (
                    <AccountChip account={accounts.find((a) => a.id === r.accountId)} className="min-w-0" />
                  )}
                </span>
              </div>
              <span className={cn("w-36 shrink-0 truncate text-sm", category ? "text-foreground/85" : "text-muted-foreground italic")}>
                {category?.name ?? s.paidBack.uncategorized}
              </span>
              <Money amount={-r.amount} className="w-24 shrink-0 text-end text-[15px]" />
            </li>
          );
        })}
        {candidates.data && rows.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-muted-foreground">{query ? s.paidBack.noMatch : s.paidBack.empty}</li>
        )}
      </ul>
      <p className="border-t border-border px-7 py-3 text-xs text-muted-foreground">{s.paidBack.keys}</p>
    </div>
  );
}

const optionId = (i: number) => `paid-back-option-${i}`;

/** The row menu's "Not paid back" question for a linked `row`. */
export function NotPaidBackDialog({ row, onClose }: { row: TransactionRow; onClose: () => void }) {
  const clear = useClearPaidBack();
  const purchase = row.paidBackFor;
  const confirm = async () => {
    try {
      await clear.mutateAsync(row.id);
      toast.success(s.paidBack.cleared, { description: s.paidBack.clearedBody });
      onClose();
    } catch (e) {
      showFailure(e, s.errors.failed.update);
    }
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-7" closeLabel={s.paidBack.close}>
        <DialogTitle className="pe-8">{s.paidBack.clearTitle}</DialogTitle>
        <DialogDescription className="mt-2 leading-relaxed text-pretty">
          {s.paidBack.clearBody(purchase ? isolated(purchase.description) : "")}
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {s.paidBack.cancel}
          </Button>
          <Button autoFocus disabled={clear.isPending} onClick={() => void confirm()}>
            {s.paidBack.clear}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
