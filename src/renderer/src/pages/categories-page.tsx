// Categories: the two-level tree with emoji, color and this month's amount.
// Look adapted from Spent (github.com/Shaya16/Spent), settings categories screen.

import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ChevronRight, Search, Shapes } from "lucide-react";
import type { Category, CategoryKind, MonthSummary } from "@shared/types";
import { s } from "@/strings";
import { useCategories, useMonthSummary } from "@/lib/hooks";
import { useMonth } from "@/lib/month-context";
import { formatMonth } from "@/lib/format";
import { colorOf, indexCategories, type CategoryIndex } from "@/lib/categories";
import { Page } from "@/components/layout/page";
import { Input, Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/common/segmented";
import { EmptyState, QueryError } from "@/components/common/empty-state";
import { CategoryBubble, ColorDot } from "@/components/common/chips";
import { Money } from "@/components/common/money";
import { Card } from "@/components/common/card";

export function CategoriesPage() {
  const { month } = useMonth();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [search, setSearch] = useState("");
  const categories = useCategories();
  const summary = useMonthSummary(month);
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);
  const q = search.trim().toLowerCase();

  const groups = index.roots
    .filter((r) => r.kind === kind)
    .map((root) => {
      const kids = index.children.get(root.id) ?? [];
      const rootHit = root.name.toLowerCase().includes(q);
      return { root, kids: q && !rootHit ? kids.filter((c) => c.name.toLowerCase().includes(q)) : kids, rootHit };
    })
    .filter((g) => !q || g.rootHit || g.kids.length > 0);
  const loose = groups.filter((g) => (index.children.get(g.root.id) ?? []).length === 0);
  const trees = groups.filter((g) => (index.children.get(g.root.id) ?? []).length > 0);

  return (
    <Page title={s.categories.title} withMonth>
      <div className="mx-auto max-w-4xl">
        <p className="text-[15px] text-muted-foreground">
          {s.categories.intro} <span className="text-foreground">{formatMonth(month)}</span>.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: "expense", label: s.categories.spending },
              { value: "income", label: s.categories.income },
            ]}
          />
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={s.categories.search}
              className="h-9 rounded-full ps-10"
            />
          </label>
        </div>

        <div className="mt-8 space-y-8">
          {categories.isError ? (
            <Card>
              <QueryError error={categories.error} />
            </Card>
          ) : !categories.data ? (
            <Skeleton className="h-80 w-full rounded-3xl" />
          ) : index.roots.length === 0 ? (
            <Card>
              <EmptyState icon={Shapes} title={s.categories.emptyTitle} body={s.categories.emptyBody} />
            </Card>
          ) : groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{s.categories.noMatch}</p>
          ) : (
            <>
              {trees.map(({ root, kids }) => (
                <section key={root.id}>
                  <div className="mb-2.5 flex items-center gap-2 px-1">
                    <ColorDot color={colorOf(root)} className="size-2" />
                    <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{root.name}</span>
                    <span className="text-[11px] text-muted-foreground/70">{root.emoji}</span>
                  </div>
                  <List items={kids} summary={summary.data} index={index} />
                </section>
              ))}
              {loose.length > 0 && <List items={loose.map((g) => g.root)} summary={summary.data} index={index} />}
            </>
          )}
        </div>
      </div>
    </Page>
  );
}

function List({ items, summary, index }: { items: Category[]; summary: MonthSummary | undefined; index: CategoryIndex }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">
      {items.map((c) => (
        <CategoryLine key={c.id} category={c} summary={summary} index={index} />
      ))}
    </div>
  );
}

function CategoryLine({ category, summary }: { category: Category; summary: MonthSummary | undefined; index: CategoryIndex }) {
  const stat = summary?.byCategory.find((b) => b.categoryId === category.id);
  return (
    <Link
      to={`/transactions?category=${category.id}`}
      className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/40"
    >
      <CategoryBubble category={category} size={40} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{category.name}</div>
        <div className="text-xs text-muted-foreground">{stat ? s.common.transactions(stat.count) : s.categories.noSpend}</div>
      </div>
      {stat && stat.amount !== 0 && <Money amount={stat.amount} className="text-[17px]" />}
      <ChevronRight className="size-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
