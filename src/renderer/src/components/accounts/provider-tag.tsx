// The small "Experimental" tag next to a provider that self-login supports
// but nobody has confirmed with a real account yet.

import type { ProviderId } from "@shared/types";
import { providerInfo } from "@shared/providers";
import { s } from "@/strings";
import { cn } from "@/lib/utils";

export function ProviderTag({ provider, className }: { provider: ProviderId; className?: string }) {
  return providerInfo(provider).status === "experimental" ? <ExperimentalTag className={className} /> : null;
}

export function ExperimentalTag({ className }: { className?: string }) {
  return (
    <span
      title={s.money.experimentalHint}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full bg-status-heads-up/14 px-2 py-px text-[10px] font-semibold tracking-[0.06em] text-foreground/70 uppercase",
        className,
      )}
    >
      {s.money.experimental}
    </span>
  );
}
