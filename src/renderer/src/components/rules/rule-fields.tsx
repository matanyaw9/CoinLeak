// Building blocks of the rule editor's form: a titled section, an optional
// condition with its checkbox, a hint line, and the account and category
// fields that open a soft popover list.

import { useState, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Account, Category } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { pathOf, type CategoryIndex } from "@/lib/categories";
import { accountName } from "@/lib/rule-sentence";
import { Checkbox } from "@/components/ui/misc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CategoryBubble, ProviderBadge } from "@/components/common/chips";
import { Label } from "@/components/common/card";
import { CategoryPicker } from "@/components/transactions/category-picker";

export const fieldClass =
  "inline-flex h-10 min-w-0 items-center gap-2.5 rounded-xl border border-input bg-card px-3 text-sm transition-colors outline-none hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring/40";

export function Section({ label, aside, children }: { label: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline gap-2">
        <Label>{label}</Label>
        {aside && <span className="text-[11px] text-muted-foreground/80">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export function Problem({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-[13px] text-status-over">{children}</p>;
}

/** A checkbox, its label, and the control it switches on; using the control switches it on too. */
export function OptionRow({
  on,
  onToggle,
  label,
  hint,
  children,
}: {
  on: boolean;
  onToggle: (on: boolean) => void;
  label: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center gap-3">
      <label className="flex min-w-0 shrink-0 items-center gap-3 py-1 text-sm">
        <Checkbox checked={on} onClick={() => onToggle(!on)} aria-label={label} />
        <span className="flex flex-col">
          <span className={cn("transition-colors", !on && "text-foreground/75")}>{label}</span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </span>
      </label>
      {children && (
        <div className={cn("ms-auto flex min-w-0 items-center gap-2 transition-opacity", !on && "opacity-55 hover:opacity-80")}>
          {children}
        </div>
      )}
    </div>
  );
}

export function AccountField({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: number | null;
  onChange: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = accounts.find((a) => a.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(fieldClass, "w-60")}>
        {current ? (
          <>
            <ProviderBadge provider={current.provider} size={18} />
            <span className="min-w-0 flex-1 truncate text-start">{accountName(current)}</span>
          </>
        ) : (
          <span className="flex-1 text-start text-muted-foreground">{s.rules.editor.chooseAccount}</span>
        )}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1.5">
        {accounts.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => {
              setOpen(false);
              onChange(a.id);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-start text-sm transition-colors hover:bg-accent"
          >
            <ProviderBadge provider={a.provider} size={18} />
            <span className="min-w-0 flex-1 truncate">{accountName(a)}</span>
            {a.id === value && <Check className="size-3.5 text-primary" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function CategoryField({
  index,
  value,
  onChange,
}: {
  index: CategoryIndex;
  value: number | null;
  onChange: (category: Category | null) => void;
}) {
  const current = value != null ? index.byId.get(value) : undefined;
  return (
    <CategoryPicker index={index} value={value} onSelect={onChange} align="end" triggerClassName={cn(fieldClass, "w-60")}>
      {current ? (
        <>
          <CategoryBubble category={current} size={24} />
          <span className="min-w-0 flex-1 truncate text-start">{pathOf(index, current)}</span>
        </>
      ) : (
        <span className="flex-1 text-start text-muted-foreground">{s.rules.editor.chooseCategory}</span>
      )}
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
    </CategoryPicker>
  );
}
