// Screenshot aid for the rule editor's tick boxes (spec 35), dev start route
// only like `?shot` (see lib/shot.ts): `&untick=<n>` next to a shot that
// opens the editor unticks every n-th listed row once, so a headless
// screenshot shows unticked rows. The app itself never sets it.

import { useEffect } from "react";
import { hashParam } from "@/lib/shot";

/** The editor sits outside the router, so this reads the hash route itself. */
function untickEvery(): number {
  return Number(hashParam("untick") ?? 0);
}

export function useUntickShot(shown: number[], untick: (ids: number[]) => void): void {
  const ready = shown.length > 0;
  useEffect(() => {
    const every = untickEvery();
    if (!Number.isInteger(every) || every < 2 || !ready) return;
    untick(shown.filter((_, i) => i % every === 1));
    // Once, when the list first shows: later refreshes must not repeat it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
}
