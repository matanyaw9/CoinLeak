// A screen: sticky top bar (title, month, month picker, Sync) and content.
// Header look adapted from Spent (github.com/Shaya16/Spent), src/components/layout/app-shell.tsx.

import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { s } from "@/strings";
import { usePeriod } from "@/lib/month-context";
import { periodWords } from "@/components/home/period-words";
import { SyncButton } from "@/components/sync/sync-button";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MonthPicker } from "./month-picker";
import { useCurrentProfile } from "./use-profiles";

export function Page({
  title,
  withMonth,
  children,
}: {
  title: string;
  /** Show the period next to the title and the period picker (spec 16). */
  withMonth?: boolean;
  children: ReactNode;
}) {
  const { choice, range, today } = usePeriod();
  const demo = useCurrentProfile()?.demo ?? false;
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-8">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="truncate font-heading text-[26px] leading-none tracking-tight">{title}</h1>
            {withMonth && (
              <>
                <span className="text-sm text-muted-foreground">·</span>
                <span className="truncate text-sm text-muted-foreground">{periodWords(choice, range, today).label}</span>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {withMonth && <MonthPicker />}
            {demo ? <DemoSyncButton /> : <SyncButton />}
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1280px] px-8 pt-8 pb-16">{children}</div>
    </>
  );
}

/** The Demo profile never syncs (spec 19); main refuses too. */
function DemoSyncButton() {
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} />}>
        <Button className="h-9 rounded-xl px-4" disabled>
          <RefreshCw />
          {s.sync.button}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{s.profiles.syncOff}</TooltipContent>
    </Tooltip>
  );
}
