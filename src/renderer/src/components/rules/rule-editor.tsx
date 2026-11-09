// The rule editor dialog: name, the "If" conditions (all or any), what to
// do, the rows sorted by hand it will take over on save (F45), and an
// Advanced corner, with a live preview beside it that asks the app what the
// rule fits today. Saving creates or updates and says how many it sorted.

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Rule, RuleInput } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { indexCategories } from "@/lib/categories";
import { useAccounts, useCategories, useRulePreview } from "@/lib/hooks";
import { useRuleActions } from "@/lib/rule-actions";
import { checkForm, formFrom, MAX_NAME, type RuleForm } from "@/lib/rule-form";
import { useDebounced } from "@/lib/use-debounced";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CategoryField, OptionRow, Problem, Section } from "./rule-fields";
import { HandSetList, handSetIds } from "./hand-set";
import { RuleConditions } from "./rule-conditions";
import { RulePreview } from "./rule-preview";
import { RuleSentence, useSentenceContext } from "./rule-sentence";

export interface EditorRequest {
  /** An existing rule to edit. */
  rule?: Rule;
  /** A new rule's starting point, e.g. a suggestion from selected rows. */
  draft?: RuleInput;
  /** Set the draft's account and amount aside, to add with one click. */
  optIn?: boolean;
}

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
  const [advanced, setAdvanced] = useState(
    form.exclusion === "count" || form.conditions.some((c) => c.kind === "text" && c.mode === "regex"),
  );
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
  const regex = form.conditions.some((c) => c.kind === "text" && c.mode === "regex");
  // Rows sorted by hand that the rule would take over, for the category chosen now.
  const fresh = previewInput !== null && previewInput.setCategoryId === form.setCategoryId && form.setCategoryId !== null;
  const handSet = fresh && form.enabled ? (preview.data?.handSet ?? []) : [];

  const save = () => {
    setTried(true);
    if (!check.rule) return;
    // F45: the listed hand-set rows always go to the rule on save.
    actions
      .save(editing?.id ?? null, check.rule, handSetIds(handSet))
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

            <RuleConditions
              join={form.join}
              conditions={form.conditions}
              suggested={form.suggested}
              accounts={accounts.data ?? []}
              context={context}
              problems={check.problems.conditions}
              showProblems={tried}
              advanced={advanced}
              autoFocus={!editing && !request.draft}
              onChange={set}
            />

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

            <HandSetList rows={handSet} index={index} />

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
                  <p className="text-xs text-muted-foreground">{regex ? e.regexHint : s.rulesV2.editor.patternHint}</p>
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
              waiting={previewInput === null}
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
