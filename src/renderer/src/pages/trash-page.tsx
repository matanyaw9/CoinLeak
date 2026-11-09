// Trash (spec 11): rows the user moved here, newest first. They count
// nowhere until restored. Restore one or many; "Empty trash" deletes them
// for good after asking.

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { s } from "@/strings";
import { useAccounts, useTransactions } from "@/lib/hooks";
import { useRowActions } from "@/lib/review-actions";
import { useShot } from "@/lib/shot";
import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { QueryError } from "@/components/common/empty-state";
import { TrashRow } from "@/components/trash/trash-row";

const NONE = new Set<number>();
const FILTER = { flows: ["trashed" as const] };

export function TrashPage() {
  const tx = useTransactions(FILTER);
  const rows = useMemo(() => tx.data?.rows ?? [], [tx.data]);
  const accounts = useAccounts();
  const accountById = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a])), [accounts.data]);
  const actions = useRowActions();
  const [selected, setSelected] = useState<Set<number>>(NONE);
  const [confirming, setConfirming] = useState(false);
  const anchor = useRef<number | null>(null);

  // Rows that left the trash cannot stay selected.
  const live = useMemo(() => new Set([...selected].filter((id) => rows.some((r) => r.id === id))), [selected, rows]);

  const toggle = (id: number, range: boolean) => {
    const ids = new Set(live);
    const on = !ids.has(id);
    const order = rows.map((r) => r.id);
    const from = anchor.current != null ? order.indexOf(anchor.current) : -1;
    const to = order.indexOf(id);
    const span = range && from >= 0 ? order.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
    span.forEach((x) => (on ? ids.add(x) : ids.delete(x)));
    setSelected(ids);
    anchor.current = id;
  };

  useDemoShot(rows.length > 0, setConfirming);

  return (
    <Page title={s.trash.title}>
      <div className="rounded-3xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {rows.length > 0 ? `${s.trash.count(rows.length)}. ${s.trash.subtitle}` : s.trash.subtitle}
          </p>
          {live.size > 0 && (
            <Button
              size="sm"
              className="rounded-full"
              disabled={actions.busy}
              onClick={() => actions.restore([...live], () => setSelected(NONE))}
            >
              <RotateCcw className="size-3.5" />
              {s.trash.restoreSelected(live.size)}
            </Button>
          )}
          {rows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-destructive hover:text-destructive"
              disabled={actions.busy}
              onClick={() => setConfirming(true)}
            >
              <Trash2 className="size-3.5" />
              {s.trash.emptyTrash}
            </Button>
          )}
        </div>

        {tx.isError ? (
          <QueryError error={tx.error} className="border-t border-border" />
        ) : !tx.data ? (
          <div className="space-y-3 border-t border-border px-6 py-5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center gap-3 border-t border-border px-6 py-14 text-sm text-muted-foreground">
            <Trash2 className="size-4 shrink-0" strokeWidth={1.75} />
            {s.trash.empty}
          </div>
        ) : (
          <div className="pb-2">
            {rows.map((row) => (
              <TrashRow
                key={row.id}
                row={row}
                account={accountById.get(row.accountId)}
                selected={live.has(row.id)}
                selecting={live.size > 0}
                busy={actions.busy}
                onToggle={toggle}
                onRestore={() => actions.restore([row.id])}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-md p-7">
          <DialogTitle>{s.trash.confirmTitle}</DialogTitle>
          <DialogDescription className="mt-2 leading-relaxed">{s.trash.confirmBody(rows.length)}</DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {s.trash.cancel}
            </Button>
            <Button
              variant="destructive"
              disabled={actions.busy}
              onClick={() =>
                actions.emptyTrash(() => {
                  setConfirming(false);
                  setSelected(NONE);
                })
              }
            >
              {s.trash.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

/** Demo screenshot aid: `?shot=confirm` asks to empty the trash. */
function useDemoShot(ready: boolean, setConfirming: (open: boolean) => void) {
  const shot = useShot();
  useEffect(() => {
    if (shot !== "confirm" || !ready) return;
    const id = setTimeout(() => setConfirming(true), 400);
    return () => clearTimeout(id);
  }, [shot, ready, setConfirming]);
}
