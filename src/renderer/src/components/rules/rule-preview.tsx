// The editor's live preview: how many transactions the rule fits today and
// the newest 500 of them, each with the category it has now, and (spec 21)
// how many of them a higher rule decides. Spec 35: each row has a tick box,
// ticked means "this rule changes it", with one box above to tick them all.
// Rows the rule would not change have a short label instead of a box. The
// rows are one Tab stop: Up and Down move, Space ticks (F83).

import { Check, CircleSlash, Hand, Layers, LoaderCircle, SearchCheck, TextCursorInput, TriangleAlert, type LucideIcon } from "lucide-react";
import type { RulePreview as Preview, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import type { CategoryIndex } from "@/lib/categories";
import { formatDayShort } from "@/lib/format";
import { useRoving, type RovingItem } from "@/lib/roving";
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
  // Rows the rule would not change have no box (wave 14 review); the rest are
  // the ones the count, the box above and the arrow keys go over.
  const fixed = fixedRows(listed ? data : undefined);
  const boxed = listed ? data.sample.map((row) => row.id).filter((id) => !fixed.has(id)) : [];
  const tickedCount = boxed.filter((id) => ticks.ticked.has(id)).length;
  const { list, item } = useRoving(boxed);
  const boxIndex = new Map(boxed.map((id, i) => [id, i]));
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
        {boxed.length > 0 && (
          <label className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-7 py-2.5">
            <Checkbox checked={allState(boxed, ticks.ticked)} onClick={ticks.onToggleAll} aria-label={t.all} />
            <span className={cn("text-[13px] font-medium transition-opacity", loading && "opacity-60")}>
              {t.count(tickedCount, boxed.length)}
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
              <ul ref={list} aria-label={t.listLabel} className={cn("transition-opacity", loading && "opacity-60")}>
                {data.sample.map((row) => {
                  const why = fixed.get(row.id);
                  if (why) return <FixedRow key={row.id} row={row} index={index} why={why} />;
                  return (
                    <SampleRow
                      key={row.id}
                      row={row}
                      index={index}
                      ticked={ticks.ticked.has(row.id)}
                      onToggle={() => ticks.onToggle(row.id)}
                      roving={item(boxIndex.get(row.id) ?? 0)}
                    />
                  );
                })}
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
        {boxed.length > 0 && <p className="border-t border-border/60 px-7 py-3 text-xs text-pretty text-muted-foreground">{t.hint}</p>}
      </div>
    </div>
  );
}

type FixedWhy = "here" | "higher";

/** Per row id, why the rule would not change it (from the preview), for rows shown without a box. */
function fixedRows(data: Preview | undefined): Map<number, FixedWhy> {
  const out = new Map<number, FixedWhy>();
  for (const id of data?.alreadyHere ?? []) out.set(id, "here");
  for (const id of data?.higherRule ?? []) out.set(id, "higher");
  return out;
}

/** One row: the whole row is its tick box, so a click anywhere or Space ticks it. */
function SampleRow({
  row,
  index,
  ticked,
  onToggle,
  roving,
}: {
  row: TransactionRow;
  index: CategoryIndex;
  ticked: boolean;
  onToggle: () => void;
  roving: RovingItem;
}) {
  // Destructured: React's lint reads `roving.ref` as a ref and then flags the rest.
  const { ref, tabIndex, onFocus, onBlur, onKeyDown } = roving;
  const setByYou = row.categorySource === "user" && (
    <span className="rounded-full bg-status-heads-up/15 px-1.5 py-px text-[11px] leading-4 font-medium whitespace-nowrap text-status-heads-up">
      {s.ruleTicks.setByYou}
    </span>
  );
  return (
    <li>
      <button
        ref={ref}
        tabIndex={tabIndex}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        type="button"
        role="checkbox"
        aria-checked={ticked}
        aria-label={s.ruleTicks.row(row.description, formatDayShort(row.date))}
        onClick={onToggle}
        className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-start outline-none transition-colors hover:bg-card/70 focus-visible:bg-card/70 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <TickMark ticked={ticked} />
        <RowBody row={row} index={index} dim={!ticked} tag={setByYou} />
      </button>
    </li>
  );
}

/** A row the rule would not change: no box, and a short muted label saying why. */
function FixedRow({ row, index, why }: { row: TransactionRow; index: CategoryIndex; why: FixedWhy }) {
  const t = s.ruleTicks;
  const label = (
    <span title={why === "here" ? t.alreadyHereHint : t.higherRuleHint} className="text-[11px] leading-4 whitespace-nowrap text-muted-foreground">
      {why === "here" ? t.alreadyHere : t.higherRule}
    </span>
  );
  return (
    <li data-fixed={why} className="flex items-center gap-3 px-3 py-2.5">
      <span aria-hidden className="size-4 shrink-0" />
      <RowBody row={row} index={index} dim tag={label} />
    </li>
  );
}

/** What every row shows: category bubble, bank text, date and category, amount, and a tag under it. */
function RowBody({ row, index, dim, tag }: { row: TransactionRow; index: CategoryIndex; dim: boolean; tag: React.ReactNode }) {
  const category = row.categoryId != null ? index.byId.get(row.categoryId) : undefined;
  const moneyIn = row.amount > 0;
  return (
    <span className={cn("flex min-w-0 flex-1 items-center gap-3 transition-opacity", dim && "opacity-55")}>
      <CategoryBubble category={category} size={30} />
      <span className="block min-w-0 flex-1">
        <span dir="auto" className="block truncate text-left text-sm font-medium">
          {row.description}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {formatDayShort(row.date)} · {category ? category.name : s.common.uncategorized}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <Money
          amount={moneyIn ? row.amount : -row.amount}
          sign={moneyIn}
          className={cn("text-[15px]", moneyIn ? "text-status-on-track" : "text-foreground")}
        />
        {tag}
      </span>
    </span>
  );
}

/** The box drawn inside a row, looking like the shared Checkbox; the row is the control. */
function TickMark({ ticked }: { ticked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
        ticked ? "border-foreground bg-foreground text-background" : "border-foreground/25 bg-card group-hover:border-foreground/50",
      )}
    >
      {ticked && <Check className="size-3" strokeWidth={3} />}
    </span>
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
