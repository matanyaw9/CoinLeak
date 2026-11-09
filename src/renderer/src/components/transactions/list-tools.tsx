// The Transactions toolbar pieces for spec 17 (F23): a sort menu, a filter
// popover (category, money account, kind, status), and the active filters
// as chips with an X each and "Clear all".

import { Menu } from "@base-ui/react/menu";
import { ArrowDownUp, Check, ListFilter, X } from "lucide-react";
import type { Account, TransactionSort } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { colorOf, type CategoryIndex } from "@/lib/categories";
import { accountLabel } from "@/components/common/chips";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FLOW_CHOICES, SORTS, clearFilters, toggle, type FilterChip, type FlowChoice, type ListView } from "./list-view";

const PILL =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50";
const pill = (on: boolean) =>
  cn(PILL, on ? "border-foreground/20 bg-accent text-foreground" : "border-border bg-background text-muted-foreground");

export function SortMenu({ value, onChange }: { value: TransactionSort; onChange: (sort: TransactionSort) => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger aria-label={s.txTools.sort.label} className={pill(value !== "date")}>
        <ArrowDownUp className="size-3.5" />
        {s.txTools.sort[value]}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="isolate z-50" side="bottom" align="start" sideOffset={6}>
          <Menu.Popup className="z-50 min-w-48 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg shadow-black/10 outline-none dark:shadow-black/40">
            {SORTS.map((sort) => (
              <Menu.Item
                key={sort}
                onClick={() => onChange(sort)}
                className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-accent"
              >
                <span className="flex-1">{s.txTools.sort[sort]}</span>
                {sort === value && <Check className="size-3.5 text-primary" />}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={on}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-start text-sm transition-colors outline-none hover:bg-accent focus-visible:bg-accent"
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-[5px] border-[1.5px]",
          on ? "border-foreground bg-foreground text-background" : "border-foreground/30",
        )}
      >
        {on && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pb-1">
      <div className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{title}</div>
      {children}
    </div>
  );
}

export function FilterMenu({
  view,
  onChange,
  index,
  accounts,
  walletId = null,
  defaultOpen,
}: {
  view: ListView;
  onChange: (view: ListView) => void;
  index: CategoryIndex;
  accounts: Account[];
  /** The cash wallet's account id, offered as "Cash" when there is one. */
  walletId?: number | null;
  /** Demo screenshots: open at once. */
  defaultOpen?: boolean;
}) {
  const f = s.txTools.filter;
  const count = view.categories.length + view.accounts.length + view.flows.length + (view.pending ? 1 : 0);
  const cat = (id: number | null) => onChange({ ...view, categories: toggle(view.categories, id) });
  return (
    <Popover defaultOpen={defaultOpen}>
      <PopoverTrigger className={pill(count > 0)}>
        <ListFilter className="size-3.5" />
        {f.button}
        {count > 0 && <span className="rounded-full bg-foreground/10 px-1.5 text-[11px] leading-4 font-semibold tabular-nums">{count}</span>}
      </PopoverTrigger>
      <PopoverContent align="start" className="grid w-[34rem] grid-cols-2 gap-x-2 p-1.5">
        <div className="max-h-[27rem] overflow-y-auto">
          <Section title={f.categories}>
            <Option on={view.categories.includes(null)} onClick={() => cat(null)}>
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(null) }} />
              {s.common.uncategorized}
            </Option>
            {index.roots.map((root) => (
              <div key={root.id}>
                <Option on={view.categories.includes(root.id)} onClick={() => cat(root.id)}>
                  <span className="w-4 shrink-0 text-center leading-none">{root.emoji}</span>
                  <span className="truncate">{root.name}</span>
                </Option>
                {(index.children.get(root.id) ?? []).map((c) => (
                  <div key={c.id} className="ps-5">
                    <Option on={view.categories.includes(c.id)} onClick={() => cat(c.id)}>
                      <span className="truncate">{c.name}</span>
                    </Option>
                  </div>
                ))}
              </div>
            ))}
          </Section>
        </div>
        <div className="max-h-[27rem] overflow-y-auto border-s border-border ps-1.5">
          <Section title={f.flow}>
            {(Object.keys(FLOW_CHOICES) as FlowChoice[]).map((flow) => (
              <Option key={flow} on={view.flows.includes(flow)} onClick={() => onChange({ ...view, flows: toggle(view.flows, flow) })}>
                {s.txTools.flows[flow]}
              </Option>
            ))}
          </Section>
          <Section title={f.other}>
            <Option on={view.pending} onClick={() => onChange({ ...view, pending: !view.pending })}>
              {f.pending}
            </Option>
            <Option on={view.review} onClick={() => onChange({ ...view, review: !view.review })}>
              {f.review}
            </Option>
          </Section>
          <Section title={f.accounts}>
            {accounts.length === 0 && walletId === null && <p className="px-2 py-1.5 text-xs text-muted-foreground">{f.noAccounts}</p>}
            {accounts.map((a) => (
              <Option key={a.id} on={view.accounts.includes(a.id)} onClick={() => onChange({ ...view, accounts: toggle(view.accounts, a.id) })}>
                <span className="truncate">{accountLabel(a)}</span>
              </Option>
            ))}
            {walletId !== null && (
              <Option on={view.accounts.includes(walletId)} onClick={() => onChange({ ...view, accounts: toggle(view.accounts, walletId) })}>
                <span className="truncate">{s.cash.chip}</span>
              </Option>
            )}
          </Section>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FilterChips({ chips, view, onChange }: { chips: FilterChip[]; view: ListView; onChange: (view: ListView) => void }) {
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 pb-4">
      <span className="text-sm text-muted-foreground">{s.transactions.filteredBy}</span>
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background ps-3 pe-1 text-sm font-medium"
        >
          <span dir="auto" className="inline-flex items-center gap-2">
            {chip.category !== undefined && (
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(chip.category) }} />
            )}
            {chip.category?.emoji && <span className="leading-none">{chip.category.emoji}</span>}
            {chip.text}
          </span>
          <button
            type="button"
            aria-label={s.txTools.filter.remove(chip.text)}
            onClick={() => onChange(chip.remove)}
            className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => onChange(clearFilters(view))}
        className="ms-1 rounded-full px-2 py-1 text-sm text-muted-foreground underline-offset-2 transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {s.txTools.filter.clearAll}
      </button>
    </div>
  );
}
