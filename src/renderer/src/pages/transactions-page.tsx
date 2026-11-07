// Transactions: the month's rows grouped by day, with search, a needs-review
// view, a category filter from Home, quick categorizing, bulk select, and the
// card bill and gone-row answers. Greets instead before the first sync.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { CircleCheck, Search, SearchX, X } from "lucide-react";
import type { Category, TransactionFilter, TransactionRow as Row } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import {
  useAccounts,
  useCategories,
  useFirstRun,
  useMonthSummary,
  useTransactions,
  useUpdateTransactions,
} from "@/lib/hooks";
import { useKept, useReviewActions } from "@/lib/review-actions";
import { useMonth } from "@/lib/month-context";
import { monthRange } from "@/lib/month";
import { formatDayLong, formatMonth } from "@/lib/format";
import { colorOf, idsUnder, indexCategories } from "@/lib/categories";
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

const NONE = new Set<number>();

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function TransactionsPage() {
  const { month } = useMonth();
  const [params, setParams] = useSearchParams();
  const review = params.get("review") === "1";
  const categoryParam = params.get("category");
  const [search, setSearch] = useState("");
  const query = useDebounced(search.trim(), 200);

  const categories = useCategories();
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);
  const accounts = useAccounts();
  const accountById = useMemo(() => new Map((accounts.data ?? []).map((a) => [a.id, a])), [accounts.data]);
  const summary = useMonthSummary(month);

  const filterCategory = categoryParam === "none" ? null : categoryParam ? index.byId.get(Number(categoryParam)) : undefined;
  const filter = useMemo<TransactionFilter>(() => {
    const f: TransactionFilter = { ...monthRange(month) };
    if (query) f.search = query;
    if (review) f.needsReview = true;
    if (categoryParam === "none") f.categoryIds = [null];
    else if (categoryParam) f.categoryIds = idsUnder(index, Number(categoryParam));
    return f;
  }, [month, query, review, categoryParam, index]);

  const tx = useTransactions(filter);
  const rows = useMemo(() => tx.data ?? [], [tx.data]);
  const groups = useMemo(() => groupByDay(rows), [rows]);
  const update = useUpdateTransactions();
  const actions = useReviewActions();
  const kept = useKept();
  const firstRun = useFirstRun();

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

  const categorize = (ids: number[], category: Category | null) => {
    update.mutate(
      { ids, patch: { categoryId: category?.id ?? null } },
      {
        onSuccess: ({ updated }) => {
          toast.success(category ? s.transactions.categorized(category.name, updated) : s.transactions.uncategorizedDone(updated));
          setSelection({ scope, ids: NONE });
        },
        onError: (e) => toast.error(e instanceof ApiError ? e.message : s.errors.crashBody),
      },
    );
  };
  const onRowCategory = (row: Row, c: Category | null) => categorize([row.id], c);

  const setParam = (key: string, value: string | null) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value == null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const filtered = Boolean(query || categoryParam);
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
      <div className="rounded-3xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 px-6 py-4">
          <Segmented
            value={review ? "review" : "all"}
            onChange={(v) => setParam("review", v === "review" ? "1" : null)}
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
          {(categoryParam === "none" || filterCategory) && (
            <span className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-background ps-3 pe-1 text-sm">
              <span className="text-muted-foreground">{s.transactions.filteredBy}</span>
              <span className="size-2 rounded-full" style={{ backgroundColor: colorOf(filterCategory ?? null) }} />
              <span className="font-medium">
                {filterCategory ? `${filterCategory.emoji ?? ""} ${filterCategory.name}`.trim() : s.common.uncategorized}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                className="rounded-full"
                aria-label={s.transactions.clearFilter}
                onClick={() => setParam("category", null)}
              >
                <X />
              </Button>
            </span>
          )}
          <label className="relative ms-auto w-72">
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearch("")}
              placeholder={s.transactions.searchPlaceholder}
              className="h-9 rounded-full bg-background ps-9"
            />
          </label>
        </div>

        {tx.isError ? (
          <QueryError error={tx.error} className="border-t border-border" />
        ) : !tx.data ? (
          <div className="space-y-3 border-t border-border px-6 py-5">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : groups.length === 0 ? (
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
                      setParam("category", null);
                    }}
                  >
                    {s.common.clear}
                  </Button>
                }
              />
            ) : (
              <EmptyState title={s.transactions.emptyTitle(formatMonth(month))} body={s.transactions.emptyBody} />
            )}
          </div>
        ) : (
          <div className={cn("pb-2 transition-opacity", tx.isPlaceholderData && "opacity-60")}>
            {groups.map((g) => (
              <Fragment key={g.date}>
                <div className="flex items-center justify-between border-t border-border bg-secondary/45 px-6 py-2.5">
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
                </div>
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
          pending={update.isPending}
          index={index}
          onCategory={(c) => categorize([...selected], c)}
          onClear={() => setSelection({ scope, ids: NONE })}
        />
      )}
    </Page>
  );
}
