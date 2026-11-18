// spec 27: the small "Budget" field on a spending category's row. Monthly
// shekels, saved on Enter or leaving the field, cleared to remove. Core
// checks the amount again and works out the weekly figure shown under it.

import { useState, type KeyboardEvent } from "react";
import type { BudgetLine, Category } from "@shared/types";
import { s } from "@/strings";
import { ils } from "@/lib/format";
import { showFailure } from "@/lib/failure";
import { useSetBudget } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/misc";
import { parseShekels, shekelText } from "@shared/money";

/** What a typed budget means: clear it, an amount in agorot, or not a valid amount (zero included). */
export function readBudget(text: string): { kind: "clear" } | { kind: "set"; agorot: number } | { kind: "invalid" } {
  if (text.trim() === "") return { kind: "clear" };
  const agorot = parseShekels(text);
  return agorot === null || agorot === 0 ? { kind: "invalid" } : { kind: "set", agorot };
}

export function BudgetField({ category, budget }: { category: Category; budget: BudgetLine | undefined }) {
  const saved = budget ? shekelText(budget.monthlyBudget) : "";
  const [text, setText] = useState(saved);
  const [invalid, setInvalid] = useState(false);
  const setBudget = useSetBudget();

  const save = () => {
    const typed = readBudget(text);
    if (typed.kind === "invalid") return setInvalid(true);
    setInvalid(false);
    const next = typed.kind === "clear" ? null : typed.agorot;
    if (next === (budget?.monthlyBudget ?? null)) return setText(saved);
    setBudget.mutate(
      { categoryId: category.id, monthlyBudget: next },
      {
        onError: (e) => {
          setText(saved);
          showFailure(e, s.budgets.saveFailed);
        },
      },
    );
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      setText(saved);
      setInvalid(false);
      e.currentTarget.blur();
    }
  };

  return (
    // The row can be dragged; the field must not start a drag.
    <div className="w-32 shrink-0" draggable={false} onDragStart={(e) => e.preventDefault()}>
      <label className="relative block">
        <span className="sr-only">{s.budgets.fieldLabel(category.name)}</span>
        <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-xs text-muted-foreground">₪</span>
        <Input
          value={text}
          inputMode="decimal"
          placeholder={s.budgets.fieldPlaceholder}
          aria-invalid={invalid}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={onKeyDown}
          className={cn("h-8 ps-6 text-end tabular-nums", invalid && "border-status-over ring-status-over/30")}
        />
      </label>
      <p className={cn("mt-1 truncate text-end text-[11px]", invalid ? "text-status-over" : "text-muted-foreground")}>
        {invalid
          ? s.budgets.invalid
          : budget
            ? s.budgets.perWeek(ils(budget.weeklyBudget, { decimals: false }))
            : s.budgets.field}
      </p>
    </div>
  );
}
