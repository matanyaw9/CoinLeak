// Money on screen: serif, tabular figures, formatted by the shared formatIls.

import type { Agorot } from "@shared/types";
import { ils } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Money({
  amount,
  sign,
  decimals,
  className,
}: {
  amount: Agorot;
  sign?: boolean;
  decimals?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("num whitespace-nowrap", className)} dir="ltr">
      {ils(amount, { sign, decimals })}
    </span>
  );
}
