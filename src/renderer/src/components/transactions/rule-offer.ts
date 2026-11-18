// "Always put X in Y?" (spec 09 item 4, spec 13): the gentle offer after the
// user sorts a row by hand. Yes adds the shop to the category's known places;
// the other button opens the rule editor instead.

import { toast } from "sonner";
import type { Category, TransactionRow } from "@shared/types";
import { s } from "@/strings";

// The offer's X sits inside the top right corner, not on sonner's outer edge.
const CLOSE =
  "!left-auto !right-2 !top-2 !size-6 !transform-none !border-0 !bg-transparent !text-muted-foreground hover:!bg-accent hover:!text-foreground [&>svg]:!size-3.5";

/** `still` keeps it up without transitions, for screenshot runs. */
export function offerRule(
  row: TransactionRow,
  category: Category,
  answers: { addKnownPlace(): void; makeRule(): void },
  still = false,
): void {
  toast(`${s.rules.offerLead}${row.description.trim()}${s.rules.offerInto}${category.name}${s.rules.offerEnd}`, {
    description: s.rules.offerBody,
    duration: still ? Infinity : 8000,
    // spec 17: an X to close it; it still goes away by itself.
    closeButton: true,
    classNames: { closeButton: CLOSE },
    // Hidden screenshot runs never advance transitions; demo shots skip them.
    className: still ? "!transition-none" : undefined,
    action: { label: s.rulesV2.knownPlaces.offerYes, onClick: answers.addKnownPlace },
    cancel: { label: s.rulesV2.knownPlaces.offerRule, onClick: answers.makeRule },
  });
}
