// Transactions: the chosen period's rows grouped by day, with search, a needs-review
// view, a category filter from Home, quick categorizing, bulk select, and the
// card bill and gone-row answers. Greets instead before the first sync.
// Spec 11: the row menu (rule, ignore, trash), card bills hidden behind a
// toggle, and the "Always put X in Y?" offer after sorting a row by hand.
// Spec 17: the period's Income, Spent and Left on top, sort and filters kept
// in the URL, a click on a row's category filters to it, and Ctrl+F.
// Spec 20: select all (top and per day), notes, and cash rows typed by hand.
// Spec 31: Ctrl+A and Esc, and the column headers that sort the list.
// The pieces live in components/transactions; this page wires them together.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeftRight, CircleCheck, Plus, Search, SearchX } from "lucide-react";
import type { Category, TransactionFilter, TransactionRow as Row } from "@shared/types";
import { s } from "@/strings";
import { showFailure } from "@/lib/failure";
import { cn } from "@/lib/utils";
import {
  useAccounts,
  useCashWallet,
  useCategories,
  useFirstRun,
  useTransactions,
  useUpdateTransactions,
} from "@/lib/hooks";
import { useKept, useReviewActions, useRowActions } from "@/lib/review-actions";
import { useAddKnownPlace } from "@/lib/rule-actions";
import { allIgnored, menuTargets, shouldOfferRule, suggestFor } from "@/lib/review-rows";
import { useShot } from "@/lib/shot";
import { usePeriod } from "@/lib/month-context";
import { usePeriodSummary } from "@/components/home/period-data";
import { rangeLabel } from "@/components/home/period-words";
import { shiftMonth } from "@/lib/month";
import { indexCategories } from "@/lib/categories";
import { groupByDay } from "@/lib/day-groups";
import { Page } from "@/components/layout/page";
import { Input, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/common/segmented";
import { EmptyState, QueryError } from "@/components/common/empty-state";
import { Welcome } from "@/components/common/welcome";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { BulkBar } from "@/components/transactions/bulk-bar";
import { SummaryBar } from "@/components/transactions/summary-bar";
import { FilterChips, FilterMenu } from "@/components/transactions/list-tools";
import { ListHeader } from "@/components/transactions/list-header";
import { chipsFor, clearFilters, groupsByDay, onlyCategory, readView, toFilter, writeView, type ListView } from "@/components/transactions/list-view";
import { isMac, onFind, takeFindRequest } from "@/components/transactions/find";
import { keyFor } from "@/lib/shortcuts";
import { useShortcuts } from "@/lib/use-shortcuts";
import { Hint } from "@/components/ui/tooltip";
import { useRuleEditor } from "@/components/rules/rule-editor-provider";
import { checkState } from "@/components/transactions/selection";
import { useSelection } from "@/components/transactions/use-selection";
import { DayHeader, SelectBox } from "@/components/transactions/day-header";
import { rowMenu, type RowMenuActions } from "@/components/transactions/row-menu-entries";
import { offerRule } from "@/components/transactions/rule-offer";
import { useDemoShot } from "@/components/transactions/demo-shot";
import { ManualDialog } from "@/components/transactions/manual-dialog";

const failed = (e: unknown) => showFailure(e, s.errors.failed.update);

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function TransactionsPage() {
  const { choice, range, showMonth } = usePeriod();
  const [params, setParams] = useSearchParams();
  const view = useMemo(() => readView(params), [params]);
  const review = view.review;
  const [search, setSearch] = useState("");
  const [showBills, setShowBills] = useState(false);
  const query = useDebounced(search.trim(), 200);
  const searchBox = useRef<HTMLInputElement>(null);
  const shotName = useShot();

  // Ctrl+F (spec 17): focus and select the box, now or on arrival.
  const focusSearch = useCallback(() => {
    searchBox.current?.focus();
    searchBox.current?.select();
  }, []);
  useEffect(() => {
    if (takeFindRequest()) focusSearch();
    return onFind(focusSearch);
  }, [focusSearch]);

  const categories = useCategories();
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);
  const accounts = useAccounts();
  const accountById = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a])), [accounts.data]);
  const walletId = useCashWallet().data?.id ?? null;
  const summary = usePeriodSummary(range);

  // Card bills never count, so they stay out of the way unless asked for.
  const filter = useMemo<TransactionFilter>(
    () => toFilter(view, index, { ...range, search: query, showBills }),
    [view, index, range, query, showBills],
  );
  const tx = useTransactions(filter);
  const bills = useTransactions({ ...filter, hideInternal: undefined, sort: undefined, flows: ["internal"] });
  const billCount = view.flows.length ? 0 : (bills.data?.rows.length ?? 0);
  const rows = useMemo(() => tx.data?.rows ?? [], [tx.data]);
  const byDay = groupsByDay(view.sort);
  const groups = useMemo(
    () => (byDay ? groupByDay(rows, tx.data?.days) : [{ date: "", rows, spent: 0, income: 0 }]),
    [rows, byDay, tx.data],
  );
  const chips = chipsFor(view, index, accountById, walletId);
  const update = useUpdateTransactions();
  const actions = useReviewActions();
  const kept = useKept();
  const firstRun = useFirstRun();
  const rowActions = useRowActions();
  const { openEditor } = useRuleEditor();
  const addKnownPlace = useAddKnownPlace();

  // Selection belongs to one filter; changing month or filters starts fresh.
  const selection = useSelection(rows, JSON.stringify(filter));
  const selected = selection.selected;
  const selectedRows = rows.filter((r) => selected.has(r.id));
  // spec 20: the box above the list (hidden card bills are not in `rows`).
  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allState = checkState(allIds, selected);
  const mac = isMac();

  // spec 31: Ctrl+A selects the rows the top box would; Esc clears them.
  useShortcuts({
    selectAll: rows.length > 0 ? () => selection.selectAll(allIds) : undefined,
    clearSelection: selected.size > 0 ? selection.clear : undefined,
  });
  // Screenshot aid (dev start route only): `?shot=ctrl-a` presses Ctrl+A.
  const listed = rows.length > 0;
  useEffect(() => {
    if (shotName !== "ctrl-a" || !listed) return;
    const id = setTimeout(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", code: "KeyA", ctrlKey: true })), 400);
    return () => clearTimeout(id);
  }, [shotName, listed]);

  // spec 20: the note box of one row, and the cash form (a row to edit, or null to add).
  const [noteRow, setNoteRow] = useState<number | null>(null);
  const [cashForm, setCashForm] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null });

  const makeRule = (targets: Row[], category?: Category) =>
    suggestFor(targets.map((r) => r.id), category).then((draft) => openEditor({ draft, optIn: true }), failed);

  const offer = (row: Row, category: Category, still = false) =>
    offerRule(
      row,
      category,
      { addKnownPlace: () => addKnownPlace(row.description, category), makeRule: () => void makeRule([row], category) },
      still,
    );

  const categorize = (ids: number[], category: Category | null, one?: Row) => {
    const offered = one !== undefined && shouldOfferRule(one, category);
    update.mutate(
      { ids, patch: { categoryId: category?.id ?? null } },
      {
        onSuccess: ({ updated }) => {
          if (offered && one && category) offer(one, category);
          else toast.success(category ? s.transactions.categorized(category.name, updated) : s.transactions.uncategorizedDone(updated));
          selection.clear();
        },
        onError: failed,
      },
    );
  };
  const onRowCategory = (row: Row, c: Category | null) => categorize([row.id], c, row);

  const menuActions: RowMenuActions = {
    makeRule: (targets) => void makeRule(targets),
    addKnownPlace,
    openNote: setNoteRow,
    editCash: (row) => setCashForm({ open: true, row }),
    setIgnored: rowActions.setIgnored,
    trash: rowActions.trash,
    clearSelection: selection.clear,
  };
  const menuFor = (row: Row) => rowMenu(row, menuTargets(row, selected, rows), index, menuActions);

  const shot = useDemoShot(rows, {
    select: selection.set,
    setShowBills,
    lastMonth: () => showMonth(shiftMonth(choice.month, -1)),
    offerRule: offer,
    index,
    openNote: setNoteRow,
    openCash: () => setCashForm({ open: true, row: null }),
  });

  const setView = (next: ListView) => setParams((p) => writeView(p, next), { replace: true });

  const filtered = Boolean(query) || chips.length > 0;
  const reviewCount = summary.data?.needsReview ?? 0;

  if (firstRun) {
    return (
      <Page title={s.transactions.title}>
        <Welcome onAddCash={() => setCashForm({ open: true, row: null })} />
        <ManualDialog
          open={cashForm.open}
          onOpenChange={(open) => setCashForm((f) => ({ ...f, open }))}
          row={null}
          index={index}
        />
      </Page>
    );
  }

  return (
    <Page title={s.transactions.title} withMonth>
      <SummaryBar summary={summary.data} current={summary.data?.inProgress ?? false} />
      <div className="rounded-3xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <Segmented
            value={review ? "review" : "all"}
            onChange={(v) => setView({ ...view, review: v === "review" })}
            options={[
              { value: "all", label: s.transactions.all },
              {
                value: "review",
                label: (
                  <>
                    {s.transactions.needsReview}
                    {reviewCount > 0 && (
                      <span className="rounded-full bg-status-heads-up/20 px-1.5 text-[11px] leading-4 font-semibold tabular-nums">
                        {reviewCount}
                      </span>
                    )}
                  </>
                ),
              },
            ]}
          />
          <FilterMenu view={view} onChange={setView} index={index} accounts={accounts.data ?? []} walletId={walletId} defaultOpen={shotName === "filters"} />
          {(billCount > 0 || showBills) && (
            <Hint label={s.cardBills.hint}>
              <button
                type="button"
                aria-pressed={showBills}
                onClick={() => setShowBills((v) => !v)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50",
                  showBills ? "border-foreground/20 bg-accent text-foreground" : "border-border bg-background text-muted-foreground",
                )}
              >
                <ArrowLeftRight className="size-3.5" />
                {showBills ? s.cardBills.hide : s.cardBills.show(billCount)}
              </button>
            </Hint>
          )}
          <label className="relative ms-auto w-72">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchBox}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearch("")}
              placeholder={s.transactions.searchPlaceholder}
              className="h-9 rounded-full bg-background ps-9"
            />
          </label>
        </div>
        <FilterChips chips={chips} view={view} onChange={setView} />
        {/* spec 20: select every row shown, and add a cash row. Spec 31: the
            column headers below it, both staying in view while the list scrolls. */}
        {tx.data && (
          <div className="sticky top-16 z-10 bg-card">
            <div className="flex h-12 items-center gap-1 border-t border-border pe-4">
              {rows.length > 0 && (
                <Hint
                  label={allState === "all" ? s.selectAll.clear : s.selectAll.all}
                  keys={keyFor(allState === "all" ? "clearSelection" : "selectAll", mac)}
                >
                  <span className="flex items-center gap-1">
                    <SelectBox
                      state={allState}
                      label={allState === "all" ? s.selectAll.clear : s.selectAll.allShown(allIds.length)}
                      onToggle={() => selection.toggleMany(allIds)}
                    />
                    <span className="text-[13px] text-muted-foreground">
                      {selected.size > 0 ? s.transactions.selected(selected.size) : s.selectAll.all}
                    </span>
                  </span>
                </Hint>
              )}
              <Hint label={s.cash.addHint}>
                <Button variant="ghost" size="sm" className="ms-auto rounded-full" onClick={() => setCashForm({ open: true, row: null })}>
                  <Plus />
                  {s.cash.add}
                </Button>
              </Hint>
            </div>
            {rows.length > 0 && <ListHeader sort={view.sort} onSort={(sort) => setView({ ...view, sort })} />}
          </div>
        )}

        {tx.isError ? (
          <QueryError error={tx.error} className="border-t border-border" />
        ) : !tx.data ? (
          <div className="space-y-3 border-t border-border px-6 py-5">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="border-t border-border">
            {review && !filtered ? (
              <EmptyState icon={CircleCheck} title={s.transactions.reviewDoneTitle} body={s.transactions.reviewDoneBody} />
            ) : filtered ? (
              <EmptyState
                icon={SearchX}
                title={s.transactions.noMatchTitle}
                body={s.transactions.noMatchBody}
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setView({ ...clearFilters(view), review });
                    }}
                  >
                    {s.common.clear}
                  </Button>
                }
              />
            ) : (
              <EmptyState title={s.transactions.emptyTitle(rangeLabel(range))} body={s.transactions.emptyBody} />
            )}
          </div>
        ) : (
          <div className={cn("pb-2 transition-opacity", tx.isPlaceholderData && "opacity-60")}>
            {groups.map((g) => (
              <Fragment key={g.date}>
                {byDay && <DayHeader group={g} selected={selected} onToggle={selection.toggleMany} />}
                {g.rows.map((row) => (
                  <TransactionRow
                    key={row.id}
                    row={row}
                    account={accountById.get(row.accountId)}
                    index={index}
                    selected={selected.has(row.id)}
                    selecting={selected.size > 0}
                    onToggle={selection.toggle}
                    onCategory={onRowCategory}
                    menu={() => menuFor(row)}
                    menuOpen={shot.menuRow === row.id}
                    hintOpen={shot.hintRow === row.id}
                    showDate={!byDay}
                    onFilterCategory={(id) => setView(onlyCategory(view, id))}
                    noteOpen={noteRow === row.id}
                    onNoteOpenChange={(open) => setNoteRow(open ? row.id : null)}
                    review={{
                      reviewing: review,
                      kept: kept.has(row.id),
                      busy: actions.busy(row),
                      onAnswer: actions.answer,
                      onDelete: actions.remove,
                      onKeep: actions.keep,
                    }}
                  />
                ))}
              </Fragment>
            ))}
          </div>
        )}
      </div>
      {tx.data && rows.length > 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">{s.transactions.count(rows.length)}</p>
      )}

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          pending={update.isPending || rowActions.busy}
          index={index}
          ignored={allIgnored(selectedRows)}
          onCategory={(c) => categorize([...selected], c)}
          onMakeRule={() => void makeRule(selectedRows)}
          onIgnore={() => rowActions.setIgnored(selectedRows, !allIgnored(selectedRows), selection.clear)}
          onTrash={() => rowActions.trash(selectedRows, selection.clear)}
          onClear={selection.clear}
        />
      )}
      <ManualDialog
        open={cashForm.open}
        onOpenChange={(open) => setCashForm((f) => ({ ...f, open }))}
        row={cashForm.row}
        index={index}
      />
    </Page>
  );
}
