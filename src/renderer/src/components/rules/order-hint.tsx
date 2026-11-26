// One line about another rule (spec 41): which rule decides rows here, or
// which this one overrides. With several rules, their names are in the title.

import { Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export function OrderHint({ text, names, className }: { text: string; names: string[]; className?: string }) {
  return (
    <span
      title={names.length > 1 ? names.join(", ") : undefined}
      className={cn("flex items-start gap-1.5 text-xs text-status-heads-up", className)}
    >
      <Layers className="mt-px size-3.5 shrink-0" />
      <span className="min-w-0 break-words">{text}</span>
    </span>
  );
}
