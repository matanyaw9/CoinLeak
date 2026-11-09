// A row's note (spec 20, F48): a small button on the row opens a box to
// write, change or clear it. The right-click menu opens the same box.
// Saves through transactions:update; core trims it and caps the length.

import { useState } from "react";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";
import type { TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { useUpdateTransactions } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { NOTE_MAX } from "./manual-form";

export function NoteButton({
  row,
  open,
  onOpenChange,
}: {
  row: TransactionRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const label = row.note ? s.note.edit : s.note.add;
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={label}
        title={label}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-[opacity,background-color] outline-none hover:bg-accent hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:bg-accent",
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <StickyNote className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        {open && <NoteBox row={row} onDone={() => onOpenChange(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function NoteBox({ row, onDone }: { row: TransactionRow; onDone: () => void }) {
  const [text, setText] = useState(row.note ?? "");
  const update = useUpdateTransactions();
  const tooLong = text.trim().length > NOTE_MAX;
  const send = (note: string | null) =>
    update.mutate(
      { ids: [row.id], patch: { note } },
      {
        onSuccess: () => {
          toast.success(note ? s.note.saved : s.note.cleared);
          onDone();
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : s.errors.crashBody),
      },
    );
  const save = () => send(text.trim() || null);

  return (
    <div>
      <p className="text-sm font-medium">{row.note ? s.note.edit : s.note.add}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{s.note.hint}</p>
      <textarea
        autoFocus
        dir="auto"
        rows={3}
        value={text}
        maxLength={NOTE_MAX}
        placeholder={s.note.placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !tooLong) save();
        }}
        className="mt-3 w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      {tooLong && <p className="mt-1 text-xs text-destructive">{s.note.tooLong(NOTE_MAX)}</p>}
      <div className="mt-3 flex items-center justify-end gap-2">
        {row.note && (
          <Button variant="ghost" size="sm" className="me-auto text-muted-foreground" disabled={update.isPending} onClick={() => send(null)}>
            {s.note.clear}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDone}>
          {s.note.cancel}
        </Button>
        <Button size="sm" disabled={tooLong || update.isPending} onClick={save}>
          {s.note.save}
        </Button>
      </div>
    </div>
  );
}
