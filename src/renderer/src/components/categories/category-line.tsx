// One category on the Categories page: guide lines for its level (F88), drag
// handle, emoji bubble, name, this month's amount, on spending categories its
// usual month and budget box (spec 40), Add (levels 1 and 2, spec 34), Move
// and Edit buttons, and its known places underneath. The name opens its
// transactions and is the line's place in the list's one Tab stop (F83).

import type { DragEvent, KeyboardEvent } from "react";
import { Link } from "react-router";
import { ChevronRight, FolderInput, GripVertical, Pencil, Plus } from "lucide-react";
import type { Agorot, BudgetPlanLine, Category } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { useRules } from "@/lib/hooks";
import type { RovingItem } from "@/lib/roving";
import { useRuleEditor } from "@/components/rules/rule-editor-provider";
import { Button } from "@/components/ui/button";
import { CategoryBubble } from "@/components/common/chips";
import { Money } from "@/components/common/money";
import { Highlight } from "@/components/layout/find-box";
import { hasText } from "@/components/layout/find-text";
import { BudgetLine, InsideNote } from "@/components/budgets/budget-line";
import { TreeGuides } from "./tree-guides";
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
  depth,
  stat,
  places,
  query,
  dragging,
  dropTarget,
  over,
  onEdit,
  onMove,
  onAdd,
  dragProps,
  dropProps,
  budget,
  roving,
}: {
  category: Category;
  /** spec 34: 1 for a top-level category, up to 3. */
  depth: number;
  stat: { amount: Agorot; count: number } | undefined;
  places: KnownPlaces | undefined;
  /** spec 21: the search, highlighted in the name and places. */
  query: string;
  dragging: boolean;
  /** A category the dragged one may drop into. */
  dropTarget: boolean;
  over: boolean;
  onEdit: () => void;
  onMove: () => void;
  /** spec 34: adds a category inside this one; left out at level 3. */
  onAdd?: () => void;
  dragProps: DragProps;
  dropProps: DropProps | undefined;
  /** spec 40: the budget part, on spending categories. */
  budget?: { line: BudgetPlanLine; nameOf: (id: number) => string };
  /** spec 36: the line's place in the list and its arrow keys. */
  roving: RovingItem;
}) {
  const deep = depth >= 3;
  const { ref, tabIndex, onFocus, onBlur, onKeyDown: listKeys } = roving;
  // Typing in a budget box keeps its keys (its own Up and Down move between boxes); Tab is still the list's.
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Tab" || !(e.target instanceof HTMLInputElement)) listKeys(e);
  };
  const overBudget = budget !== undefined && budget.line.budget !== null && budget.line.spent > budget.line.budget;

  const main = (
    <>
      <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground" aria-hidden />
      <Link
        ref={ref}
        tabIndex={tabIndex}
        to={`/transactions?category=${category.id}`}
        className="flex min-w-0 flex-1 scroll-mt-24 scroll-mb-4 items-center gap-4 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        draggable={false}
      >
        <CategoryBubble category={category} size={deep ? 32 : 40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span dir="auto" className={cn("truncate text-[15px]", depth === 1 ? "font-semibold" : "font-medium")}>
              <Highlight text={category.name} query={query} />
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {over ? s.catEdit.dropHere : stat ? s.common.transactions(stat.count) : s.categories.noSpend}
          </div>
          {budget && <InsideNote line={budget.line} />}
        </div>
        {stat && stat.amount !== 0 && <Money amount={stat.amount} className={cn("text-[17px]", overBudget && "text-status-over")} />}
      </Link>
    </>
  );
  const actions = (
    <>
      {onAdd ? (
        <Button variant="ghost" size="icon-xs" className={actionClass} aria-label={s.nested.addIn(category.name)} onClick={onAdd}>
          <Plus />
        </Button>
      ) : (
        // Same width as Add, so amounts and budgets line up at every level.
        <span className="size-7 shrink-0" aria-hidden />
      )}
      <Button variant="ghost" size="icon-xs" className={actionClass} aria-label={s.catEdit.move(category.name)} onClick={onMove}>
        <FolderInput />
      </Button>
      <Button variant="ghost" size="icon-xs" className={actionClass} aria-label={s.catEdit.edit(category.name)} onClick={onEdit}>
        <Pencil />
      </Button>
      <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden />
    </>
  );

  return (
    <div
      {...dragProps}
      {...dropProps}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className={cn(
        "group flex ps-2 transition-colors",
        dragging && "opacity-40",
        dropTarget && "bg-primary/[0.03]",
        over && "bg-primary/[0.09] ring-2 ring-primary/50 ring-inset",
      )}
    >
      <TreeGuides depth={depth} />
      <div className="min-w-0 flex-1">
        {budget ? (
          <BudgetLine line={budget.line} name={category.name} nameOf={budget.nameOf} actions={actions}>
            {main}
          </BudgetLine>
        ) : (
          <div className="flex items-center gap-2 py-3 pe-5">
            {main}
            {actions}
          </div>
        )}
        {places && <PlacesLine places={places} query={query} deep={deep} />}
      </div>
    </div>
  );
}

/** Read-only: the names in the category's list rule. "Edit" opens that rule. */
function PlacesLine({ places, query, deep }: { places: KnownPlaces; query: string; deep: boolean }) {
  const rules = useRules();
  const { openEditor } = useRuleEditor();
  const rule = places.ruleId != null ? rules.data?.find((r) => r.id === places.ruleId) : undefined;
  // spec 21: places that match the search come first, so they show.
  const names = query ? [...places.names].sort((a, b) => Number(hasText(b, query)) - Number(hasText(a, query))) : places.names;
  const shown = names.slice(0, SHOWN_PLACES);
  const more = places.names.length - shown.length;
  return (
    <div className={cn("-mt-1 flex flex-wrap items-center gap-1.5 pe-5 pb-3 text-xs", deep ? "ps-[72px]" : "ps-[80px]")}>
      <span className="me-1 text-muted-foreground">{s.catEdit.places}</span>
      {shown.map((n) => (
        <span key={n} dir="auto" className="rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
          <Highlight text={n} query={query} />
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
