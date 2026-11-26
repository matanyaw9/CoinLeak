// spec 37 and 40: a monthly shekel box on Categories, for the total and for
// each category. Enter saves and keeps focus, leaving saves, Esc puts the
// saved amount back, and Up and Down move to the box above or below.

import { useRef, useState, type KeyboardEvent, type Ref } from "react";
import type { Agorot, BudgetChange, BudgetProblem } from "@shared/types";
import { parseShekels, shekelText } from "@shared/money";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { showFailure } from "@/lib/failure";
import { nextIndex } from "@/lib/roving";
import { Input } from "@/components/ui/misc";

/** What a typed budget means: clear it, an amount in agorot, or not a valid amount (zero included). */
export function readBudget(text: string): { kind: "clear" } | { kind: "set"; agorot: number } | { kind: "invalid" } {
  if (text.trim() === "") return { kind: "clear" };
  const agorot = parseShekels(text);
  return agorot === null || agorot === 0 ? { kind: "invalid" } : { kind: "set", agorot };
}

/** A saved amount as the box shows it: "1200", "12.50", or empty for none. */
export const budgetText = (amount: Agorot | null): string => (amount === null ? "" : shekelText(amount));

/** The text in a box, put back to the saved amount whenever that changes (a save, or a raise from below). */
function useBudgetText(saved: Agorot | null) {
  const [text, setText] = useState(budgetText(saved));
  const [shown, setShown] = useState(saved);
  if (saved !== shown) {
    setShown(saved);
    setText(budgetText(saved));
  }
  return { text, setText, putBack: () => setText(budgetText(saved)) };
}

/** A save core refused, with the amount it was for. */
export interface Refused {
  problem: BudgetProblem;
  amount: Agorot | null;
}

/**
 * One box's editing: its text, and saving it through `send`. An unchanged
 * amount, or one already sent, is not sent again. A refusal stays until the
 * next edit; when no raise could help (`under_children`, `under_split`) the
 * saved amount goes back in the box. `raise` sends the refused amount again
 * with `raiseParents`; it and `submit` say whether the save went through.
 */
export function useBudgetEdit(saved: Agorot | null, send: (next: Agorot | null, raiseParents: boolean) => Promise<BudgetChange>) {
  const { text, setText, putBack } = useBudgetText(saved);
  const [invalid, setInvalid] = useState(false);
  const [refused, setRefused] = useState<Refused | null>(null);
  const sent = useRef<Agorot | null | undefined>(undefined);

  const submit = (next: Agorot | null, raiseParents = false): Promise<boolean> => {
    sent.current = next;
    return send(next, raiseParents).then(
      (change) => {
        if (change.ok) {
          sent.current = undefined;
          setRefused(null);
          return true;
        }
        setRefused({ problem: change.problem, amount: next });
        if (change.problem.code === "under_children" || change.problem.code === "under_split") {
          sent.current = undefined;
          putBack();
        }
        return false;
      },
      (e: unknown) => {
        sent.current = undefined;
        putBack();
        showFailure(e, s.plan.saveFailed);
        return false;
      },
    );
  };
  const save = () => {
    const typed = readBudget(text);
    if (typed.kind === "invalid") return setInvalid(true);
    setInvalid(false);
    const next = typed.kind === "clear" ? null : typed.agorot;
    if (next === sent.current) return;
    if (next === saved) return revert();
    void submit(next);
  };
  const revert = () => {
    putBack();
    setInvalid(false);
    setRefused(null);
    sent.current = undefined;
  };
  const onText = (value: string) => {
    setText(value);
    setInvalid(false);
    setRefused(null);
    sent.current = undefined;
  };
  const raise = (): Promise<boolean> => (refused ? submit(refused.amount, true) : Promise.resolve(false));
  return { text, invalid, refused, onText, save, revert, raise, submit };
}

/** Up and Down move to the box above or below, in page order (every box has `data-budget-box`). */
function moveFocus(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const boxes = [...document.querySelectorAll<HTMLInputElement>("input[data-budget-box]")];
  const to = nextIndex(e.key, boxes.indexOf(e.currentTarget), boxes.length);
  const box = to === null ? undefined : boxes[to];
  if (!box || box === e.currentTarget) return;
  e.preventDefault();
  box.focus();
  box.select();
  box.scrollIntoView({ block: "nearest" });
}

export function BudgetBox({
  text,
  onText,
  onSave,
  onRevert,
  label,
  placeholder,
  invalid,
  ref,
  className,
}: {
  text: string;
  onText: (text: string) => void;
  /** Enter, or focus leaving the box. */
  onSave: () => void;
  /** Esc: the saved amount goes back in. */
  onRevert: () => void;
  label: string;
  placeholder: string;
  invalid: boolean;
  ref?: Ref<HTMLInputElement>;
  className?: string;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onRevert();
    } else moveFocus(e);
  };
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-xs text-muted-foreground">₪</span>
      <Input
        ref={ref}
        data-budget-box=""
        value={text}
        inputMode="decimal"
        placeholder={placeholder}
        aria-invalid={invalid}
        onChange={(e) => onText(e.target.value)}
        onBlur={onSave}
        onKeyDown={onKeyDown}
        className={cn("h-9 ps-6 text-end tabular-nums", invalid && "border-status-over ring-status-over/30")}
      />
    </label>
  );
}
