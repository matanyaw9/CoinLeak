// The top bar Sync button: opens a small panel with one row per provider the
// user has (money accounts or added), an "Add a bank or card" button, and
// shows who is syncing, the stage and the time so far while a sync runs. Whether the panel and
// the Add picker are open lives in the sync context, so other screens can open them.

import { useEffect } from "react";
import { LoaderCircle, Plus, RefreshCw } from "lucide-react";
import type { ProviderId, SyncStage } from "@shared/types";
import { s } from "@/strings";
import { useSync, useSyncElapsed } from "@/lib/sync";
import { useAccounts } from "@/lib/hooks";
import { useShot } from "@/lib/shot";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddProviderDialog } from "@/components/accounts/add-provider-dialog";
import { syncingAccounts, visibleProviders } from "@/components/accounts/provider-groups";
import { cn } from "@/lib/utils";
import { ProviderSyncRow } from "./sync-parts";

export function SyncButton() {
  const sync = useSync();
  const accounts = useAccounts();
  const busy = sync.provider != null;
  const shown = visibleProviders(accounts.data, sync.added);
  // Accounts removed from syncing keep their rows but leave this panel (spec 15).
  const syncing = syncingAccounts(accounts.data);
  const shot = useDemoShot(accounts.isSuccess);

  const openPicker = () => {
    sync.setPanelOpen(false);
    sync.setPickerOpen(true);
  };

  return (
    <>
      <Popover open={sync.panelOpen} onOpenChange={sync.setPanelOpen}>
        <PopoverTrigger
          className={cn(buttonVariants(), "h-9 rounded-xl px-4")}
          title={busy ? s.syncLive.keepOpen : undefined}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
          {busy && sync.provider && sync.stage ? <BusyLabel provider={sync.provider} stage={sync.stage} /> : s.sync.button}
        </PopoverTrigger>
        <PopoverContent className="w-96 p-5">
          <p className="font-heading text-lg tracking-tight">{s.sync.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.sync.intro}</p>
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            {shown.length === 0 && <p className="text-sm text-muted-foreground">{s.money.nothingBody}</p>}
            {shown.map((p) => (
              <ProviderSyncRow
                key={p}
                provider={p}
                accounts={syncing}
                withTooltip
                tooltipOpen={shot === `sync-tip-${p}` ? true : undefined}
              />
            ))}
          </div>
          <Button
            variant={shown.length === 0 ? "default" : "ghost"}
            size="sm"
            className="mt-4 -ms-1"
            onClick={openPicker}
          >
            <Plus className="size-3.5" />
            {s.money.add}
          </Button>
        </PopoverContent>
      </Popover>
      <AddProviderDialog shown={shown} showWhy={shot === "why"} />
    </>
  );
}

/** "Cal: Downloading 0:42" while a sync runs (spec 18). */
function BusyLabel({ provider, stage }: { provider: ProviderId; stage: SyncStage }) {
  const elapsed = useSyncElapsed();
  return (
    <>
      {s.syncLive.button(s.providers[provider].short, s.sync.stageShort[stage])}
      {elapsed && <span className="font-mono text-xs tabular-nums opacity-80">{elapsed}</span>}
    </>
  );
}

/**
 * Demo screenshot aid: `?shot=sync-tip-visaCal` opens the panel with that
 * row's tooltip held open; `?shot=add` and `?shot=why` open the Add picker.
 */
function useDemoShot(ready: boolean): string | null {
  const shot = useShot();
  const { setPanelOpen, setPickerOpen } = useSync();
  useEffect(() => {
    if (!shot || !ready) return;
    const id = setTimeout(() => {
      if (shot.startsWith("sync-tip-")) setPanelOpen(true);
      if (shot === "add" || shot === "why") setPickerOpen(true);
    }, 400);
    return () => clearTimeout(id);
    // Once per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, ready]);
  return shot;
}
