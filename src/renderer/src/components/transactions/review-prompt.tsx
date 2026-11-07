// The questions a row can ask: "is this a card bill?" and "the bank dropped
// this, delete or keep?" as a soft strip under the row, plus the quiet menu
// on card bills that are not counted.

import { useState } from "react";
import { CircleDashed, CircleHelp, type LucideIcon } from "lucide-react";
import type { TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { cardBillActions, type InternalChoice } from "@/lib/review";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function Strip({
  icon: Icon,
  tone,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  tone: "ask" | "calm";
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl py-2 ps-3.5 pe-2",
        tone === "ask" ? "bg-status-heads-up/10" : "bg-secondary/70",
      )}
    >
      <Icon
        className={cn("size-4 shrink-0", tone === "ask" ? "text-status-heads-up" : "text-muted-foreground")}
        strokeWidth={2}
      />
      <p className="min-w-0 flex-1 truncate text-[13px]">
        <span className="font-medium">{title}</span> <span className="text-muted-foreground">{body}</span>
      </p>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

const pill = "h-8 rounded-full px-3.5 text-[13px] font-medium";

export function CardBillPrompt({
  row,
  busy,
  onAnswer,
}: {
  row: TransactionRow;
  busy: boolean;
  onAnswer: (internal: InternalChoice) => void;
}) {
  return (
    <Strip icon={CircleHelp} tone="ask" title={s.review.cardBillTitle} body={s.review.cardBillBody}>
      {cardBillActions(row).map((a) => (
        <Button key={String(a.internal)} variant="outline" size="sm" className={pill} disabled={busy} onClick={() => onAnswer(a.internal)}>
          {a.label}
        </Button>
      ))}
    </Strip>
  );
}

export function GonePrompt({ busy, onDelete, onKeep }: { busy: boolean; onDelete: () => void; onKeep: () => void }) {
  return (
    <Strip icon={CircleDashed} tone="calm" title={s.review.goneTitle} body={s.review.goneBody}>
      <Button variant="outline" size="sm" className={pill} disabled={busy} onClick={onDelete}>
        {s.review.delete}
      </Button>
      <Button variant="outline" size="sm" className={pill} disabled={busy} onClick={onKeep}>
        {s.review.keep}
      </Button>
    </Strip>
  );
}

/** "Counted on the card" in the category column, opening the two answers. */
export function InternalMenu({
  row,
  busy,
  onAnswer,
}: {
  row: TransactionRow;
  busy: boolean;
  onAnswer: (internal: InternalChoice) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-8 max-w-full items-center rounded-full px-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50">
        <span className="truncate">{s.transactions.reason.internalColumn}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="px-4 pt-4 pb-3">
          <p className="text-sm font-medium">{s.review.internalTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-pretty text-muted-foreground">{s.transactions.reason.internalHint}</p>
        </div>
        <div className="border-t border-border p-1.5">
          {cardBillActions(row).map((a) => (
            <button
              key={String(a.internal)}
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                onAnswer(a.internal);
              }}
              className="flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-accent disabled:opacity-50"
            >
              <span className="text-sm">{a.label}</span>
              {a.hint && <span className="text-xs text-muted-foreground">{a.hint}</span>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
