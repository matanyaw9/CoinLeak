// Sync building blocks shared by the top bar and the Money accounts page: the
// stage stepper, the live note, the "log in now" note, and one row per provider with its
// Sync and Cancel buttons, "Download everything again" (spec 32) and a tooltip
// of its money accounts' last syncs.

import { AppWindow, Check, LoaderCircle, RefreshCw } from "lucide-react";
import type { Account, ProviderId, SyncStage } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { useSync, useSyncElapsed } from "@/lib/sync";
import { formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProviderBadge, lastDigits } from "@/components/common/chips";
import { ProviderTag } from "@/components/accounts/provider-tag";
import { syncedText } from "@/components/accounts/sync-time";
import { useCurrentProfile } from "@/components/layout/use-profiles";
import { formatRangeDay, scopeText, useQuickStart, useSyncStart } from "./sync-range";

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

/** A pulsing dot: the sync is alive. Decorative; the words carry the state. */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-2 shrink-0", className)} aria-hidden>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2 rounded-full bg-primary" />
    </span>
  );
}

/** While a sync runs (spec 18): who, how long so far, and to keep the bank window open. */
export function LiveNote({ provider, className }: { provider: ProviderId; className?: string }) {
  const elapsed = useSyncElapsed();
  const { scope } = useSync();
  return (
    <div className={cn("rounded-2xl border border-border bg-muted/50 px-3.5 py-3", className)}>
      <div className="flex items-center gap-2.5">
        <LiveDot />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.syncLive.working(s.providers[provider].short)}</span>
        {elapsed && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-label={s.syncLive.elapsed(elapsed)}>
            {elapsed}
          </span>
        )}
      </div>
      {scope && <p className="mt-1.5 text-xs font-medium">{scopeText(scope)}</p>}
      <p role="status" className="mt-1.5 text-xs leading-relaxed text-pretty text-muted-foreground">
        {s.syncLive.keepOpen}
      </p>
    </div>
  );
}

/** "Cal ••4821: synced today 09:14", one line per money account. */
export function SyncTimes({ provider, accounts }: { provider: ProviderId; accounts: Account[] | undefined }) {
  const mine = (accounts ?? []).filter((a) => a.provider === provider);
  const short = s.providers[provider].short;
  if (mine.length === 0) return <p>{s.money.accountLine(short, s.money.neverSynced)}</p>;
  return (
    <ul className="space-y-0.5">
      {mine.map((a) => (
        <li key={a.id}>{s.money.accountLine(`${short} ••${lastDigits(a)}`, syncedText(a.lastSyncedAt))}</li>
      ))}
    </ul>
  );
}

export function ProviderSyncRow({
  provider,
  accounts,
  className,
  withTooltip,
  tooltipOpen,
  showStart,
}: {
  provider: ProviderId;
  accounts: Account[] | undefined;
  className?: string;
  /** Hovering the row or its Sync button lists each money account's last sync. */
  withTooltip?: boolean;
  /** Demo screenshots only: hold the tooltip open. */
  tooltipOpen?: boolean;
  /** "Downloads from <day>" under the name (spec 23). */
  showStart?: boolean;
}) {
  const start = useSyncStart(provider);
  const quickStart = useQuickStart(provider);
  const sync = useSync();
  const mine = sync.provider === provider;
  const busy = sync.provider != null;
  // The Demo profile never syncs; main refuses too (spec 19).
  const demo = useCurrentProfile()?.demo ?? false;
  const when = lastSync(accounts, provider);
  const stage = mine ? sync.stage : null;
  const head = (
    <div className="flex items-center gap-3">
      <ProviderBadge provider={provider} size={36} className="text-base" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{s.providers[provider].name}</span>
          <ProviderTag provider={provider} />
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {stage ? s.sync.stageShort[stage] : when ? s.sync.lastSynced(formatRelative(when)) : s.sync.never}
        </div>
        {showStart && start && (
          <div className="truncate text-xs text-muted-foreground">
            {s.syncRange.downloadsFrom(formatRangeDay(quickStart ?? start))}
          </div>
        )}
        {/* After the first sync, Sync is quick; this is the slower full download (spec 32). */}
        {!mine && quickStart && start && (
          <Button
            variant="link"
            size="xs"
            className="-ms-0.5 h-auto px-0.5 py-0.5 text-xs font-normal"
            disabled={busy || demo}
            title={demo ? s.profiles.syncOff : s.quickSync.everythingTitle(formatRangeDay(start))}
            onClick={() => sync.start(provider, "full")}
          >
            {s.quickSync.everything}
          </Button>
        )}
      </div>
      {mine ? (
        stage &&
        CANCELLABLE.includes(stage) && (
          <Button variant="outline" size="sm" onClick={sync.cancel}>
            {s.sync.cancel}
          </Button>
        )
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={busy || demo}
          title={demo ? s.profiles.syncOff : undefined}
          onClick={() => sync.start(provider)}
        >
          <RefreshCw className="size-3.5" />
          {s.sync.syncOne}
        </Button>
      )}
    </div>
  );
  return (
    <div className={className}>
      {withTooltip ? (
        <Tooltip open={tooltipOpen}>
          <TooltipTrigger render={head} />
          <TooltipContent side="left" align="center" sideOffset={28}>
            <SyncTimes provider={provider} accounts={accounts} />
          </TooltipContent>
        </Tooltip>
      ) : (
        head
      )}
      {stage && STEPS.includes(stage) && <LiveNote provider={provider} className="mt-4 ms-12" />}
      {stage && stage !== "failed" && <SyncSteps stage={stage} className="mt-4 ms-12" />}
      {stage === "waiting_for_login" && <LoginNote className="mt-4 ms-12" />}
    </div>
  );
}
