// Removing money accounts from syncing (F24), and adding them back. Always
// asks first and says plainly that the transactions stay and keep counting.
// Only the sync flag changes; no row is ever deleted or hidden.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Landmark, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { Account, ProviderId } from "@shared/types";
import { s } from "@/strings";
import { showFailure } from "@/lib/failure";
import { call } from "@/lib/api";
import { useSync } from "@/lib/sync";
import { useAccounts } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Card, Label } from "@/components/common/card";
import { accountLabel, lastDigits } from "@/components/common/chips";
import { syncedText } from "./sync-time";

/** What the question is about: one money account, or every one of a provider. */
export type RemoveTarget = { account: Account } | { provider: ProviderId; accounts: Account[] };

export function useSetSyncing() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (args: { ids: number[]; enabled: boolean }) => call("accounts:setSyncing", args),
    onSettled: () => client.invalidateQueries({ queryKey: ["accounts:list"] }),
    onError: (e) => showFailure(e, s.errors.failed.syncing),
  });
}

export function RemoveSyncDialog({
  target,
  open,
  onOpenChange,
}: {
  target: RemoveTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setSyncing = useSetSyncing();
  const sync = useSync();
  const accounts = useAccounts();
  const single = "account" in target;
  const provider = single ? target.account.provider : target.provider;
  const label = single ? accountLabel(target.account) : s.providers[target.provider].name;
  const ids = single ? [target.account.id] : target.accounts.map((a) => a.id);

  const confirm = () => {
    setSyncing.mutate(
      { ids, enabled: false },
      {
        onSuccess: () => {
          // With no money account of it left syncing, it leaves the Sync panel too.
          const left = (accounts.data ?? []).filter(
            (a) => a.provider === provider && a.syncEnabled !== false && !ids.includes(a.id),
          );
          if (left.length === 0) sync.removeProvider(provider);
          toast.success(s.removeSync.done(label), { description: s.removeSync.doneBody });
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-7">
        <DialogTitle>{single ? s.removeSync.title(label) : s.removeSync.titleProvider(label)}</DialogTitle>
        <DialogDescription className="mt-2 leading-relaxed text-pretty">
          {single ? s.removeSync.body : s.removeSync.bodyProvider(ids.length)}
        </DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {s.removeSync.cancel}
          </Button>
          <Button variant="destructive" disabled={setSyncing.isPending || ids.length === 0} onClick={confirm}>
            {s.removeSync.confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The "Removed from syncing" group on the Money accounts page, with Add back. */
export function RemovedGroup({ accounts }: { accounts: Account[] }) {
  const setSyncing = useSetSyncing();
  if (accounts.length === 0) return null;
  const addBack = (a: Account) =>
    setSyncing.mutate({ ids: [a.id], enabled: true }, { onSuccess: () => toast.success(s.removeSync.addedBack(accountLabel(a))) });
  return (
    <Card className="p-0">
      <div className="px-6 pt-5 pb-3">
        <Label>{s.removeSync.removedTitle}</Label>
        <p className="mt-1.5 text-sm text-muted-foreground">{s.removeSync.removedIntro}</p>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {accounts.map((a) => {
          const Icon = a.kind === "bank" ? Landmark : CreditCard;
          return (
            <li key={a.id} className="flex items-center gap-4 px-6 py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground/70">
                <Icon className="size-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[15px] font-medium text-muted-foreground">
                    {a.name ?? s.providers[a.provider].short}
                  </span>
                  <span className="num text-sm text-muted-foreground">··{lastDigits(a)}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.providers[a.provider].name} · {syncedText(a.lastSyncedAt)}
                </div>
              </div>
              <Button variant="outline" size="sm" disabled={setSyncing.isPending} onClick={() => addBack(a)}>
                <RotateCcw className="size-3.5" />
                {s.removeSync.addBack}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
