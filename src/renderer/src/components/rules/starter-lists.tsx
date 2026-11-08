// "Add starter lists" (spec 13): the lists of common Israeli shops the app
// can offer, each with its category, its names and how many of today's
// transactions it would sort. Nothing is added until the user says so, and
// what is added is ordinary list rules they can edit or delete.

import { useMemo, useState } from "react";
import { ListPlus } from "lucide-react";
import type { StarterList } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { indexCategories, pathOf } from "@/lib/categories";
import { useCategories } from "@/lib/hooks";
import { useAddStarters, useStarters } from "@/lib/rule-actions";
import { Button } from "@/components/ui/button";
import { Checkbox, Skeleton } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CategoryBubble } from "@/components/common/chips";

const NAMES_SHOWN = 7;

export function StarterListsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = s.rulesV2.starters;
  const starters = useStarters(open);
  const add = useAddStarters();
  const categories = useCategories();
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);
  // Keys the user unticked; everything else on offer is in.
  const [off, setOff] = useState<ReadonlySet<string>>(new Set());
  const lists = starters.data?.lists ?? [];
  const chosen = lists.filter((l) => !off.has(l.key));
  const total = chosen.length === lists.length ? (starters.data?.sorts ?? 0) : chosen.reduce((n, l) => n + l.sorts, 0);

  const toggle = (key: string) => {
    const next = new Set(off);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setOff(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={s.rules.editor.close} className="h-[min(760px,100%)] max-w-[760px]">
        <header className="border-b border-border px-8 pt-6 pb-4">
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="mt-1 max-w-xl text-pretty">{t.intro}</DialogDescription>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {!starters.data ? (
            <div className="space-y-2 px-3 pt-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-2xl" />
              ))}
            </div>
          ) : lists.length === 0 ? (
            <p className="px-3 pt-10 text-center text-sm text-muted-foreground">{t.nothing}</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {lists.map((list) => {
                const category = index.byId.get(list.categoryId);
                return (
                  <StarterRow
                    key={list.key}
                    list={list}
                    on={!off.has(list.key)}
                    onToggle={() => toggle(list.key)}
                    categoryName={category ? pathOf(index, category) : ""}
                    bubble={<CategoryBubble category={category} size={36} />}
                  />
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex items-center gap-3 border-t border-border px-8 py-4">
          {lists.length > 0 && (
            <div className="text-sm">
              <div className="font-medium">{t.total(total)}</div>
              <div className="text-xs text-muted-foreground">{t.handSetNote}</div>
            </div>
          )}
          <div className="ms-auto flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.cancel}
            </Button>
            <Button
              className="min-w-28"
              disabled={chosen.length === 0 || add.isPending}
              onClick={() => add.mutate(chosen.map((l) => l.key), { onSuccess: () => onOpenChange(false) })}
            >
              <ListPlus />
              {t.add(chosen.length)}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function StarterRow({
  list,
  on,
  onToggle,
  categoryName,
  bubble,
}: {
  list: StarterList;
  on: boolean;
  onToggle: () => void;
  categoryName: string;
  bubble: React.ReactNode;
}) {
  const t = s.rulesV2.starters;
  const label = t.names[list.key] ?? t.fallbackName;
  return (
    <li className={cn("flex items-start gap-4 px-3 py-4 transition-opacity", !on && "opacity-55")}>
      <Checkbox className="mt-2.5" checked={on} onClick={onToggle} aria-label={label} />
      <div className="shrink-0">{bubble}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-medium">{label}</span>
          <span className="truncate text-xs text-muted-foreground">{t.into(categoryName)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {list.names.slice(0, NAMES_SHOWN).map((n) => (
            <bdi key={n} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
              {n}
            </bdi>
          ))}
          {list.names.length > NAMES_SHOWN && (
            <span className="px-1 py-0.5 text-xs text-muted-foreground">{t.more(list.names.length - NAMES_SHOWN)}</span>
          )}
        </div>
      </div>
      <span
        className={cn(
          "mt-1 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
          list.sorts > 0 ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground",
        )}
      >
        {t.sorts(list.sorts)}
      </span>
    </li>
  );
}
