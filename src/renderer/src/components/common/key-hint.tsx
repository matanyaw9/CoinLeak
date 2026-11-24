// A small, quiet key badge, as in "H" beside Home or "Ctrl+A" in a tooltip (spec 31).

import { cn } from "@/lib/utils";

export function KeyHint({ keys, className }: { keys: string; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-border px-1 font-sans text-[10.5px] leading-none font-medium text-muted-foreground",
        className,
      )}
    >
      {keys}
    </kbd>
  );
}
