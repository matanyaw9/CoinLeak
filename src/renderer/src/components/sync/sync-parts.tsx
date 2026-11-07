// Sync building blocks shared by the top bar and the Accounts page: the
// stage stepper, the "log in now" note, and one row per provider with its
// Sync and Cancel buttons.

import { AppWindow, Check, LoaderCircle, RefreshCw } from "lucide-react";
import type { Account, ProviderId, SyncStage } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { useSync } from "@/lib/sync";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { ProviderBadge } from "@/components/common/chips";

export const PROVIDERS: ProviderId[] = ["discount", "visaCal"];
const STEPS: SyncStage[] = ["opening_browser", "waiting_for_login", "downloading", "saving"];
/** Stages where Cancel still stops something; saving is quick and final. */
const CANCELLABLE: SyncStage[] = ["opening_browser", "waiting_for_login", "downloading"];

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

/** Shown while the bank's login page waits for the user. */
export function LoginNote({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn("flex gap-3 rounded-2xl border border-primary/20 bg-primary/[0.06] px-3.5 py-3", className)}
    >
      <AppWindow className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-sm leading-snug font-medium text-pretty">{s.sync.loginTitle}</p>
        <p className="mt-1 text-xs leading-relaxed text-pretty text-muted-foreground">{s.sync.loginBody}</p>
      </div>
    </div>
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
  const stage = mine ? sync.stage : null;
  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <ProviderBadge provider={provider} size={36} className="text-base" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{s.providers[provider].name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {stage ? s.sync.stageShort[stage] : when ? s.sync.lastSynced(formatRelative(when)) : s.sync.never}
          </div>
        </div>
        {mine ? (
          stage &&
          CANCELLABLE.includes(stage) && (
            <Button variant="outline" size="sm" onClick={sync.cancel}>
              {s.sync.cancel}
            </Button>
          )
        ) : (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => sync.start(provider)}>
            <RefreshCw className="size-3.5" />
            {s.sync.syncOne}
          </Button>
        )}
      </div>
      {stage && stage !== "failed" && <SyncSteps stage={stage} className="mt-4 ms-12" />}
      {stage === "waiting_for_login" && <LoginNote className="mt-4 ms-12" />}
    </div>
  );
}
