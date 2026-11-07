// The soft rounded card every screen is built from, with its small label.
// Adapted from Spent (github.com/Shaya16/Spent), src/components/home/card-shell.tsx.

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/misc";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-3xl border border-border bg-card p-6", className)}>{children}</section>;
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase", className)}>
      {children}
    </h3>
  );
}

export function CardHeader({ label, action }: { label: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex min-h-6 items-center justify-between gap-3">
      <Label>{label}</Label>
      {action && <div className="text-xs text-muted-foreground">{action}</div>}
    </div>
  );
}

export function CardSkeleton({ label, height = 180, className }: { label?: ReactNode; height?: number; className?: string }) {
  return (
    <Card className={className}>
      {label && <CardHeader label={label} />}
      <Skeleton className="w-full" style={{ height }} />
    </Card>
  );
}
