// Trash (spec 11): rows the user moved here, newest first. They count
// nowhere until restored. Restore one or many; "Empty trash" deletes them
// for good after asking. Spec 36 (F86): rows select as on Transactions
// (the same selection rules, the box above the list, Ctrl+A, Esc, arrow
// keys), and "Delete for good" deletes only the chosen rows, after asking.

import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import type { TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { useAccounts, useTransactions } from "@/lib/hooks";
import { useRowActions } from "@/lib/review-actions";
import { useShot } from "@/lib/shot";
import { useRoving } from "@/lib/roving";
import { isMac, keyFor } from "@/lib/shortcuts";
import { useShortcuts } from "@/lib/use-shortcuts";
import { Page } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Hint } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { QueryError } from "@/components/common/empty-state";
import { TrashRow } from "@/components/trash/trash-row";
import { checkState, keyTargets } from "@/components/transactions/selection";
import { focusedRowId, useSelection } from "@/components/transactions/use-selection";
import { SelectBox } from "@/components/transactions/day-header";

const FILTER = { flows: ["trashed" as const] };

/** What the confirm dialog asks: empty the whole trash, or delete only these rows. */
type Ask = { all: true } | { all: false; ids: number[] };

export function TrashPage() {
  const tx = useTransactions(FILTER);
  const rows = useMemo(() => tx.data?.rows ?? [], [tx.data]);
  const accounts = useAccounts();
  const accountById = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a])), [accounts.data]);
  const actions = useRowActions();
  // What the dialog asks stays set while it closes, so its text does not change as it fades.
  const [ask, setAsk] = useState<Ask>({ all: true });
  const [asking, setAsking] = useState(false);
  const open = (next: Ask) => {
    setAsk(next);
    setAsking(true);
  };
  const mac = isMac();

  // The same selection as Transactions. Rows that left the trash cannot stay selected.
  const selection = useSelection(rows, "trash");
  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const live = useMemo(() => new Set(allIds.filter((id) => selection.selected.has(id))), [allIds, selection.selected]);
  const allState = checkState(allIds, live);
  const { list, item, guard } = useRoving(allIds, {
    onMove: (from, to, e) => {
      const a = allIds[from];
      const b = allIds[to];
      if (e.shiftKey && a !== undefined && b !== undefined) selection.extend(a, b);
    },
  });

  const askToDelete = (targets: TransactionRow[]) => {
    if (targets.length > 0) open({ all: false, ids: targets.map((r) => r.id) });
  };
  useShortcuts({
    selectAll: rows.length > 0 ? () => selection.selectAll(allIds) : undefined,
    clearSelection: live.size > 0 ? selection.clear : undefined,
    // Delete asks to delete for good: the selected rows, or the one focus is on.
    deleteRows: rows.length > 0 ? () => askToDelete(keyTargets(rows, live, focusedRowId())) : undefined,
  });

  // Screenshot aids open the dialog freshly mounted: the hidden screenshot window never runs its opening fade.
  const [shotKey, setShotKey] = useState(0);
  useDemoShot(
    rows,
    (next) => {
      setShotKey((k) => k + 1);
      open(next);
    },
    selection.set,
  );

  const count = ask.all ? rows.length : ask.ids.length;
  const confirm = () => {
    const done = () => {
      setAsking(false);
      selection.clear();
    };
    if (ask.all) actions.emptyTrash(done);
    else actions.deleteForGood(ask.ids, done);
  };

  return (
    <Page title={s.trash.title}>
      <div className="rounded-3xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            {rows.length > 0 ? `${s.trash.count(rows.length)}. ${s.trash.subtitle}` : s.trash.subtitle}
          </p>
          {live.size > 0 && (
            <>
              <Button size="sm" className="rounded-full" disabled={actions.busy} onClick={() => actions.restore([...live], selection.clear)}>
                <RotateCcw className="size-3.5" />
                {s.trash.restoreSelected(live.size)}
              </Button>
              <Hint label={s.listKeys.does["deleteForGood"]} keys={keyFor("deleteForGood", mac)}>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full text-destructive hover:text-destructive"
                  disabled={actions.busy}
                  onClick={() => askToDelete(rows.filter((r) => live.has(r.id)))}
                >
                  <Trash2 className="size-3.5" />
                  {s.trashSelect.deleteSelected(live.size)}
                </Button>
              </Hint>
            </>
          )}
          {rows.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full text-destructive hover:text-destructive"
              disabled={actions.busy}
              onClick={() => open({ all: true })}
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
          <>
            {/* The box above the list: every row shown, as on Transactions. */}
            <div className="flex h-12 items-center gap-1 border-t border-border">
              <Hint
                label={allState === "all" ? s.selectAll.clear : s.selectAll.all}
                keys={keyFor(allState === "all" ? "clearSelection" : "selectAll", mac)}
              >
                <span className="flex items-center gap-1">
                  <SelectBox
                    state={allState}
                    label={allState === "all" ? s.selectAll.clear : s.trashSelect.selectAll(allIds.length)}
                    onToggle={() => selection.toggleMany(allIds)}
                  />
                  <span className="text-[13px] text-muted-foreground">
                    {live.size > 0 ? s.transactions.selected(live.size) : s.selectAll.all}
                  </span>
                </span>
              </Hint>
            </div>
            <span {...guard("before")} />
            <div ref={list} className="pb-2">
              {rows.map((row, i) => (
                <TrashRow
                  key={row.id}
                  row={row}
                  account={accountById.get(row.accountId)}
                  selected={live.has(row.id)}
                  selecting={live.size > 0}
                  busy={actions.busy}
                  onToggle={selection.toggle}
                  onRestore={() => actions.restore([row.id])}
                  roving={item(i)}
                />
              ))}
            </div>
            <span {...guard("after")} />
          </>
        )}
      </div>

      <Dialog key={shotKey} open={asking} onOpenChange={setAsking}>
        <DialogContent className="max-w-md p-7">
          <DialogTitle>{ask.all ? s.trash.confirmTitle : s.trashSelect.deleteTitle(count)}</DialogTitle>
          <DialogDescription className="mt-2 leading-relaxed">
            {ask.all ? s.trash.confirmBody(count) : s.trashSelect.deleteBody(count)}
          </DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAsking(false)}>
              {ask.all ? s.trash.cancel : s.trashSelect.keep(count)}
            </Button>
            <Button variant="destructive" disabled={actions.busy} onClick={confirm}>
              {s.trash.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

/**
 * Demo screenshot aids: `?shot=confirm` asks to empty the trash. Spec 36:
 * `?shot=select` selects every row but the last and marks the last as
 * focused, and `?shot=delete-selected` asks to delete those for good. The
 * hidden screenshot window runs no transitions and never has focus (see
 * TransactionsPage's `?shot=row-keys`).
 */
function useDemoShot(rows: TransactionRow[], setAsk: (ask: Ask) => void, select: (ids: Set<number>) => void) {
  const shot = useShot();
  const ready = rows.length > 0;
  useEffect(() => {
    if (!ready || (shot !== "confirm" && shot !== "select" && shot !== "delete-selected")) return;
    const id = setTimeout(() => {
      if (shot === "confirm") return setAsk({ all: true });
      const chosen = rows.slice(0, Math.max(1, rows.length - 1)).map((r) => r.id);
      for (const el of document.querySelectorAll<HTMLElement>("[data-row-id], [data-row-id] *")) el.style.transition = "none";
      select(new Set(chosen));
      if (shot === "delete-selected") return setAsk({ all: false, ids: chosen });
      const last = rows.at(-1);
      const row = last && rows.length > 1 ? document.querySelector<HTMLElement>(`[data-row-id="${last.id}"]`) : null;
      row?.setAttribute("data-shot-focus", "");
      row?.querySelector<HTMLElement>("[data-row-focus]")?.focus();
    }, 400);
    return () => clearTimeout(id);
    // Once per load: refreshed rows must not repeat it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, ready]);
}
