// spec 37 and 40: the budget part of a spending line on Categories: its usual
// month and its budget box with the weekly figure, between what the line shows
// before and after them. A budget too big for its parent or the total shows
// the raise offer right under the line; one below the budgets inside says so.

import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import type { BudgetPlanLine } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { useSetBudget } from "@/lib/hooks";
import { useShot } from "@/lib/shot";
import { Button } from "@/components/ui/button";
import { BudgetBox, budgetText, useBudgetEdit } from "./budget-box";
import { money, offerWords, type OverProblem } from "./offer-words";

export function BudgetLine({
  line,
  name,
  nameOf,
  children,
  actions,
}: {
  line: BudgetPlanLine;
  name: string;
  nameOf: (id: number) => string;
  /** The start of the line: the category itself. */
  children: ReactNode;
  /** The end of the line, after the budget box. */
  actions: ReactNode;
}) {
  const box = useRef<HTMLInputElement>(null);
  const setBudget = useSetBudget();
  const edit = useBudgetEdit(line.budget, (monthlyBudget, raiseParents) =>
    setBudget.mutateAsync({ categoryId: line.categoryId, monthlyBudget, raiseParents }),
  );
  const problem = edit.refused?.problem;
  const over = problem?.code === "over_parent" || problem?.code === "over_total" ? problem : null;
  useRaiseShot(name, line, box, edit.onText, edit.submit);

  const backToBox = () => box.current?.focus();
  const raise = () => void edit.raise().then((ok) => ok && backToBox());
  const cancel = () => {
    edit.revert();
    backToBox();
  };

  return (
    <>
      <div className="flex items-center gap-2 py-2.5 pe-5">
        {children}
        <div className="w-28 shrink-0 text-end text-sm text-muted-foreground tabular-nums">
          {line.usual !== null && line.usual !== 0 && s.plan.usually(money(line.usual))}
        </div>
        <div className="w-32 shrink-0">
          <BudgetBox
            ref={box}
            text={edit.text}
            onText={edit.onText}
            onSave={edit.save}
            onRevert={edit.revert}
            invalid={edit.invalid}
            label={s.budgets.fieldLabel(name)}
            placeholder={s.budgets.fieldPlaceholder}
            className="[&_input]:scroll-mt-24 [&_input]:scroll-mb-4"
          />
          <p className={cn("mt-1 h-4 truncate text-end text-[11px]", edit.invalid ? "text-status-over" : "text-muted-foreground")}>
            {edit.invalid ? s.budgets.invalid : line.weekly !== null && s.budgets.perWeek(money(line.weekly))}
          </p>
        </div>
        {actions}
      </div>
      {over && <RaiseOffer problem={over} child={name} nameOf={nameOf} busy={setBudget.isPending} onRaise={raise} onCancel={cancel} />}
      {problem?.code === "under_children" && (
        <p role="alert" className="mx-5 mb-3 rounded-2xl bg-status-over/10 px-4 py-2.5 text-sm text-status-over">
          {s.plan.underChildren(money(problem.inside))}
        </p>
      )}
    </>
  );
}

/** "₪600 left inside", "All split", over, or how much is budgeted inside a category with no budget. */
export function InsideNote({ line }: { line: BudgetPlanLine }) {
  if (line.inside === 0) return null;
  const left = line.leftInside;
  let text: string;
  if (left === null) text = s.plan.budgetedInside(money(line.inside));
  else if (left > 0) text = s.plan.leftInside(money(left));
  else if (left === 0) text = s.plan.allSplit;
  else text = s.plan.overInside(money(-left));
  return <div className={cn("text-xs", left !== null && left < 0 ? "text-status-over" : "text-muted-foreground")}>{text}</div>;
}

/** The inline offer. It takes focus: Enter raises, Esc cancels, and its two buttons do the same. Up and Down stay put. */
function RaiseOffer({
  problem,
  child,
  nameOf,
  busy,
  onRaise,
  onCancel,
}: {
  problem: OverProblem;
  child: string;
  nameOf: (id: number) => string;
  busy: boolean;
  onRaise: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest" });
  }, []);
  const words = offerWords(problem, child, nameOf);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && e.target === e.currentTarget && !busy) {
      e.preventDefault();
      onRaise();
    } else if (["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      // Else the list moves to another line and leaves this offer open behind it.
      e.preventDefault();
      e.stopPropagation();
    }
  };
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="group"
      aria-label={s.plan.offerLabel}
      onKeyDown={onKeyDown}
      className="mx-5 mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-status-heads-up/12 px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <p className="min-w-0 flex-1">{words.text}</p>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={onRaise} disabled={busy}>
          {words.button}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {s.plan.cancel}
        </Button>
      </div>
    </div>
  );
}

/**
 * Screenshot aid: `?shot=raise-<name>` types ₪500 more than that category's
 * room into its box and saves, so the raise offer shows.
 */
function useRaiseShot(
  name: string,
  line: BudgetPlanLine,
  box: RefObject<HTMLInputElement | null>,
  onText: (text: string) => void,
  submit: (next: number | null) => Promise<boolean>,
) {
  const shot = useShot();
  const wanted = shot === `raise-${name}` && line.room !== null;
  useEffect(() => {
    if (!wanted || line.room === null) return;
    const amount = line.room + 50_000;
    const id = setTimeout(() => {
      box.current?.scrollIntoView({ block: "center" });
      onText(budgetText(amount));
      void submit(amount);
    }, 400);
    return () => clearTimeout(id);
    // Once per load: refreshed data must not type it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);
}
