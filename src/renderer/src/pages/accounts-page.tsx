// Accounts: one card per provider with its accounts, card mode, last sync
// and a Sync button that shows each stage as it happens.
// Look adapted from Spent (github.com/Shaya16/Spent), settings bank accounts screen.

import { CreditCard, Landmark, ShieldCheck } from "lucide-react";
import type { Account, ProviderId } from "@shared/types";
import { s } from "@/strings";
import { isNotBuilt } from "@/lib/api";
import { useAccounts } from "@/lib/hooks";
import { formatRelative } from "@/lib/format";
import { Page } from "@/components/layout/page";
import { Card } from "@/components/common/card";
import { QueryError } from "@/components/common/empty-state";
import { Skeleton } from "@/components/ui/misc";
import { lastDigits } from "@/components/common/chips";
import { PROVIDERS, ProviderSyncRow } from "@/components/sync/sync-parts";

export function AccountsPage() {
  const accounts = useAccounts();
  const list = accounts.data ?? [];
  const hardError = accounts.isError && !isNotBuilt(accounts.error);

  return (
    <Page title={s.accounts.title}>
      <div className="mx-auto max-w-3xl">
        <div className="flex gap-4 rounded-3xl border border-primary/20 bg-primary/[0.06] p-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
          <div>
            <p className="text-[15px] leading-relaxed">{s.accounts.intro}</p>
          </div>
        </div>

        <div className="mt-8 space-y-5">
          {hardError ? (
            <Card>
              <QueryError error={accounts.error} />
            </Card>
          ) : accounts.isPending ? (
            <Skeleton className="h-56 w-full rounded-3xl" />
          ) : (
            PROVIDERS.map((p) => <ProviderCard key={p} provider={p} accounts={list.filter((a) => a.provider === p)} all={list} />)
          )}
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
    </Page>
  );
}

function ProviderCard({ provider, accounts, all }: { provider: ProviderId; accounts: Account[]; all: Account[] }) {
  return (
    <Card className="p-0">
      <ProviderSyncRow provider={provider} accounts={all} className="p-6" />
      {accounts.length > 0 ? (
        <ul className="divide-y divide-border border-t border-border">
          {accounts.map((a) => (
            <AccountLine key={a.id} account={a} />
          ))}
        </ul>
      ) : (
        <p className="border-t border-border px-6 py-4 text-sm text-muted-foreground">{s.accounts.noAccounts}</p>
      )}
    </Card>
  );
}

function AccountLine({ account }: { account: Account }) {
  const Icon = account.kind === "bank" ? Landmark : CreditCard;
  return (
    <li className="flex items-center gap-4 px-6 py-3.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
        <Icon className="size-4" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[15px] font-medium">{account.name ?? s.providers[account.provider].short}</span>
          <span className="num text-sm text-muted-foreground">··{lastDigits(account)}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {account.kind === "bank" ? s.accounts.bankAccount : s.accounts.card}
          {account.lastSyncedAt && ` · ${s.sync.lastSynced(formatRelative(account.lastSyncedAt))}`}
        </div>
      </div>
      {account.cardMode && (
        <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground/80">
          {s.accounts.cardMode[account.cardMode]}
        </span>
      )}
    </li>
  );
}
