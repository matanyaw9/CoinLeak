// A spending category's budget on the Categories page, as plain text
// ("Budget ₪1,200", or "No budget"). Budgets are set on the Budgets page
// (spec 37); this opens it at the category's line.

import { Link } from "react-router";
import type { Agorot, Category } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { money } from "@/components/budgets/offer-words";

export function BudgetLink({ category, budget }: { category: Category; budget: Agorot | null }) {
  return (
    <Link
      to={`/budgets?category=${category.id}`}
      title={s.plan.openLine(category.name)}
      draggable={false}
      className={cn(
        "w-32 shrink-0 truncate rounded-md px-1 text-end text-xs tabular-nums underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50",
        budget === null ? "text-muted-foreground/70" : "text-muted-foreground",
      )}
    >
      {budget === null ? s.plan.noBudget : s.plan.budgetText(money(budget))}
    </Link>
  );
}
