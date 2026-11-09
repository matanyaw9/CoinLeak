// Friendly empty and error states: an icon, a short title, one line of help.

import type { ReactNode } from "react";
import { Link } from "react-router";
import { Inbox, type LucideIcon } from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { ApiError, isNotBuilt } from "@/lib/api";
import { buttonVariants } from "@/components/ui/button";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-16", className)}>
      <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <p className="font-heading text-xl tracking-tight">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm text-pretty text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** What to show when a query failed: "not built yet" reads as an empty app. */
export function QueryError({ error, compact, className }: { error: unknown; compact?: boolean; className?: string }) {
  if (isNotBuilt(error)) {
    return (
      <EmptyState
        compact={compact}
        className={className}
        title={s.empty.noDataTitle}
        body={s.empty.noDataBody}
        action={
          compact ? undefined : (
            <Link to="/accounts" className={buttonVariants({ variant: "outline", size: "sm" })}>
              {s.empty.goToAccounts}
            </Link>
          )
        }
      />
    );
  }
  return (
    <EmptyState
      compact={compact}
      className={className}
      title={s.empty.errorTitle}
      body={error instanceof ApiError ? error.message : `${s.errors.loadFailed} ${s.errors.tryAgain}`}
    />
  );
}
