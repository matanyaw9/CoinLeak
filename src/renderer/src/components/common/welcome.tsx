// First run: a warm hello on Home and Transactions before any account is
// synced. Says what CoinLeak does, the self-login promise, and opens the
// Sync panel, or the Add picker when no bank or card has been added yet.

import { ChartPie, Coins, LoaderCircle, Lock, Plus, RefreshCw, ShieldCheck, type LucideIcon } from "lucide-react";
import { s } from "@/strings";
import { useSync } from "@/lib/sync";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { Card } from "./card";

const ICONS: LucideIcon[] = [RefreshCw, Coins, ChartPie];

/** `onAddCash`: on Transactions, cash can be added before any bank is synced. */
export function Welcome({ onAddCash }: { onAddCash?: () => void }) {
  const sync = useSync();
  const busy = sync.provider != null && sync.stage != null;

  return (
    <Card className="mx-auto max-w-4xl px-12 pt-11 pb-10">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10">
          <Logo className="size-7 text-foreground" />
        </span>
        <span className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{s.welcome.eyebrow}</span>
      </div>

      <h2 className="mt-6 max-w-2xl font-heading text-[46px] leading-[1.06] tracking-tight text-balance">{s.welcome.title}</h2>
      <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-pretty text-muted-foreground">{s.welcome.body}</p>

      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Button
          size="lg"
          className="h-11 rounded-xl px-5 text-[15px]"
          onClick={() => (sync.added.length > 0 ? sync.setPanelOpen(true) : sync.setPickerOpen(true))}
        >
          {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
          {busy && sync.stage ? s.sync.stageShort[sync.stage] : s.welcome.start}
        </Button>
        {onAddCash && (
          <Button variant="outline" size="lg" className="h-11 rounded-xl px-5 text-[15px]" onClick={onAddCash}>
            <Plus />
            {s.cash.add}
          </Button>
        )}
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-3.5" strokeWidth={2} />
          {s.welcome.local}
        </span>
      </div>

      <div className="mt-9 flex gap-4 rounded-3xl border border-primary/20 bg-primary/[0.06] p-5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
        <div>
          <p className="text-[15px] font-medium">{s.welcome.promiseTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-pretty text-muted-foreground">{s.welcome.promiseBody}</p>
        </div>
      </div>

      <ul className="mt-8 grid grid-cols-3 gap-6 border-t border-border pt-7">
        {s.welcome.features.map((f, i) => {
          const Icon = ICONS[i] ?? RefreshCw;
          return (
            <li key={f.title} className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
                  <Icon className="size-4" strokeWidth={1.75} />
                </span>
                <p className="text-[15px] font-medium">{f.title}</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">{f.body}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
