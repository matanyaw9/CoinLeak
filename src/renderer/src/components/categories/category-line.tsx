// One category on the Categories page: drag handle, emoji bubble, name, this
// month's amount, Move and Edit buttons, and its known places underneath.
// The name opens its transactions; a group header gets Edit and Add.

import type { DragEvent } from "react";
import { Link } from "react-router";
import { ChevronRight, FolderInput, GripVertical, Pencil, Plus } from "lucide-react";
import type { Agorot, Category } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { useRules } from "@/lib/hooks";
import { useRuleEditor } from "@/components/rules/rule-editor-provider";
import { Button } from "@/components/ui/button";
import { CategoryBubble } from "@/components/common/chips";
import { Money } from "@/components/common/money";
import type { KnownPlaces } from "./known-places";

interface DragProps {
  draggable: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
}
interface DropProps {
  onDragOver: (e: DragEvent) => void;
  onDragLeave: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}

const SHOWN_PLACES = 6;
const actionClass = "rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100";

export function CategoryLine({
  category,
  stat,
  places,
  dragging,
  dropTarget,
  over,
  onEdit,
  onMove,
  dragProps,
  dropProps,
}: {
  category: Category;
  stat: { amount: Agorot; count: number } | undefined;
  places: KnownPlaces | undefined;
  dragging: boolean;
  /** A top-level category the dragged one may drop into. */
  dropTarget: boolean;
  over: boolean;
  onEdit: () => void;
  onMove: () => void;
  dragProps: DragProps;
  dropProps: DropProps | undefined;
}) {
  return (
    <div
      {...dragProps}
      {...dropProps}
      className={cn(
        "group transition-colors",
        dragging && "opacity-40",
        dropTarget && "bg-primary/[0.03]",
        over && "bg-primary/[0.09] ring-2 ring-primary/50 ring-inset",
      )}
    >
      <div className="flex items-center gap-2 py-3.5 ps-2 pe-5">
        <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground" aria-hidden />
        <Link
          to={`/transactions?category=${category.id}`}
          className="flex min-w-0 flex-1 items-center gap-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          draggable={false}
        >
          <CategoryBubble category={category} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-medium">{category.name}</span>
              {category.essential === false && <ExtraBadge />}
            </div>
            <div className="text-xs text-muted-foreground">
              {over ? s.catEdit.dropHere : stat ? s.common.transactions(stat.count) : s.categories.noSpend}
            </div>
          </div>
          {stat && stat.amount !== 0 && <Money amount={stat.amount} className="text-[17px]" />}
        </Link>
        <Button variant="ghost" size="icon-xs" className={actionClass} aria-label={s.catEdit.move(category.name)} onClick={onMove}>
          <FolderInput />
        </Button>
        <Button variant="ghost" size="icon-xs" className={actionClass} aria-label={s.catEdit.edit(category.name)} onClick={onEdit}>
          <Pencil />
        </Button>
        <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden />
      </div>
      {places && <PlacesLine places={places} />}
    </div>
  );
}

/** spec 18: a small tag on extra spending, where a month can be cut. */
function ExtraBadge() {
  return (
    <span
      title={s.essential.badgeTitle}
      className="shrink-0 rounded-full border border-border px-1.5 py-px text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
    >
      {s.essential.badge}
    </span>
  );
}

/** Read-only: the names in the category's list rule. "Edit" opens that rule. */
function PlacesLine({ places }: { places: KnownPlaces }) {
  const rules = useRules();
  const { openEditor } = useRuleEditor();
  const rule = places.ruleId != null ? rules.data?.find((r) => r.id === places.ruleId) : undefined;
  const shown = places.names.slice(0, SHOWN_PLACES);
  const more = places.names.length - shown.length;
  return (
    <div className="-mt-1.5 flex flex-wrap items-center gap-1.5 ps-[74px] pe-5 pb-3.5 text-xs">
      <span className="me-1 text-muted-foreground">{s.catEdit.places}</span>
      {shown.map((n) => (
        <span key={n} dir="auto" className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
          {n}
        </span>
      ))}
      {more > 0 && <span className="text-muted-foreground">{s.catEdit.placesMore(more)}</span>}
      {rule && (
        <button
          type="button"
          onClick={() => openEditor({ rule })}
          className="ms-1 rounded text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {s.catEdit.placesEdit}
        </button>
      )}
    </div>
  );
}

export function GroupActions({ group, onEdit, onAdd }: { group: Category; onEdit: () => void; onAdd: () => void }) {
  const cls = "rounded-full text-muted-foreground opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100";
  return (
    <span className="ms-auto flex items-center gap-0.5">
      <Button variant="ghost" size="icon-xs" className={cls} aria-label={s.catEdit.addIn(group.name)} onClick={onAdd}>
        <Plus />
      </Button>
      <Button variant="ghost" size="icon-xs" className={cls} aria-label={s.catEdit.edit(group.name)} onClick={onEdit}>
        <Pencil />
      </Button>
    </span>
  );
}
