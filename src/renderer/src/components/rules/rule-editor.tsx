// The rule editor dialog: name, what to match, optional conditions, what to
// do, and an Advanced corner for patterns, with a live preview beside it
// that asks the app what the rule fits today. Saving creates or updates.

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Rule, RuleInput } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { indexCategories } from "@/lib/categories";
import { useAccounts, useCategories, useRulePreview } from "@/lib/hooks";
import { useRuleActions } from "@/lib/rule-actions";
import { checkForm, formFrom, MAX_NAME, MAX_TEXT, type RuleForm } from "@/lib/rule-form";
import { useDebounced } from "@/lib/use-debounced";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Segmented } from "@/components/common/segmented";
import { AccountField, CategoryField, OptionRow, Problem, Section, fieldClass } from "./rule-fields";
import { RulePreview } from "./rule-preview";
import { RuleSentence, useSentenceContext } from "./rule-sentence";

export interface EditorRequest {
  /** An existing rule to edit. */
  rule?: Rule;
  /** A new rule's starting point, e.g. a suggestion from selected rows. */
  draft?: RuleInput;
  /** Show the draft's account and amount span switched off. */
  optIn?: boolean;
}

const PLAIN_MODES = ["contains", "starts_with", "equals"] as const;

export function RuleEditor({
  request,
  open,
  onOpenChange,
}: {
  request: EditorRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const e = s.rules.editor;
  const editing = request.rule ?? null;
  const [form, setForm] = useState<RuleForm>(() => formFrom(request.rule ?? request.draft ?? null, { optIn: request.optIn }));
  const [advanced, setAdvanced] = useState(form.matchMode === "regex" || form.exclusion === "count");
  const [tried, setTried] = useState(false);
  const set = (patch: Partial<RuleForm>) => setForm((f) => ({ ...f, ...patch }));

  const categories = useCategories();
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);
  const accounts = useAccounts();
  const context = useSentenceContext();
  const actions = useRuleActions();

  const check = useMemo(() => checkForm(form), [form]);
  const previewKey = useDebounced(JSON.stringify(check.preview), 250);
  const previewInput = useMemo(() => JSON.parse(previewKey) as RuleInput | null, [previewKey]);
  const preview = useRulePreview(previewInput);
  const broken = previewInput !== null && preview.isError && preview.error instanceof ApiError && preview.error.code === "BAD_REQUEST";
  const regex = form.matchMode === "regex";

  const save = () => {
    setTried(true);
    if (!check.rule) return;
    actions
      .save(editing?.id ?? null, check.rule)
      .then(() => onOpenChange(false))
      .catch(() => undefined);
  };

  const title = editing ? e.editTitle : request.draft ? e.draftTitle : e.newTitle;
  const subtitle = request.draft && !editing ? e.draftSubtitle : e.subtitle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={e.close} className="h-[min(780px,100%)] max-w-[980px]">
        <header className="border-b border-border px-8 pt-6 pb-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="mt-1">{subtitle}</DialogDescription>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_380px]">
          <form
            className="min-h-0 space-y-6 overflow-y-auto px-8 pt-5 pb-8"
            onSubmit={(ev) => {
              ev.preventDefault();
              save();
            }}
          >
            <Section label={e.name}>
              <Input
                value={form.name}
                maxLength={MAX_NAME}
                onChange={(ev) => set({ name: ev.target.value })}
                placeholder={e.namePlaceholder}
                className="h-10 rounded-xl"
                dir="auto"
              />
            </Section>

            <Section label={e.when}>
              <div className="flex flex-wrap items-center gap-2.5">
                <Segmented
                  label={e.when}
                  value={form.matchField}
                  onChange={(matchField) => set({ matchField })}
                  options={(["description", "memo"] as const).map((f) => ({ value: f, label: e.field[f] }))}
                />
                {regex ? (
                  <span className="inline-flex h-9 items-center rounded-full bg-primary/10 px-3.5 text-sm font-medium text-primary">
                    {e.patternMode}
                  </span>
                ) : (
                  <Segmented
                    value={form.matchMode}
                    onChange={(matchMode) => set({ matchMode })}
                    options={PLAIN_MODES.map((m) => ({ value: m, label: e.mode[m] }))}
                  />
                )}
              </div>
              <Input
                value={form.matchText}
                maxLength={MAX_TEXT}
                onChange={(ev) => set({ matchText: ev.target.value })}
                placeholder={regex ? e.patternPlaceholder : e.textPlaceholder}
                className={cn("mt-3 h-11 rounded-xl text-[15px]", regex && "font-mono text-sm")}
                dir="auto"
                autoFocus={!editing && !request.draft}
                spellCheck={false}
              />
              {broken && regex ? <Problem>{e.badPattern}</Problem> : tried && check.problems.text && <Problem>{check.problems.text}</Problem>}
            </Section>

            <Section label={e.onlyWhen} aside={e.optional}>
              <div className="space-y-2.5">
                <OptionRow on={form.useAccount} onToggle={(useAccount) => set({ useAccount })} label={e.account}>
                  <AccountField
                    accounts={accounts.data ?? []}
                    value={form.accountId}
                    onChange={(accountId) => set({ accountId, useAccount: true })}
                  />
                </OptionRow>
                <OptionRow on={form.useAmount} onToggle={(useAmount) => set({ useAmount })} label={e.amount}>
                  <ShekelInput value={form.amountMin} onChange={(amountMin) => set({ amountMin, useAmount: true })} />
                  <span className="text-sm text-muted-foreground">{e.amountAnd}</span>
                  <ShekelInput value={form.amountMax} onChange={(amountMax) => set({ amountMax, useAmount: true })} />
                </OptionRow>
                {form.useAmount && check.problems.amount && <Problem>{check.problems.amount}</Problem>}
                <OptionRow on={form.useDirection} onToggle={(useDirection) => set({ useDirection })} label={e.direction}>
                  <Segmented
                    label={e.direction}
                    value={form.direction}
                    onChange={(direction) => set({ direction, useDirection: true })}
                    options={(["out", "in"] as const).map((d) => ({ value: d, label: e.directionOption[d] }))}
                  />
                </OptionRow>
              </div>
            </Section>

            <Section label={e.then}>
              <div className="space-y-2.5">
                <div className="flex min-h-10 items-center gap-3">
                  <span className="text-sm">{e.category}</span>
                  <div className="ms-auto">
                    <CategoryField index={index} value={form.setCategoryId} onChange={(c) => set({ setCategoryId: c?.id ?? null })} />
                  </div>
                </div>
                <OptionRow
                  on={form.exclusion === "exclude"}
                  onToggle={(on) => set({ exclusion: on ? "exclude" : "none" })}
                  label={e.exclude}
                  hint={e.excludeHint}
                />
              </div>
              {tried && check.problems.action && <Problem>{check.problems.action}</Problem>}
            </Section>

            <section>
              <button
                type="button"
                onClick={() => setAdvanced((a) => !a)}
                aria-expanded={advanced}
                className="-ms-1 inline-flex items-center gap-1 rounded-md px-1 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <ChevronRight className={cn("size-3.5 transition-transform", advanced && "rotate-90")} strokeWidth={2.25} />
                {e.advanced}
              </button>
              {advanced && (
                <div className="mt-3 space-y-2.5 animate-in fade-in-0 slide-in-from-top-1">
                  <OptionRow
                    on={regex}
                    onToggle={(on) => set({ matchMode: on ? "regex" : "contains" })}
                    label={e.regex}
                    hint={e.regexHint}
                  />
                  <OptionRow
                    on={form.exclusion === "count"}
                    onToggle={(on) => set({ exclusion: on ? "count" : "none" })}
                    label={e.alwaysCount}
                    hint={e.alwaysCountHint}
                  />
                </div>
              )}
            </section>
            <button type="submit" hidden />
          </form>

          <aside className="flex min-h-0 flex-col border-s border-border bg-secondary/35">
            <RulePreview
              waiting={previewInput === null && !check.problems.amount}
              data={previewInput ? preview.data : undefined}
              loading={preview.isFetching || JSON.stringify(check.preview) !== previewKey}
              broken={broken}
              index={index}
            >
              <RuleSentence rule={check.draft} context={context} />
            </RulePreview>
          </aside>
        </div>

        <footer className="flex items-center gap-3 border-t border-border px-8 py-4">
          <label className="flex items-center gap-2.5 text-sm">
            <Switch checked={form.enabled} onCheckedChange={(enabled) => set({ enabled })} />
            {e.enabled}
          </label>
          <div className="ms-auto flex items-center gap-2">
            {editing && (
              <Button
                variant="ghost"
                className="text-status-over hover:bg-status-over/10 hover:text-status-over"
                onClick={() => {
                  actions.remove(editing);
                  onOpenChange(false);
                }}
              >
                {s.rules.delete}
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {e.cancel}
            </Button>
            <Button onClick={save} disabled={actions.saving} className="min-w-28">
              {e.save}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function ShekelInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
