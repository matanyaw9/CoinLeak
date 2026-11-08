// A small on and off switch on base-ui, sage when on.

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-checked:bg-primary data-unchecked:bg-foreground/15 data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 rounded-full bg-card shadow-sm shadow-black/15 transition-transform data-checked:translate-x-4 dark:bg-foreground" />
    </SwitchPrimitive.Root>
  );
}
