// Categories: the tree (three levels, spec 34) with emoji, color and this
// month's amount, and the editor (spec 15): add, rename, recolor, move by drag
// or button, delete, and each category's known places from its list rule.
// Spec 40: spending is also where budgets are planned (spec 37): the total
// card, then each line's usual month and budget box.
// Spec 21: Ctrl+F searches names and known places, highlighting what matched.
// Look adapted from Spent (github.com/Shaya16/Spent), settings categories screen.

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { FolderPlus, Plus, Shapes } from "lucide-react";
import type { Category, CategoryKind } from "@shared/types";
import { s } from "@/strings";
import { useBudgetPlan, useCategories } from "@/lib/hooks";
import { usePeriod } from "@/lib/month-context";
import { monthRange } from "@/lib/month";
import { usePeriodSummary } from "@/components/home/period-data";
import { formatMonth } from "@/lib/format";
import { useShot } from "@/lib/shot";
import { useRoving } from "@/lib/roving";
import { cn } from "@/lib/utils";
import { depthOf, indexCategories, MAX_LEVELS, parentChoices } from "@/lib/categories";
import { Page } from "@/components/layout/page";
import { Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/common/segmented";
import { EmptyState, QueryError } from "@/components/common/empty-state";
import { Card } from "@/components/common/card";
import { KINDS, kindLabel } from "@/components/categories/category-actions";
import { CategoryEditor, type EditorRequest } from "@/components/categories/category-editor";
import { CategoryLine } from "@/components/categories/category-line";
import { TotalCard } from "@/components/budgets/total-card";
import { DeleteDialog } from "@/components/categories/delete-dialog";
import { MoveDialog, useMoveCategory } from "@/components/categories/move-dialog";
import { useKnownPlaces } from "@/components/categories/known-places";
import { hitsElsewhere, searchCategories } from "@/components/categories/category-search";
import { FindBox, NoMatches } from "@/components/layout/find-box";

type OpenRequest =
  | { name: "editor"; request: EditorRequest }
  | { name: "move"; category: Category }
  | { name: "delete"; category: Category };
type Open = OpenRequest & { key: number };

export function CategoriesPage() {
  const month = usePeriod().choice.month;
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [search, setSearch] = useState("");
  const categories = useCategories();
  const summary = usePeriodSummary(monthRange(month));
  const places = useKnownPlaces();
  // Budgets are standing monthly amounts; only what was spent follows the month.
  const plan = useBudgetPlan(month);
  const lines = useMemo(() => new Map(plan.data?.lines.map((l) => [l.categoryId, l])), [plan.data]);
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);
  const all = useMemo(() => (categories.data ?? []).filter((c) => !c.archived), [categories.data]);
  const [dialog, setDialog] = useState<Open | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragging, setDragging] = useState<Category | null>(null);
  const [over, setOver] = useState<number | "top" | null>(null);
  const mover = useMoveCategory();
  const q = search.trim();
  const placeNames = (id: number) => places.data?.get(id)?.names;

  const show = (next: OpenRequest) => {
    setDialog({ ...next, key: (dialog?.key ?? 0) + 1 });
    setDialogOpen(true);
  };
  const edit = (category: Category) => show({ name: "editor", request: { mode: "edit", category } });
  const add = (parentId: number | null, meta: boolean) => show({ name: "editor", request: { mode: "new", kind, parentId, meta } });

  // Read once for the whole page; a line gets only what concerns it.
  const shot = useShot();
  useDemoShot(shot, all, setKind, show, setDragging, setOver, setSearch);

  // spec 21: groups with no match collapse away.
  const groups = searchCategories(index, kind, q, placeNames);
  const elsewhere = q && groups.length === 0 ? hitsElsewhere(index, kind, q, placeNames) : [];
  const loose = groups.filter((g) => (index.children.get(g.root.id) ?? []).length === 0);
  const trees = groups.filter((g) => (index.children.get(g.root.id) ?? []).length > 0);
  const spending = kind === "expense";
  const nameOf = (id: number) => index.byId.get(id)?.name ?? "";
  // Every line shown, top to bottom: one list, one Tab stop (F83).
  const rows = [...trees.flatMap((g) => [g.root, ...g.kids]), ...loose.map((g) => g.root)];
  const { list, item, guard } = useRoving(rows.map((c) => c.id));

  // spec 34: where the dragged category may go, by the same rule as the editor's chooser.
  const dropIds = useMemo(
    () => new Set(dragging ? parentChoices(index, dragging.kind, dragging).map((e) => e.category.id) : []),
    [index, dragging],
  );
  /** True when the category being dragged may drop into this one (or to the top level). */
  const canDrop = (target: Category | "top"): boolean => {
    if (!dragging) return false;
    if (target === "top") return dragging.parentId !== null;
    return target.id !== dragging.parentId && dropIds.has(target.id);
  };
  // A line inside a group's box takes the drop first; when it cannot, the box does.
  const dropProps = (target: Category | "top") => {
    const key = target === "top" ? "top" : target.id;
    return {
      onDragOver: (e: DragEvent) => {
        if (!canDrop(target)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        if (over !== key) setOver(key);
      },
      onDragLeave: (e: DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && over === key) setOver(null);
      },
      onDrop: (e: DragEvent) => {
        if (!canDrop(target)) return;
        e.preventDefault();
        e.stopPropagation();
        if (dragging) mover.move(dragging, target === "top" ? null : target);
        setDragging(null);
        setOver(null);
      },
    };
  };
  const dragProps = (c: Category) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      // Selected text dragged out of a budget box bubbles here: not a category move.
      if (e.target !== e.currentTarget) return;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(c.id));
      setDragging(c);
    },
    onDragEnd: () => {
      setDragging(null);
      setOver(null);
    },
  });

  const line = (c: Category) => {
    // spec 34: levels 1 and 2 hold categories; level 3 holds none.
    const depth = depthOf(index, c);
    const holds = depth < MAX_LEVELS;
    const planned = spending ? lines.get(c.id) : undefined;
    // `?shot=raise-<name>`: that one line shows its raise offer (budget-line.tsx).
    const marked = planned && shot === `raise-${c.name}` ? { ...planned, raiseShot: true } : planned;
    return (
      <CategoryLine
        key={c.id}
        category={c}
        depth={depth}
        stat={summary.data?.spendingUnder.find((b) => b.categoryId === c.id)}
        places={places.data?.get(c.id)}
        query={q}
        dragging={dragging?.id === c.id}
        dropTarget={canDrop(c)}
        over={over === c.id}
        onEdit={() => edit(c)}
        onMove={() => show({ name: "move", category: c })}
        onAdd={holds ? () => add(c.id, false) : undefined}
        dragProps={dragProps(c)}
        dropProps={holds ? dropProps(c) : undefined}
        budget={marked && { line: marked, nameOf }}
        roving={item(rows.indexOf(c))}
      />
    );
  };

  return (
    <Page title={s.categories.title} withMonth>
      <div className="mx-auto max-w-4xl">
        <p className="text-[15px] text-muted-foreground">
          {s.nested.intro} <span className="text-foreground">{formatMonth(month)}</span>.
          {spending && ` ${s.catBudgets.intro}`}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Segmented
            value={kind}
            onChange={setKind}
            options={KINDS.map((k) => ({ value: k, label: kindName(k) }))}
          />
          <FindBox value={search} onChange={setSearch} placeholder={s.find.categoriesPlaceholder} className="min-w-48 flex-1" />
          <Button variant="outline" onClick={() => add(null, true)}>
            <FolderPlus />
            {s.catEdit.addMeta}
          </Button>
          <Button onClick={() => add(null, false)}>
            <Plus />
            {s.catEdit.add}
          </Button>
        </div>
        {spending && plan.isError && (
          <Card className="mt-6">
            <QueryError error={plan.error} />
          </Card>
        )}
        {spending && plan.data && plan.data.lines.length > 0 && (
          <div className="mt-6">
            <TotalCard plan={plan.data} />
          </div>
        )}
        <p className="mt-6 px-1 text-xs text-muted-foreground">
          {s.catEdit.dragHint}
          {spending && ` ${s.plan.keysHint}`}
        </p>

        {rows.length > 0 && <span {...guard("before")} />}
        <div ref={list} className="mt-6 space-y-8">
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
            <NoMatches query={q} onClear={() => setSearch("")}>
              {elsewhere.map((e) => (
                <Button key={e.kind} variant="ghost" className="rounded-full" onClick={() => setKind(e.kind)}>
                  {s.find.elsewhere(e.count, kindName(e.kind))}
                </Button>
              ))}
            </NoMatches>
          ) : (
            <>
              {trees.map(({ root, kids }) => (
                <section
                  key={root.id}
                  {...dropProps(root)}
                  className={cn(
                    "-m-2 rounded-[1.75rem] p-2 transition-colors",
                    canDrop(root) && "outline-2 outline-dashed outline-primary/30",
                    over === root.id && "bg-primary/[0.07] outline-primary/60",
                  )}
                >
                  <List>{[root, ...kids].map(line)}</List>
                </section>
              ))}
              {loose.length > 0 && <List>{loose.map((g) => line(g.root))}</List>}
              {dragging && dragging.parentId !== null && (
                <div
                  {...dropProps("top")}
                  className={cn(
                    "flex h-16 items-center justify-center rounded-3xl border-2 border-dashed border-primary/30 text-sm text-muted-foreground transition-colors",
                    over === "top" && "border-primary/60 bg-primary/[0.07] text-primary",
                  )}
                >
                  {s.catEdit.dropTop}
                </div>
              )}
            </>
          )}
        </div>
        {rows.length > 0 && <span {...guard("after")} />}
      </div>

      {dialog?.name === "editor" && (
        <CategoryEditor
          key={dialog.key}
          request={dialog.request}
          categories={all}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onDelete={(c) => show({ name: "delete", category: c })}
        />
      )}
      {dialog?.name === "move" && (
        <MoveDialog key={dialog.key} category={dialog.category} categories={all} open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
      {dialog?.name === "delete" && (
        <DeleteDialog key={dialog.key} category={dialog.category} categories={all} open={dialogOpen} onOpenChange={setDialogOpen} />
      )}
    </Page>
  );
}

/** The name each kind's tab shows. */
function kindName(k: CategoryKind): string {
  return k === "expense" ? s.categories.spending : k === "income" ? s.categories.income : kindLabel(k);
}

function List({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">{children}</div>;
}

/**
 * Screenshot aid: `?shot=edit-Groceries`, `?shot=move-Bars`, `?shot=delete-Bars`
 * or `?shot=new-group` opens that dialog; `?shot=drag-Bars-Lifestyle` shows
 * Bars being dragged over the Lifestyle group (categories found by name).
 * Spec 21: `?shot=find-<text>` types a search.
 */
function useDemoShot(
  shot: string | null,
  all: Category[],
  setKind: (k: CategoryKind) => void,
  show: (o: OpenRequest) => void,
  setDragging: (c: Category | null) => void,
  setOver: (id: number | null) => void,
  setSearch: (text: string) => void,
) {
  const ready = all.length > 0;
  useEffect(() => {
    if (!shot || !ready) return;
    const id = setTimeout(() => {
      if (shot.startsWith("find-")) {
        setSearch(shot.slice("find-".length));
        return;
      }
      const [what, a, b] = shot.split("-");
      const c = all.find((x) => x.name === a);
      if (shot === "new-group") show({ name: "editor", request: { mode: "new", kind: "expense", parentId: null, meta: true } });
      if (!c) return;
      setKind(c.kind);
      if (what === "edit") show({ name: "editor", request: { mode: "edit", category: c } });
      if (what === "move") show({ name: "move", category: c });
      if (what === "delete") show({ name: "delete", category: c });
      if (what === "drag") {
        setDragging(c);
        setOver(all.find((x) => x.name === b)?.id ?? null);
      }
    }, 400);
    return () => clearTimeout(id);
    // Once per load: refreshed data must not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, ready]);
}
