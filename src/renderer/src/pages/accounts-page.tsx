// Money accounts: one card per provider the user has (synced or added), with
// its name and tag, each money account's last sync, a card mode switch per
// card, and a Sync button that shows each stage as it happens. Accounts can be
// removed from syncing (spec 15): they move to a Removed group, rows intact.
// Look adapted from Spent (github.com/Shaya16/Spent), settings bank accounts screen.

import { useEffect, useState } from "react";
import { CreditCard, Landmark, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { Account, CardMode, ProviderId } from "@shared/types";
import { s } from "@/strings";
import { isNotBuilt } from "@/lib/api";
import { useAccounts } from "@/lib/hooks";
import { useSync } from "@/lib/sync";
import { useReviewActions } from "@/lib/review-actions";
import { useShot } from "@/lib/shot";
import { Page } from "@/components/layout/page";
import { Card } from "@/components/common/card";
import { EmptyState, QueryError } from "@/components/common/empty-state";
import { Segmented } from "@/components/common/segmented";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { accountLabel, lastDigits } from "@/components/common/chips";
import { ProviderSyncRow } from "@/components/sync/sync-parts";
import { removedAccounts, syncingAccounts, visibleProviders } from "@/components/accounts/provider-groups";
import { RemoveSyncDialog, RemovedGroup, type RemoveTarget } from "@/components/accounts/remove-sync";
import { syncedText } from "@/components/accounts/sync-time";

const MODES: CardMode[] = ["credit", "debit"];

export function AccountsPage() {
  const accounts = useAccounts();
  const sync = useSync();
  const list = accounts.data ?? [];
  const hardError = accounts.isError && !isNotBuilt(accounts.error);
  const shown = visibleProviders(list, sync.added);
  const syncing = syncingAccounts(list);
  const [removing, setRemoving] = useState<{ target: RemoveTarget; key: number } | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const askRemove = (target: RemoveTarget) => {
    setRemoving({ target, key: (removing?.key ?? 0) + 1 });
    setRemoveOpen(true);
  };
  useDemoShot(syncing, askRemove);

  return (
    <Page title={s.accounts.title}>
      <div className="mx-auto max-w-3xl">
        <div className="flex gap-4 rounded-3xl border border-primary/20 bg-primary/[0.06] p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
          <div>
            <p className="text-[15px] leading-relaxed">{s.accounts.intro}</p>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <Button variant="outline" onClick={() => sync.setPickerOpen(true)}>
            <Plus />
            {s.money.add}
          </Button>
        </div>

        <div className="mt-4 space-y-5">
          {hardError ? (
            <Card>
              <QueryError error={accounts.error} />
            </Card>
          ) : accounts.isPending ? (
            <Skeleton className="h-56 w-full rounded-3xl" />
          ) : shown.length === 0 ? (
            <Card>
              <EmptyState
                title={s.money.nothingTitle}
                body={s.money.nothingBody}
                action={
                  <Button onClick={() => sync.setPickerOpen(true)}>
                    <Plus />
                    {s.money.add}
                  </Button>
                }
              />
            </Card>
          ) : (
            shown.map((p) => (
              <ProviderCard
                key={p}
                provider={p}
                accounts={syncing.filter((a) => a.provider === p)}
                all={syncing}
                onRemove={askRemove}
              />
            ))
          )}
          <div id="removed-accounts">
            <RemovedGroup accounts={removedAccounts(list)} />
          </div>
        </div>

        <div className="mt-10 px-1">
          <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{s.accounts.safeTitle}</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {s.accounts.safe.map((line) => (
              <li key={line} className="flex items-center gap-2.5">
                <span className="size-1.5 rounded-full bg-primary/60" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {removing && (
        <RemoveSyncDialog key={removing.key} target={removing.target} open={removeOpen} onOpenChange={setRemoveOpen} />
      )}
    </Page>
  );
}

function ProviderCard({
  provider,
  accounts,
  all,
  onRemove,
}: {
  provider: ProviderId;
  /** This provider's money accounts that still sync. */
  accounts: Account[];
  all: Account[];
  onRemove: (target: RemoveTarget) => void;
}) {
  const sync = useSync();
  const removable = accounts.length === 0 && sync.provider !== provider;
  const remove = () => {
    sync.removeProvider(provider);
    toast(s.money.removed(s.providers[provider].name));
  };
  return (
    <Card className="p-0">
      <ProviderSyncRow provider={provider} accounts={all} className="p-6" />
      {accounts.length > 0 ? (
        <>
          <ul className="divide-y divide-border border-t border-border">
            {accounts.map((a) => (
              <AccountLine key={a.id} account={a} onRemove={() => onRemove({ account: a })} />
            ))}
          </ul>
          {accounts.length > 1 && (
            <div className="flex justify-end border-t border-border px-4 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={sync.provider === provider}
                onClick={() => onRemove({ provider, accounts })}
              >
                {s.removeSync.removeAll}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-3">
          <p className="text-sm text-muted-foreground">{s.accounts.noAccounts}</p>
          {removable && (
            <Button variant="ghost" size="sm" onClick={remove}>
              {s.money.remove}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

function AccountLine({ account, onRemove }: { account: Account; onRemove: () => void }) {
  const Icon = account.kind === "bank" ? Landmark : CreditCard;
  const actions = useReviewActions();
  const mode = actions.pendingCardMode(account) ?? account.cardMode;
  return (
    <li className="px-6 py-4">
      <div className="flex items-center gap-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <Icon className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[15px] font-medium">{account.name ?? s.providers[account.provider].short}</span>
            <span className="num text-sm text-muted-foreground">··{lastDigits(account)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {account.kind === "bank" ? s.accounts.bankAccount : s.accounts.card}
            {` · ${syncedText(account.lastSyncedAt)}`}
          </div>
        </div>
        {account.kind === "card" && mode && (
          <Segmented<CardMode>
            label={s.accounts.cardModeLabel}
            value={mode}
            onChange={(next) => next !== mode && actions.setCardMode(account, next, accountLabel(account))}
            options={MODES.map((m) => ({ value: m, label: s.accounts.cardMode[m] }))}
            className="shrink-0"
          />
        )}
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 ps-[52px]">
        {account.kind === "card" && mode ? (
          <p className="text-xs text-muted-foreground">{s.accounts.cardModeHelp[mode]}</p>
        ) : (
          <span />
        )}
        <Button variant="ghost" size="xs" className="-me-2 shrink-0 text-muted-foreground" onClick={onRemove}>
          {s.removeSync.remove}
        </Button>
      </div>
    </li>
  );
}

/**
 * Screenshot aid: `?shot=remove-4821` asks to remove the account ending 4821,
 * `?shot=remove-visaCal` a whole provider, `?shot=removed` scrolls to the Removed group.
 */
function useDemoShot(syncing: Account[], ask: (target: RemoveTarget) => void) {
  const shot = useShot();
  const ready = syncing.length > 0;
  useEffect(() => {
    if (!shot?.startsWith("remove") || !ready) return;
    const id = setTimeout(() => {
      if (shot === "removed") document.getElementById("removed-accounts")?.scrollIntoView({ block: "end" });
      const key = shot.slice("remove-".length);
      const account = syncing.find((a) => a.accountNumber === key);
      const mine = syncing.filter((a) => a.provider === key);
      if (account) ask({ account });
      else if (mine.length > 0) ask({ provider: key as ProviderId, accounts: mine });
    }, 400);
    return () => clearTimeout(id);
    // Once per load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot, ready]);
}
