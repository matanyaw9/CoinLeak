// Transactions: the chosen period's rows grouped by day, with search, a needs-review
// view, a category filter from Home, quick categorizing, bulk select, and the
// card bill and gone-row answers. Greets instead before the first sync.
// Spec 11: the row menu (rule, ignore, trash), card bills hidden behind a
// toggle, and the "Always put X in Y?" offer after sorting a row by hand.
// Spec 17: the period's Income, Spent and Left on top, sort and filters kept
// in the URL, a click on a row's category filters to it, and Ctrl+F.

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { ArrowLeftRight, CircleCheck, Eye, EyeOff, ListPlus, Search, SearchX, Trash2, WandSparkles } from "lucide-react";
import type { Category, TransactionFilter, TransactionRow as Row } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import {
  useAccounts,
  useCategories,
  useFirstRun,
  useTransactions,
  useUpdateTransactions,
} from "@/lib/hooks";
import { useKept, useReviewActions, useRowActions } from "@/lib/review-actions";
import { useAddKnownPlace } from "@/lib/rule-actions";
import { allIgnored, menuTargets, shouldOfferRule, suggestFor } from "@/lib/review-rows";
import { useShot } from "@/lib/shot";
import { useMonth, usePeriod } from "@/lib/month-context";
import { usePeriodSummary } from "@/components/home/period-data";
import { rangeLabel } from "@/components/home/period-words";
import { shiftMonth } from "@/lib/month";
import { formatDayLong } from "@/lib/format";
import { indexCategories, type CategoryIndex } from "@/lib/categories";
import { groupByDay } from "@/lib/day-groups";
import { Page } from "@/components/layout/page";
import { Input, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/common/segmented";
import { EmptyState, QueryError } from "@/components/common/empty-state";
import { Money } from "@/components/common/money";
import { Welcome } from "@/components/common/welcome";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { BulkBar } from "@/components/transactions/bulk-bar";
import type { RowMenuModel } from "@/components/transactions/row-menu";
import { SummaryBar } from "@/components/transactions/summary-bar";
import { FilterChips, FilterMenu, SortMenu } from "@/components/transactions/list-tools";
import { chipsFor, clearFilters, onlyCategory, readView, toFilter, writeView, type ListView } from "@/components/transactions/list-view";
import { onFind, takeFindRequest } from "@/components/transactions/find";
import { Hint } from "@/components/ui/tooltip";
import { useRuleEditor } from "@/components/rules/rule-editor-provider";

const NONE = new Set<number>();
// The offer's X sits inside the top right corner, not on sonner's outer edge.
const OFFER_CLOSE =
  "!left-auto !right-2 !top-2 !size-6 !transform-none !border-0 !bg-transparent !text-muted-foreground hover:!bg-accent hover:!text-foreground [&>svg]:!size-3.5";
const failed = (e: unknown) => toast.error(e instanceof ApiError ? e.message : s.errors.crashBody);

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function TransactionsPage() {
  const { month, setMonth } = useMonth();
  const { range } = usePeriod();
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
  const summary = usePeriodSummary(range);

  // Card bills never count, so they stay out of the way unless asked for.
  const filter = useMemo<TransactionFilter>(
    () => toFilter(view, index, { ...range, search: query, showBills }),
    [view, index, range, query, showBills],
  );
  const tx = useTransactions(filter);
  const bills = useTransactions({ ...filter, hideInternal: undefined, sort: undefined, flows: ["internal"] });
  const billCount = view.flows.length ? 0 : (bills.data?.length ?? 0);
  const rows = useMemo(() => tx.data ?? [], [tx.data]);
  const byDay = view.sort === "date";
  const groups = useMemo(() => (byDay ? groupByDay(rows) : [{ date: "", rows, spent: 0, income: 0 }]), [rows, byDay]);
  const chips = chipsFor(view, index, accountById);
  const update = useUpdateTransactions();
  const actions = useReviewActions();
  const kept = useKept();
  const firstRun = useFirstRun();
  const rowActions = useRowActions();
  const { openEditor } = useRuleEditor();
  const addKnownPlace = useAddKnownPlace();

  // Selection belongs to one filter; changing month or filters starts fresh.
  const scope = JSON.stringify(filter);
  const [selection, setSelection] = useState<{ scope: string; ids: Set<number> }>({ scope, ids: NONE });
  const selected = selection.scope === scope ? selection.ids : NONE;
  const anchor = useRef<number | null>(null);

  const toggle = (id: number, range: boolean) => {
    const ids = new Set(selected);
    const on = !ids.has(id);
    const order = rows.map((r) => r.id);
    const from = anchor.current != null ? order.indexOf(anchor.current) : -1;
    const to = order.indexOf(id);
    const span = range && from >= 0 ? order.slice(Math.min(from, to), Math.max(from, to) + 1) : [id];
    span.forEach((x) => (on ? ids.add(x) : ids.delete(x)));
    setSelection({ scope, ids });
    anchor.current = id;
  };

  const clearSelection = () => setSelection({ scope, ids: NONE });
  const selectedRows = rows.filter((r) => selected.has(r.id));

  const makeRule = (targets: Row[], category?: Category) =>
    suggestFor(targets.map((r) => r.id), category).then((draft) => openEditor({ draft, optIn: true }), failed);

  /** A gentle offer to let a rule do this next time (spec 09, item 4). */
  const offerRule = (row: Row, category: Category, still?: boolean) =>
    toast(`${s.rules.offerLead}${row.description.trim()}${s.rules.offerInto}${category.name}${s.rules.offerEnd}`, {
      description: s.rules.offerBody,
      duration: still ? Infinity : 8000,
      // spec 17: an X to close it; it still goes away by itself.
      closeButton: true,
      classNames: { closeButton: OFFER_CLOSE },
      // Hidden screenshot runs never advance transitions; demo shots skip them.
      className: still ? "!transition-none" : undefined,
      // spec 13: yes adds the shop to the category's known places.
      action: { label: s.rulesV2.knownPlaces.offerYes, onClick: () => addKnownPlace(row.description, category) },
      cancel: { label: s.rulesV2.knownPlaces.offerRule, onClick: () => void makeRule([row], category) },
    });

  const categorize = (ids: number[], category: Category | null, one?: Row) => {
    const offer = one !== undefined && shouldOfferRule(one, category);
    update.mutate(
      { ids, patch: { categoryId: category?.id ?? null } },
      {
        onSuccess: ({ updated }) => {
          if (offer && one && category) offerRule(one, category);
          else toast.success(category ? s.transactions.categorized(category.name, updated) : s.transactions.uncategorizedDone(updated));
          clearSelection();
        },
        onError: failed,
      },
    );
  };
  const onRowCategory = (row: Row, c: Category | null) => categorize([row.id], c, row);

  const menuFor = (row: Row): RowMenuModel => {
    const targets = menuTargets(row, selected, rows);
    const many = targets.length > 1;
    const ignoredAll = allIgnored(targets);
    const after = many ? clearSelection : undefined;
    const category = !many && row.categoryId != null ? index.byId.get(row.categoryId) : undefined;
    return {
      heading: many ? s.rowMenu.forSelection(targets.length) : undefined,
      entries: [
        {
          key: "rule",
          label: many ? s.rowMenu.makeRuleMany(targets.length) : s.rowMenu.makeRule(row.description.trim()),
          icon: WandSparkles,
          onSelect: () => void makeRule(targets),
        },
        ...(category
          ? [
              {
                key: "known",
                label: s.rulesV2.knownPlaces.add(row.description.trim(), category.name),
                hint: s.rulesV2.knownPlaces.addHint,
                icon: ListPlus,
                onSelect: () => addKnownPlace(row.description, category),
              },
            ]
          : []),
        {
          key: "ignore",
          label: ignoredAll ? s.rowMenu.countAgain : s.rowMenu.ignore,
          hint: ignoredAll ? undefined : s.rowMenu.ignoreHint,
          icon: ignoredAll ? Eye : EyeOff,
          onSelect: () => rowActions.setIgnored(targets, !ignoredAll, after),
        },
        {
          key: "trash",
          label: s.rowMenu.trash,
          hint: s.rowMenu.trashHint,
          icon: Trash2,
          danger: true,
          onSelect: () => rowActions.trash(targets, clearSelection),
        },
      ],
    };
  };

  const shot = useDemoShot(rows, {
    select: (ids) => setSelection({ scope, ids }),
    setShowBills,
    lastMonth: () => setMonth(shiftMonth(month, -1)),
    offerRule,
    index,
  });

  const setView = (next: ListView) => setParams((p) => writeView(p, next), { replace: true });

  const filtered = Boolean(query) || chips.length > 0;
  const reviewCount = summary.data?.needsReview ?? 0;

  if (firstRun) {
    return (
      <Page title={s.transactions.title}>
        <Welcome />
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
          <FilterMenu view={view} onChange={setView} index={index} accounts={accounts.data ?? []} defaultOpen={shotName === "filters"} />
          <SortMenu value={view.sort} onChange={(sort) => setView({ ...view, sort })} />
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
                {byDay && <div className="flex items-center justify-between border-t border-border bg-secondary/45 px-6 py-2.5">
                  <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                    {formatDayLong(g.date)}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    {g.income > 0 && <Money amount={g.income} sign className="text-[13px] text-status-on-track" />}
                    {g.spent > 0 && (
                      <span>
                        <Money amount={g.spent} className="text-[13px] text-foreground/80" /> {s.transactions.daySpent}
                      </span>
                    )}
                    {g.spent < 0 && (
                      <span>
                        <Money amount={-g.spent} sign className="text-[13px] text-status-on-track" /> {s.transactions.dayBack}
                      </span>
                    )}
                  </span>
                </div>}
                {g.rows.map((row) => (
                  <TransactionRow
                    key={row.id}
                    row={row}
                    account={accountById.get(row.accountId)}
                    index={index}
                    selected={selected.has(row.id)}
                    selecting={selected.size > 0}
                    onToggle={toggle}
                    onCategory={onRowCategory}
                    menu={() => menuFor(row)}
                    menuOpen={shot.menuRow === row.id}
                    hintOpen={shot.hintRow === row.id}
                    showDate={!byDay}
                    onFilterCategory={(id) => setView(onlyCategory(view, id))}
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
          onIgnore={() => rowActions.setIgnored(selectedRows, !allIgnored(selectedRows), clearSelection)}
          onTrash={() => rowActions.trash(selectedRows, clearSelection)}
          onClear={clearSelection}
        />
      )}
    </Page>
  );
}

/**
 * Demo screenshot aid: `?shot=menu` opens the "..." menu on a row,
 * `?shot=select` selects three rows, `?shot=offer` shows the "Always put X
 * in Y?" toast, and `?shot=bills` or `?shot=bills-on` go to last month
 * (which has card bills) with them hidden or shown. Spec 17:
 * `?shot=hover` shows who set the category on a row a rule sorted, and
 * `?shot=hover-user` on a row sorted by hand.
 */
function useDemoShot(
  rows: Row[],
  aids: {
    select: (ids: Set<number>) => void;
    setShowBills: (show: boolean) => void;
    lastMonth: () => void;
    offerRule: (row: Row, category: Category, still: boolean) => void;
    index: CategoryIndex;
  },
): { menuRow: number | null; hintRow: number | null } {
  const shot = useShot();
  const ready = rows.length > 0;
  const [menuRow, setMenuRow] = useState<number | null>(null);
  const [hintRow, setHintRow] = useState<number | null>(null);
  useEffect(() => {
    if (!shot || !ready) return;
    const id = setTimeout(() => {
      const spending = rows.filter((r) => r.flow === "spending" && r.categorySource !== "rule" && r.amount < 0);
      if (shot === "menu") setMenuRow(spending[0]?.id ?? null);
      // spec 13: a row sorted by hand, so the menu offers its known places.
      if (shot === "menu-known") setMenuRow(spending.find((r) => r.categorySource === "user" && r.categoryId != null)?.id ?? null);
      if (shot === "select") aids.select(new Set(spending.slice(0, 3).map((r) => r.id)));
      if (shot === "bills" || shot === "bills-on") aids.lastMonth();
      if (shot === "bills-on") aids.setShowBills(true);
      const groceries = [...aids.index.byId.values()].find((c) => c.name === "Groceries");
      if (shot === "offer" && spending[0] && groceries) aids.offerRule(spending[0], groceries, true);
      const source = shot === "hover" ? "rule" : shot === "hover-user" ? "user" : null;
      if (source) setHintRow(rows.find((r) => r.categorySource === source && r.categoryId != null)?.id ?? null);
    }, 400);
    return () => clearTimeout(id);
    // Once per load: refreshed rows must not repeat it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, ready]);
  return { menuRow, hintRow };
}
