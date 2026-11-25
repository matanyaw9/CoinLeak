// spec 37: one spending category on the Budgets page: emoji and name, its
// usual month, what it spent in the chosen month, and its budget box with the
// weekly figure. A budget too big for its parent or the total shows the raise
// offer right under the line; one below the budgets inside says so.

import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import type { BudgetPlanLine, Category } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { useSetBudget } from "@/lib/hooks";
import { useShot } from "@/lib/shot";
import { Button } from "@/components/ui/button";
import { CategoryBubble } from "@/components/common/chips";
import { BudgetBox, budgetText, useBudgetEdit } from "./budget-box";
import { money, offerWords, shekels, type OverProblem } from "./offer-words";

const PAD = ["ps-4", "ps-4", "ps-12", "ps-20"];
const BUBBLE = [36, 36, 32, 28];

export function BudgetLine({
  line,
  category,
  nameOf,
  focus,
}: {
  line: BudgetPlanLine;
  category: Category | undefined;
  nameOf: (id: number) => string;
  /** Opened from Categories at this line: its box takes focus. */
  focus: boolean;
}) {
  const name = category?.name ?? "";
  const box = useRef<HTMLInputElement>(null);
  const setBudget = useSetBudget();
  const edit = useBudgetEdit(line.budget, (monthlyBudget, raiseParents) =>
    setBudget.mutateAsync({ categoryId: line.categoryId, monthlyBudget, raiseParents }),
  );
  const problem = edit.refused?.problem;
  const over = problem?.code === "over_parent" || problem?.code === "over_total" ? problem : null;

  useEffect(() => {
    if (!focus) return;
    box.current?.focus();
    box.current?.scrollIntoView({ block: "center" });
  }, [focus]);
  useRaiseShot(name, line, box, edit.onText, edit.submit);

  const backToBox = () => box.current?.focus();
  const raise = () => void edit.raise().then((ok) => ok && backToBox());
  const cancel = () => {
    edit.revert();
    backToBox();
  };

  return (
    <div className={cn("transition-colors", focus && "bg-primary/[0.04]")}>
      <div className={cn("flex items-center gap-4 py-3 pe-5", PAD[line.depth])}>
        <CategoryBubble category={category} size={BUBBLE[line.depth]} />
        <div className="min-w-0 flex-1">
          <div dir="auto" className={cn("truncate text-[15px]", line.depth === 1 ? "font-semibold" : "font-medium")}>
            {name}
          </div>
          <InsideNote line={line} />
        </div>
        <div className="w-32 shrink-0 text-end text-sm text-muted-foreground tabular-nums">
          {line.usual !== null && line.usual !== 0 && s.plan.usually(money(line.usual))}
        </div>
        <div
          className={cn(
            "w-32 shrink-0 text-end text-sm tabular-nums",
            line.spent === 0 && "text-muted-foreground",
            line.budget !== null && line.spent > line.budget && "text-status-over",
          )}
        >
          {s.plan.spent(shekels(line.spent))}
        </div>
        <div className="w-36 shrink-0">
          <BudgetBox
            ref={box}
            text={edit.text}
            onText={edit.onText}
            onSave={edit.save}
            onRevert={edit.revert}
            invalid={edit.invalid}
            label={s.budgets.fieldLabel(name)}
            placeholder={s.budgets.fieldPlaceholder}
          />
          <p className={cn("mt-1 h-4 truncate text-end text-[11px]", edit.invalid ? "text-status-over" : "text-muted-foreground")}>
            {edit.invalid ? s.budgets.invalid : line.weekly !== null && s.budgets.perWeek(money(line.weekly))}
          </p>
        </div>
      </div>
      {over && <RaiseOffer problem={over} child={name} nameOf={nameOf} busy={setBudget.isPending} onRaise={raise} onCancel={cancel} />}
      {problem?.code === "under_children" && (
        <p role="alert" className="mx-5 mb-3 rounded-2xl bg-status-over/10 px-4 py-2.5 text-sm text-status-over">
          {s.plan.underChildren(money(problem.inside))}
        </p>
      )}
    </div>
  );
}

/** "₪600 left inside", "All split", or how much is budgeted inside a category with no budget. */
function InsideNote({ line }: { line: BudgetPlanLine }) {
  if (line.inside === 0) return null;
  let text: string;
  if (line.budget === null) text = s.plan.budgetedInside(money(line.inside));
  else if (line.budget > line.inside) text = s.plan.leftInside(money(line.budget - line.inside));
  else if (line.budget === line.inside) text = s.plan.allSplit;
  else text = s.plan.overInside(money(line.inside - line.budget));
  const wrong = line.budget !== null && line.inside > line.budget;
  return <div className={cn("text-xs", wrong ? "text-status-over" : "text-muted-foreground")}>{text}</div>;
}

/** The inline offer. It takes focus: Enter raises, Esc cancels, and its two buttons do the same. */
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
