// Sync building blocks shared by the top bar and the Accounts page: the
// stage stepper, and one row per provider with its Sync button.

import { Check, LoaderCircle, RefreshCw } from "lucide-react";
import type { Account, ProviderId, SyncStage } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { useSync } from "@/lib/sync";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ProviderBadge } from "@/components/common/chips";

export const PROVIDERS: ProviderId[] = ["discount", "visaCal"];
const STEPS: SyncStage[] = ["opening_browser", "waiting_for_login", "downloading", "saving"];

export function lastSync(accounts: Account[] | undefined, provider: ProviderId): string | null {
  const times = (accounts ?? []).flatMap((a) => (a.provider === provider && a.lastSyncedAt ? [a.lastSyncedAt] : []));
  return times.sort().at(-1) ?? null;
}

export function SyncSteps({ stage, className }: { stage: SyncStage; className?: string }) {
  const at = stage === "done" ? STEPS.length : STEPS.indexOf(stage);
  return (
    <ol className={cn("space-y-2.5", className)}>
      {STEPS.map((step, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <li key={step} className={cn("flex items-center gap-3 text-sm", !done && !now && "text-muted-foreground")}>
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border",
                done && "border-transparent bg-primary text-primary-foreground",
                now && "border-primary/50 text-primary",
                !done && !now && "border-border",
              )}
            >
              {done ? (
                <Check className="size-3" strokeWidth={3} />
              ) : now ? (
                <LoaderCircle className="size-3 animate-spin" strokeWidth={2.5} />
              ) : null}
            </span>
            <span className={cn(now && "font-medium")}>{s.sync.stage[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ProviderSyncRow({
  provider,
  accounts,
  className,
}: {
  provider: ProviderId;
  accounts: Account[] | undefined;
  className?: string;
}) {
  const sync = useSync();
  const mine = sync.provider === provider;
  const busy = sync.provider != null;
  const when = lastSync(accounts, provider);
  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <ProviderBadge provider={provider} size={36} className="text-base" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{s.providers[provider].name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {mine && sync.stage ? s.sync.stageShort[sync.stage] : when ? s.sync.lastSynced(formatRelative(when)) : s.sync.never}
          </div>
        </div>
        {mine ? (
          <Button variant="ghost" size="sm" onClick={sync.cancel}>
            {s.sync.cancel}
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => sync.start(provider)}>
            <RefreshCw className="size-3.5" />
            {s.sync.syncOne}
          </Button>
        )}
      </div>
      {mine && sync.stage && sync.stage !== "failed" && <SyncSteps stage={sync.stage} className="mt-4 ms-12" />}
    </div>
  );
}
