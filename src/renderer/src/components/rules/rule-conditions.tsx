// The editor's "If" part: the conditions, each in its own card with a remove
// button, "and" or "or" between them, the all/any switch once there are two,
// an "Add a condition" menu, and a suggestion's account and amount to add.

import { useState, type ReactNode } from "react";
import { ArrowDownUp, Coins, CreditCard, Plus, TextSearch, X, type LucideIcon } from "lucide-react";
import type { Account, RuleCondition, RuleJoin } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { blankCondition, MAX_CONDITIONS, readAmount, type ConditionKind, type FormCondition } from "@/lib/rule-form";
import { conditionPhrase, sentenceText, type SentenceContext } from "@/lib/rule-sentence";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/common/segmented";
import { Label } from "@/components/common/card";
import { AccountField, Problem, fieldClass } from "./rule-fields";
import { ValuesField } from "./values-field";

const PLAIN_MODES = ["contains", "starts_with", "equals"] as const;
const KINDS: { kind: ConditionKind; icon: LucideIcon }[] = [
  { kind: "text", icon: TextSearch },
  { kind: "account", icon: CreditCard },
  { kind: "amount", icon: Coins },
  { kind: "direction", icon: ArrowDownUp },
];

export function RuleConditions({
  join,
  conditions,
  suggested,
  accounts,
  context,
  problems,
  showProblems,
  advanced,
  autoFocus,
  onChange,
}: {
  join: RuleJoin;
  conditions: FormCondition[];
  suggested: FormCondition[];
  accounts: Account[];
  context: SentenceContext;
  problems: Record<number, string>;
  /** After a save was tried, every missing part shows; before, only typing mistakes. */
  showProblems: boolean;
  /** Offers the Pattern mode. */
  advanced: boolean;
  autoFocus: boolean;
  onChange: (patch: { join?: RuleJoin; conditions?: FormCondition[]; suggested?: FormCondition[] }) => void;
}) {
  const e = s.rulesV2.editor;
  const put = (next: FormCondition) => onChange({ conditions: conditions.map((c) => (c.key === next.key ? next : c)) });
  const remove = (key: number) => onChange({ conditions: conditions.filter((c) => c.key !== key) });
  const add = (c: FormCondition) => onChange({ conditions: [...conditions, c] });
  const full = conditions.length >= MAX_CONDITIONS;

  return (
    <section>
      <div className="mb-2.5 flex min-h-8 items-center gap-2">
        <Label>{s.rules.editor.when}</Label>
        {conditions.length > 1 && (
          <Segmented
            className="ms-auto"
            label={e.joinLabel}
            value={join}
            onChange={(next) => onChange({ join: next })}
            options={(["all", "any"] as const).map((j) => ({ value: j, label: e.join[j] }))}
          />
        )}
      </div>

      <ol className="space-y-0">
        {conditions.map((c, i) => {
          const problem = problems[c.key];
          const typingMistake = c.kind === "amount" && problem !== undefined && (c.min !== "" || c.max !== "");
          return (
            <li key={c.key}>
              {i > 0 && (
                <div className="flex h-7 items-center ps-5">
                  <span className="h-full w-px bg-border" />
                  <span className="ms-3 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    {e.joinWord[join]}
                  </span>
                </div>
              )}
              <ConditionCard onRemove={conditions.length > 1 ? () => remove(c.key) : undefined}>
                <ConditionBody condition={c} accounts={accounts} advanced={advanced} autoFocus={autoFocus && i === 0} onChange={put} />
                {problem && (showProblems || typingMistake) && <Problem>{problem}</Problem>}
              </ConditionCard>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <AddCondition disabled={full} onAdd={(kind) => add(blankCondition(kind))} />
        {suggested.length > 0 && (
          <>
            <span className="ms-1 text-xs text-muted-foreground">{e.suggested}</span>
            {suggested.map((c) => (
              <button
                key={c.key}
                type="button"
                disabled={full}
                onClick={() => onChange({ conditions: [...conditions, c], suggested: suggested.filter((x) => x.key !== c.key) })}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-foreground/25 px-3 text-sm text-foreground/85 transition-colors outline-none hover:border-foreground/45 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <Plus className="size-3.5 text-muted-foreground" />
                {suggestionLabel(c, context)}
              </button>
            ))}
          </>
        )}
      </div>
    </section>
  );
}

/** A suggested condition read as a short phrase: "it's on Everyday card ··4821". */
function suggestionLabel(c: FormCondition, context: SentenceContext): string {
  const condition: RuleCondition =
    c.kind === "account"
      ? { kind: "account", accountId: c.accountId ?? 0 }
      : c.kind === "amount"
        ? { kind: "amount", min: readAmount(c.min) ?? null, max: readAmount(c.max) ?? null }
        : c.kind === "direction"
          ? { kind: "direction", direction: c.direction }
          : { kind: "text", field: c.field, mode: c.mode, values: c.values };
  return sentenceText(conditionPhrase(condition, context));
}

function ConditionCard({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <div className="group/condition relative rounded-2xl border border-border bg-card px-4 py-3.5 pe-11 shadow-xs shadow-black/[0.02]">
      {children}
      {onRemove && (
        <button
          type="button"
          aria-label={s.rulesV2.editor.remove}
          onClick={onRemove}
          className="absolute end-2.5 top-3 flex size-7 items-center justify-center rounded-full text-muted-foreground/70 transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function ConditionBody({
  condition: c,
  accounts,
  advanced,
  autoFocus,
  onChange,
}: {
  condition: FormCondition;
  accounts: Account[];
  advanced: boolean;
  autoFocus: boolean;
  onChange: (next: FormCondition) => void;
}) {
  const e = s.rules.editor;
  const v2 = s.rulesV2.editor;
  if (c.kind === "text") {
    const modes = advanced || c.mode === "regex" ? [...PLAIN_MODES, "regex" as const] : PLAIN_MODES;
    return (
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            value={c.field}
            onChange={(field) => onChange({ ...c, field })}
            options={(["description", "memo"] as const).map((f) => ({ value: f, label: e.field[f] }))}
          />
          <Segmented
            value={c.mode}
            onChange={(mode) => onChange({ ...c, mode })}
            options={modes.map((m) => ({ value: m, label: m === "regex" ? v2.pattern : e.mode[m] }))}
          />
        </div>
        <ValuesField
          values={c.values}
          draft={c.draft}
          pattern={c.mode === "regex"}
          autoFocus={autoFocus}
          onChange={(next) => onChange({ ...c, ...next })}
        />
      </div>
    );
  }
  if (c.kind === "account") {
    return (
      <Line label={v2.onAccount}>
        <AccountField accounts={accounts} value={c.accountId} onChange={(accountId) => onChange({ ...c, accountId })} />
      </Line>
    );
  }
  if (c.kind === "amount") {
    return (
      <Line label={v2.amountIs}>
        <ShekelInput value={c.min} onChange={(min) => onChange({ ...c, min })} />
        <span className="text-sm text-muted-foreground">{e.amountAnd}</span>
        <ShekelInput value={c.max} onChange={(max) => onChange({ ...c, max })} />
      </Line>
    );
  }
  return (
    <Line label={v2.directionIs}>
      <Segmented
        label={v2.directionIs}
        value={c.direction}
        onChange={(direction) => onChange({ ...c, direction })}
        options={(["out", "in"] as const).map((d) => ({ value: d, label: e.directionOption[d] }))}
      />
    </Line>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function AddCondition({ disabled, onAdd }: { disabled: boolean; onAdd: (kind: ConditionKind) => void }) {
  const e = s.rulesV2.editor;
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-primary transition-colors outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <Plus className="size-4" />
        {e.addCondition}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        {KINDS.map(({ kind, icon: Icon }) => (
          <button
            key={kind}
            type="button"
            onClick={() => {
              setOpen(false);
              onAdd(kind);
            }}
            className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-start transition-colors outline-none hover:bg-accent focus-visible:bg-accent"
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <span>
              <span className="block text-sm">{e.kind[kind]}</span>
              <span className="block text-xs text-muted-foreground">{e.kindHint[kind]}</span>
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function ShekelInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span className={cn(fieldClass, "w-24 gap-1 px-2.5 focus-within:ring-2 focus-within:ring-ring/40")}>
      <span className="text-muted-foreground">₪</span>
      <input
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        inputMode="decimal"
        placeholder={s.rules.editor.anyAmount}
        className="num w-full min-w-0 bg-transparent text-[15px] outline-none placeholder:font-sans placeholder:text-sm placeholder:text-muted-foreground/70"
        dir="ltr"
      />
    </span>
  );
}
