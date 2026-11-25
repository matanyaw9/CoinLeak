// The editor's live preview: how many transactions the rule fits today and
// the newest 500 of them, each with the category it has now, and (spec 21)
// how many of them a higher rule decides. Spec 35: each row has a tick box,
// ticked means "this rule changes it", with one box above to tick them all.

import { CircleSlash, Hand, Layers, LoaderCircle, SearchCheck, TextCursorInput, TriangleAlert, type LucideIcon } from "lucide-react";
import type { RulePreview as Preview, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import type { CategoryIndex } from "@/lib/categories";
import { formatDayShort } from "@/lib/format";
import { Checkbox, Skeleton } from "@/components/ui/misc";
import { Money } from "@/components/common/money";
import { CategoryBubble } from "@/components/common/chips";
import { Label } from "@/components/common/card";
import { allState } from "./rule-ticks";

/** The list's tick boxes: what is ticked now, and the clicks. */
export interface PreviewTicks {
  ticked: Set<number>;
  /** Ticked rows the user categorized by hand that saving moves to the rule's category (F45). */
  movesHandSet: number;
  onToggle: (id: number) => void;
  onToggleAll: () => void;
}

export function RulePreview({
  waiting,
  data,
  loading,
  broken,
  index,
  ticks,
  children,
}: {
  /** No text typed yet. */
  waiting: boolean;
  data: Preview | undefined;
  loading: boolean;
  /** The conditions were refused, almost always a pattern that does not work. */
  broken: boolean;
  index: CategoryIndex;
  ticks: PreviewTicks;
  /** The rule's sentence, shown above the matches. */
  children: React.ReactNode;
}) {
  const p = s.rules.preview;
  const t = s.ruleTicks;
  const listed = !waiting && !broken && data !== undefined && data.sample.length > 0;
  const shown = listed ? data.sample.map((row) => row.id) : [];
  const tickedCount = shown.filter((id) => ticks.ticked.has(id)).length;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-7 pt-7">
        <Label>{p.title}</Label>
        <div className="mt-3 flex min-h-8 items-center gap-2">
          {waiting || broken ? (
            <span className="font-heading text-[22px] leading-tight tracking-tight text-muted-foreground/80">
              {p.matches(0)}
            </span>
          ) : data ? (
            <span className={cn("font-heading text-[22px] leading-tight tracking-tight transition-opacity", loading && "opacity-60")}>
              {p.matches(data.matches)}
            </span>
          ) : (
            <Skeleton className="h-7 w-48" />
          )}
          {loading && <LoaderCircle className="size-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="mt-3 text-[13px]">{children}</div>
        {data && data.matches > 0 && !waiting && !broken && <p className="mt-2 text-xs text-muted-foreground">{p.yours}</p>}
        {data && (data.decidedHigher ?? 0) > 0 && !waiting && !broken && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-status-heads-up">
            <Layers className="mt-px size-3.5 shrink-0" />
            {s.ruleOrder.previewHigher(data.decidedHigher ?? 0)}
          </p>
        )}
        {listed && ticks.movesHandSet > 0 && (
          <p data-hand-set className="mt-2 flex items-start gap-1.5 text-xs text-status-heads-up">
            <Hand className="mt-px size-3.5 shrink-0" />
            {t.handSet(ticks.movesHandSet)}
          </p>
        )}
      </div>

      <div className="mt-5 flex min-h-0 flex-1 flex-col border-t border-border/80">
        {listed && (
          <label className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-7 py-2.5">
            <Checkbox checked={allState(shown, ticks.ticked)} onClick={ticks.onToggleAll} aria-label={t.all} />
            <span className={cn("text-[13px] font-medium transition-opacity", loading && "opacity-60")}>
              {t.count(tickedCount, shown.length)}
            </span>
          </label>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">
          {waiting ? (
            <Note icon={TextCursorInput} text={p.typeSomething} />
          ) : broken ? (
            <Note icon={TriangleAlert} text={p.broken} />
          ) : !data ? (
            <div className="space-y-2 px-3 pt-3">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : data.matches === 0 ? (
            <Note icon={CircleSlash} text={p.none} />
          ) : (
            <>
              <ul aria-label={t.listLabel} className={cn("transition-opacity", loading && "opacity-60")}>
                {data.sample.map((row) => (
                  <SampleRow
                    key={row.id}
                    row={row}
                    index={index}
                    ticked={ticks.ticked.has(row.id)}
                    onToggle={() => ticks.onToggle(row.id)}
                  />
                ))}
              </ul>
              {data.more > 0 && (
                <p className="flex items-center justify-center gap-1.5 pt-3 text-xs text-muted-foreground">
                  <SearchCheck className="size-3.5" />
                  {t.more(data.more)}
                </p>
              )}
            </>
          )}
        </div>
        {listed && <p className="border-t border-border/60 px-7 py-3 text-xs text-pretty text-muted-foreground">{t.hint}</p>}
      </div>
    </div>
  );
}

function SampleRow({
  row,
  index,
  ticked,
  onToggle,
}: {
  row: TransactionRow;
  index: CategoryIndex;
  ticked: boolean;
  onToggle: () => void;
}) {
  const category = row.categoryId != null ? index.byId.get(row.categoryId) : undefined;
  const moneyIn = row.amount > 0;
  const day = formatDayShort(row.date);
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-card/70">
        <Checkbox checked={ticked} onClick={onToggle} aria-label={s.ruleTicks.row(row.description, day)} />
        <div className={cn("flex min-w-0 flex-1 items-center gap-3 transition-opacity", !ticked && "opacity-55")}>
          <CategoryBubble category={category} size={30} />
          <div className="min-w-0 flex-1">
            <div dir="auto" className="truncate text-left text-sm font-medium">
              {row.description}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {day} · {category ? category.name : s.common.uncategorized}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <Money
              amount={moneyIn ? row.amount : -row.amount}
              sign={moneyIn}
              className={cn("text-[15px]", moneyIn ? "text-status-on-track" : "text-foreground")}
            />
            {row.categorySource === "user" && (
              <span className="rounded-full bg-status-heads-up/15 px-1.5 py-px text-[11px] leading-4 font-medium whitespace-nowrap text-status-heads-up">
                {s.ruleTicks.setByYou}
              </span>
            )}
          </div>
        </div>
      </label>
    </li>
  );
}

function Note({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center px-8 pt-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl bg-card text-muted-foreground shadow-sm shadow-black/5">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <p className="mt-3 max-w-60 text-sm text-pretty text-muted-foreground">{text}</p>
    </div>
  );
}
