// Categories: the two-level tree with emoji, color and this month's amount,
// and the editor (spec 15): add, rename, recolor, move by drag or button,
// delete, and each category's known places from its list rule.
// Look adapted from Spent (github.com/Shaya16/Spent), settings categories screen.

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { FolderPlus, Plus, Search, Shapes } from "lucide-react";
import type { Category, CategoryKind } from "@shared/types";
import { s } from "@/strings";
import { useCategories, useMonthSummary } from "@/lib/hooks";
import { useMonth } from "@/lib/month-context";
import { formatMonth } from "@/lib/format";
import { useShot } from "@/lib/shot";
import { cn } from "@/lib/utils";
import { colorOf, indexCategories } from "@/lib/categories";
import { Page } from "@/components/layout/page";
import { Input, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/common/segmented";
import { EmptyState, QueryError } from "@/components/common/empty-state";
import { ColorDot } from "@/components/common/chips";
import { Card } from "@/components/common/card";
import { KINDS, kindLabel } from "@/components/categories/category-actions";
import { CategoryEditor, type EditorRequest } from "@/components/categories/category-editor";
import { CategoryLine, GroupActions } from "@/components/categories/category-line";
import { DeleteDialog } from "@/components/categories/delete-dialog";
import { MoveDialog, useMoveCategory } from "@/components/categories/move-dialog";
import { useKnownPlaces } from "@/components/categories/known-places";

type OpenRequest =
  | { name: "editor"; request: EditorRequest }
  | { name: "move"; category: Category }
  | { name: "delete"; category: Category };
type Open = OpenRequest & { key: number };

export function CategoriesPage() {
  const { month } = useMonth();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [search, setSearch] = useState("");
  const categories = useCategories();
  const summary = useMonthSummary(month);
  const places = useKnownPlaces();
  const index = useMemo(() => indexCategories(categories.data), [categories.data]);
  const all = useMemo(() => (categories.data ?? []).filter((c) => !c.archived), [categories.data]);
  const [dialog, setDialog] = useState<Open | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragging, setDragging] = useState<Category | null>(null);
  const [over, setOver] = useState<number | "top" | null>(null);
  const mover = useMoveCategory();
  const q = search.trim().toLowerCase();

  const show = (next: OpenRequest) => {
    setDialog({ ...next, key: (dialog?.key ?? 0) + 1 });
    setDialogOpen(true);
  };
  const edit = (category: Category) => show({ name: "editor", request: { mode: "edit", category } });
  const add = (parentId: number | null, meta: boolean) => show({ name: "editor", request: { mode: "new", kind, parentId, meta } });

  useDemoShot(all, setKind, show, setDragging, setOver);

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

  /** True when the category being dragged may drop into this group. */
  const canDrop = (target: Category | "top"): boolean => {
    if (!dragging) return false;
    if (target === "top") return dragging.parentId !== null;
    if (target.id === dragging.id || target.id === dragging.parentId || target.parentId !== null) return false;
    return target.kind === dragging.kind && !index.children.has(dragging.id);
  };
  const dropProps = (target: Category | "top") => {
    const key = target === "top" ? "top" : target.id;
    return {
      onDragOver: (e: DragEvent) => {
        if (!canDrop(target)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (over !== key) setOver(key);
      },
      onDragLeave: (e: DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null) && over === key) setOver(null);
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        if (dragging && canDrop(target)) mover.move(dragging, target === "top" ? null : target);
        setDragging(null);
        setOver(null);
      },
    };
  };
  const dragProps = (c: Category) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(c.id));
      setDragging(c);
    },
    onDragEnd: () => {
      setDragging(null);
      setOver(null);
    },
  });

  const line = (c: Category) => (
    <CategoryLine
      key={c.id}
      category={c}
      stat={summary.data?.byCategory.find((b) => b.categoryId === c.id)}
      places={places.data?.get(c.id)}
      dragging={dragging?.id === c.id}
      dropTarget={c.parentId === null && canDrop(c)}
      over={over === c.id}
      onEdit={() => edit(c)}
      onMove={() => show({ name: "move", category: c })}
      dragProps={dragProps(c)}
      dropProps={c.parentId === null ? dropProps(c) : undefined}
    />
  );

  return (
    <Page title={s.categories.title} withMonth>
      <div className="mx-auto max-w-4xl">
        <p className="text-[15px] text-muted-foreground">
          {s.categories.intro} <span className="text-foreground">{formatMonth(month)}</span>.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Segmented
            value={kind}
            onChange={setKind}
            options={KINDS.map((k) => ({
              value: k,
              label: k === "expense" ? s.categories.spending : k === "income" ? s.categories.income : kindLabel(k),
            }))}
          />
          <label className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={s.categories.search}
              className="h-9 rounded-full ps-10"
            />
          </label>
          <Button variant="outline" onClick={() => add(null, true)}>
            <FolderPlus />
            {s.catEdit.addMeta}
          </Button>
          <Button onClick={() => add(null, false)}>
            <Plus />
            {s.catEdit.add}
          </Button>
        </div>
        <p className="mt-3 px-1 text-xs text-muted-foreground">{s.catEdit.dragHint}</p>

        <div className="mt-6 space-y-8">
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
                <section
                  key={root.id}
                  {...dropProps(root)}
                  className={cn(
                    "-m-2 rounded-[1.75rem] p-2 transition-colors",
                    canDrop(root) && "outline-2 outline-dashed outline-primary/30",
                    over === root.id && "bg-primary/[0.07] outline-primary/60",
                  )}
                >
                  <div className="group/head mb-2.5 flex min-h-7 items-center gap-2 px-1">
                    <ColorDot color={colorOf(root)} className="size-2" />
                    <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{root.name}</span>
                    <span className="text-[11px] text-muted-foreground/70">{root.emoji}</span>
                    {over === root.id && <span className="text-xs text-primary">{s.catEdit.dropHere}</span>}
                    <GroupActions group={root} onEdit={() => edit(root)} onAdd={() => add(root.id, false)} />
                  </div>
                  <List>{kids.map(line)}</List>
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

function List({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border overflow-hidden rounded-3xl border border-border bg-card">{children}</div>;
}

/**
 * Demo screenshot aid: `?shot=edit-11`, `?shot=move-13`, `?shot=delete-11`
 * or `?shot=new-group` opens that dialog; `?shot=drag-13-4` shows category
 * 13 being dragged over group 4.
 */
function useDemoShot(
  all: Category[],
  setKind: (k: CategoryKind) => void,
  show: (o: OpenRequest) => void,
  setDragging: (c: Category | null) => void,
  setOver: (id: number | null) => void,
) {
  const shot = useShot();
  const ready = all.length > 0;
  useEffect(() => {
    if (!shot || !ready) return;
    const id = setTimeout(() => {
      const [what, a, b] = shot.split("-");
      const c = all.find((x) => x.id === Number(a));
      if (shot === "new-group") show({ name: "editor", request: { mode: "new", kind: "expense", parentId: null, meta: true } });
      if (!c) return;
      setKind(c.kind);
      if (what === "edit") show({ name: "editor", request: { mode: "edit", category: c } });
      if (what === "move") show({ name: "move", category: c });
      if (what === "delete") show({ name: "delete", category: c });
      if (what === "drag") {
        setDragging(c);
        setOver(Number(b));
      }
    }, 400);
    return () => clearTimeout(id);
    // Once per load: refreshed data must not reopen it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, ready]);
}
