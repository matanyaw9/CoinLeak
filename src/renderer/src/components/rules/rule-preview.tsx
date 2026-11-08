// The editor's live preview: how many transactions the rule fits today and
// the newest of them, each with the category it has now.

import { CircleSlash, LoaderCircle, SearchCheck, TextCursorInput, TriangleAlert, type LucideIcon } from "lucide-react";
import type { RulePreview as Preview, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import type { CategoryIndex } from "@/lib/categories";
import { formatDayShort } from "@/lib/format";
import { Skeleton } from "@/components/ui/misc";
import { Money } from "@/components/common/money";
import { CategoryBubble } from "@/components/common/chips";
import { Label } from "@/components/common/card";

export function RulePreview({
  waiting,
  data,
  loading,
  broken,
  index,
  children,
}: {
  /** No text typed yet. */
  waiting: boolean;
  data: Preview | undefined;
  loading: boolean;
  /** The conditions were refused, almost always a pattern that does not work. */
  broken: boolean;
  index: CategoryIndex;
  /** The rule's sentence, shown above the matches. */
  children: React.ReactNode;
}) {
  const p = s.rules.preview;
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
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto border-t border-border/80 px-4 pt-2 pb-4">
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
            <ul className={cn("transition-opacity", loading && "opacity-60")}>
              {data.sample.map((row) => (
                <SampleRow key={row.id} row={row} index={index} />
              ))}
            </ul>
            {p.newest(data.sample.length, data.matches) && (
              <p className="flex items-center justify-center gap-1.5 pt-3 text-xs text-muted-foreground">
                <SearchCheck className="size-3.5" />
                {p.newest(data.sample.length, data.matches)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SampleRow({ row, index }: { row: TransactionRow; index: CategoryIndex }) {
  const category = row.categoryId != null ? index.byId.get(row.categoryId) : undefined;
  const moneyIn = row.amount > 0;
  return (
    <li className="flex items-center gap-3 rounded-xl px-3 py-2.5">
      <CategoryBubble category={category} size={30} />
      <div className="min-w-0 flex-1">
        <div dir="auto" className="truncate text-left text-sm font-medium">
          {row.description}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {formatDayShort(row.date)} · {category ? category.name : s.common.uncategorized}
          {row.categorySource === "user" && ` · ${s.rules.preview.setByYou}`}
        </div>
      </div>
      <Money
        amount={moneyIn ? row.amount : -row.amount}
        sign={moneyIn}
        className={cn("text-[15px]", moneyIn ? "text-status-on-track" : "text-foreground")}
      />
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
