// The top bar Sync button: opens a small panel with one row per provider,
// and shows the running stage while a sync is in progress.

import { LoaderCircle, RefreshCw } from "lucide-react";
import { s } from "@/strings";
import { useSync } from "@/lib/sync";
import { useAccounts } from "@/lib/hooks";
import { buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PROVIDERS, ProviderSyncRow } from "./sync-parts";

export function SyncButton() {
  const sync = useSync();
  const accounts = useAccounts();
  const busy = sync.provider != null;
  return (
    <Popover>
      <PopoverTrigger className={cn(buttonVariants(), "h-9 rounded-xl px-4")}>
        {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
        {busy && sync.stage ? s.sync.stageShort[sync.stage] : s.sync.button}
      </PopoverTrigger>
      <PopoverContent className="w-96 p-5">
        <p className="font-heading text-lg tracking-tight">{s.sync.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.sync.intro}</p>
        <div className="mt-4 space-y-4 border-t border-border pt-4">
          {PROVIDERS.map((p) => (
            <ProviderSyncRow key={p} provider={p} accounts={accounts.data} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
