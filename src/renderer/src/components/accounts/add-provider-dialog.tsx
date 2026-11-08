// The "Add a bank or card" picker: banks and cards from the registry,
// verified first, experimental tagged, unsupported on a "Why isn't my bank
// here?" view. Choosing one adds it to the Sync panel and offers to sync it now.

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import type { ProviderId } from "@shared/types";
import { providerInfo, type ProviderInfo } from "@shared/providers";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { useSync } from "@/lib/sync";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ProviderBadge } from "@/components/common/chips";
import { groupProviders } from "./provider-groups";
import { ExperimentalTag, ProviderTag } from "./provider-tag";

const GROUPS = groupProviders();

type View = { name: "list" } | { name: "why" } | { name: "added"; provider: ProviderId };

export function AddProviderDialog({ shown, showWhy }: { shown: readonly ProviderId[]; showWhy?: boolean }) {
  const sync = useSync();
  const [view, setView] = useState<View>({ name: "list" });
  // A fresh dialog on every open, like the rule editor: it starts clean and
  // opens without waiting on an enter transition. Closing keeps it mounted
  // so it can fade out.
  const [opens, setOpens] = useState(0);
  const [wasOpen, setWasOpen] = useState(false);
  if (sync.pickerOpen !== wasOpen) {
    setWasOpen(sync.pickerOpen);
    if (sync.pickerOpen) {
      setOpens(opens + 1);
      setView(showWhy ? { name: "why" } : { name: "list" });
    }
  }
  if (opens === 0) return null;

  const close = () => sync.setPickerOpen(false);
  const choose = (id: ProviderId) => {
    sync.addProvider(id);
    setView({ name: "added", provider: id });
  };
  const syncNow = (id: ProviderId) => {
    close();
    sync.setPanelOpen(true);
    sync.start(id);
  };

  return (
    <Dialog key={opens} open={sync.pickerOpen} onOpenChange={sync.setPickerOpen}>
      <DialogContent className="max-w-2xl" closeLabel={s.money.close}>
        {view.name === "added" ? (
          <Added
            provider={view.provider}
            busy={sync.provider != null}
            onSync={() => syncNow(view.provider)}
            onLater={close}
          />
        ) : view.name === "why" ? (
          <WhyMissing onBack={() => setView({ name: "list" })} />
        ) : (
          <div className="overflow-y-auto px-8 pt-8 pb-7">
            <DialogTitle>{s.money.addTitle}</DialogTitle>
            <DialogDescription className="mt-2 max-w-lg leading-relaxed text-pretty">{s.money.addIntro}</DialogDescription>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <ExperimentalTag />
              {s.money.experimentalHint}
            </p>
            {GROUPS.groups.map((g) => (
              <section key={g.kind} className="mt-6">
                <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{s.money.group[g.kind]}</h3>
                <ul className="mt-2.5 grid grid-cols-2 gap-2">
                  {g.providers.map((p) => (
                    <li key={p.id}>
                      <ProviderOption provider={p} added={shown.includes(p.id)} onChoose={() => choose(p.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <div className="mt-7 border-t border-border pt-5">
              <button
                type="button"
                onClick={() => setView({ name: "why" })}
                className="flex items-center gap-1 rounded-md text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {s.money.whyMissing}
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProviderOption({ provider, added, onChoose }: { provider: ProviderInfo; added: boolean; onChoose: () => void }) {
  return (
    <button
      type="button"
      disabled={added}
      onClick={onChoose}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 text-start transition-colors outline-none hover:border-foreground/20 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default disabled:hover:border-border disabled:hover:bg-card"
    >
      <ProviderBadge provider={provider.id} size={32} className="text-base" />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-sm font-medium", added && "text-muted-foreground")}>{provider.name}</span>
        {added ? (
          <span className="mt-1 flex h-[18px] items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-3" strokeWidth={2.5} />
            {s.money.added}
          </span>
        ) : (
          <ProviderTag provider={provider.id} className="mt-1" />
        )}
      </span>
    </button>
  );
}

function WhyMissing({ onBack }: { onBack: () => void }) {
  return (
    <div className="overflow-y-auto px-8 pt-8 pb-7">
      <DialogTitle>{s.money.whyMissing}</DialogTitle>
      <DialogDescription className="mt-2 max-w-lg leading-relaxed text-pretty">{s.money.whyMissingIntro}</DialogDescription>
      <ul className="mt-6 space-y-5">
        {GROUPS.unsupported.map((p) => (
          <li key={p.id} className="flex gap-3.5">
            <ProviderBadge provider={p.id} size={32} className="text-base opacity-70" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{p.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-pretty text-muted-foreground">{p.reason}</p>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="ghost" className="mt-7 -ms-3" onClick={onBack}>
        <ChevronLeft />
        {s.money.back}
      </Button>
    </div>
  );
}

function Added({
  provider,
  busy,
  onSync,
  onLater,
}: {
  provider: ProviderId;
  busy: boolean;
  onSync: () => void;
  onLater: () => void;
}) {
  const info = providerInfo(provider);
  return (
    <div className="px-8 pt-8 pb-7">
      <div className="flex items-center gap-3">
        <ProviderBadge provider={provider} size={40} className="text-lg" />
        <ProviderTag provider={provider} />
      </div>
      <DialogTitle className="mt-5">{s.money.addedTitle(info.name)}</DialogTitle>
      <DialogDescription className="mt-2 max-w-md leading-relaxed text-pretty">{s.money.addedBody}</DialogDescription>
      <div className="mt-7 flex items-center gap-2.5">
        <Button disabled={busy} onClick={onSync}>
          <RefreshCw />
          {s.money.syncNow}
        </Button>
        <Button variant="ghost" onClick={onLater}>
          {s.money.later}
        </Button>
      </div>
    </div>
  );
}
