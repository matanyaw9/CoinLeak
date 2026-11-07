// Tiny primitives: skeleton, separator, checkbox, input.
// Adapted from Spent (github.com/Shaya16/Spent), src/components/ui/skeleton.tsx,
// separator.tsx, checkbox.tsx and input.tsx.

import { Check, Minus } from "lucide-react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-lg bg-muted", className)} {...props} />;
}

export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cn("h-px w-full shrink-0 bg-border", className)} />;
}

export function Checkbox({
  checked,
  onClick,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean | "indeterminate";
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const on = checked === true;
  const mixed = checked === "indeterminate";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : on}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        on || mixed
          ? "border-foreground bg-foreground text-background"
          : "border-foreground/25 bg-card hover:border-foreground/50",
        className,
      )}
    >
      {mixed ? <Minus className="size-3" strokeWidth={3} /> : on ? <Check className="size-3" strokeWidth={3} /> : null}
    </button>
  );
}

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
      {...props}
    />
  );
}
