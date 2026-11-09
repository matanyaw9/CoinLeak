// Settings > How far back to sync (spec 23): as far as each bank allows, or
// from a day the user picks, and what each of the user's banks allows.

import { useEffect, useRef, useState } from "react";
import type { IsoDate, SyncFrom } from "@shared/types";
import { s } from "@/strings";
import { showFailure } from "@/lib/failure";
import { useAccounts } from "@/lib/hooks";
import { toIsoDate } from "@/lib/month";
import { useShot } from "@/lib/shot";
import { useSync } from "@/lib/sync";
import { Card, Label } from "@/components/common/card";
import { Segmented } from "@/components/common/segmented";
import { Input } from "@/components/ui/misc";
import { visibleProviders } from "@/components/accounts/provider-groups";
import { ENABLED_PROVIDERS } from "@shared/providers";
import { groupLimits, useSaveSyncFrom, useSyncFrom, useSyncRanges } from "@/components/sync/sync-range";

const r = s.syncRange;
const FIRST_DAY = "2000-01-01";

type Mode = "max" | "day";

export function SyncRangeSection() {
  const saved = useSyncFrom().data;
  const ranges = useSyncRanges().data ?? [];
  const accounts = useAccounts().data;
  const { added } = useSync();
  const save = useSaveSyncFrom();
  // The day shown while choosing; saved only when it is a whole, valid day.
  const [draft, setDraft] = useState<IsoDate | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const shot = useShot();
  const loaded = saved !== undefined;
  // Demo screenshot aid: `?shot=sync-range` scrolls here.
  useEffect(() => {
    if (loaded && shot === "sync-range") ref.current?.scrollIntoView({ block: "center" });
  }, [shot, loaded]);
  if (saved === undefined) return null;

  const mode: Mode = saved === "max" ? "max" : "day";
  const today = toIsoDate(new Date());
  const day = draft ?? (saved === "max" ? oneYearAgo() : saved);
  // The user's banks; before there are any, every bank CoinLeak can sync.
  const mine = visibleProviders(accounts, added);
  const groups = groupLimits(ranges, mine.length > 0 ? mine : ENABLED_PROVIDERS);

  const store = (value: SyncFrom) => save(value).catch((e: unknown) => showFailure(e, r.failed));

  const pickMode = (next: Mode) => {
    if (next === mode) return;
    setDraft(null);
    void store(next === "max" ? "max" : day);
  };

  const pickDay = (value: string) => {
    setDraft(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value) && value >= FIRST_DAY && value <= today) void store(value);
  };

  return (
    <div ref={ref}>
      <Card className="p-7">
        <Label>{r.title}</Label>
        <p className="mt-2 text-sm text-muted-foreground">{r.hint}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Segmented<Mode>
            label={r.label}
            value={mode}
            onChange={pickMode}
            options={[
              { value: "max", label: r.max },
              { value: "day", label: r.fromDay },
            ]}
          />
          {mode === "day" && (
            <Input
              type="date"
              aria-label={r.dayLabel}
              className="h-9 w-44"
              min={FIRST_DAY}
              max={today}
              value={day}
              onChange={(e) => pickDay(e.target.value)}
            />
          )}
        </div>
        {mode === "day" && <p className="mt-3 text-xs text-muted-foreground">{r.earlierNote}</p>}
        {groups.length > 0 && (
          <div className="mt-5 rounded-2xl border border-border px-4 py-3.5">
            <div className="text-sm font-medium">{r.limits}</div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {groups
                .map((g) => `${g.providers.map((p) => s.providers[p].short).join(", ")} ${r.duration(g.months)}`)
                .join(" · ")}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function oneYearAgo(): IsoDate {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return toIsoDate(d);
}
