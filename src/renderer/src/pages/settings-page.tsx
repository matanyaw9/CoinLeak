// Settings: theme (kept in localStorage), profiles, how far back to sync, where
// the data lives, the danger zone (delete data), and about.

import { Check, Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { useAppInfo } from "@/lib/hooks";
import { setTheme, THEMES, useTheme, type ThemeSetting } from "@/lib/theme";
import { Page } from "@/components/layout/page";
import { ProfilesSection } from "@/components/layout/profiles-section";
import { DangerZone } from "@/components/settings/danger-zone";
import { SyncRangeSection } from "@/components/settings/sync-range-section";
import { Card, Label } from "@/components/common/card";
import { Skeleton } from "@/components/ui/misc";

const ICONS: Record<ThemeSetting, LucideIcon> = { system: Monitor, light: Sun, dark: Moon };

export function SettingsPage() {
  const { setting } = useTheme();
  const info = useAppInfo();

  return (
    <Page title={s.settings.title}>
      <div className="mx-auto max-w-3xl space-y-6">
        <Card className="p-7">
          <Label>{s.settings.appearance}</Label>
          <p className="mt-2 text-sm text-muted-foreground">{s.settings.appearanceHint}</p>
          <div role="radiogroup" aria-label={s.settings.appearance} className="mt-5 grid grid-cols-3 gap-4">
            {THEMES.map((t) => (
              <ThemeOption key={t} value={t} selected={setting === t} />
            ))}
          </div>
        </Card>

        <ProfilesSection />

        <SyncRangeSection />

        <Card className="p-7">
          <Label>{s.settings.data}</Label>
          <p className="mt-2 text-sm text-muted-foreground">{s.settings.dataHint}</p>
          <dl className="mt-5 divide-y divide-border rounded-2xl border border-border">
            <Row label={s.settings.dataFolder}>
              {info.data ? (
                <code className="rounded-md bg-secondary px-2 py-1 font-mono text-[13px] break-all">{info.data.dataDir}</code>
              ) : (
                <Skeleton className="h-6 w-64" />
              )}
            </Row>
            <Row label={s.settings.version}>
              <span className="text-sm">
                {info.data?.version ?? ""}
                {info.data?.dev && <span className="ms-2 text-muted-foreground">· {s.settings.devBuild}</span>}
              </span>
            </Row>
          </dl>
          <div className="mt-5 rounded-2xl bg-primary/[0.06] p-4">
            <div className="text-sm font-medium">{s.settings.privacyTitle}</div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.settings.privacy}</p>
          </div>
        </Card>

        <Card className="p-7">
          <Label>{s.settings.about}</Label>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.settings.aboutBody}</p>
        </Card>

        <DangerZone />
      </div>
    </Page>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-end">{children}</dd>
    </div>
  );
}

function ThemeOption({ value, selected }: { value: ThemeSetting; selected: boolean }) {
  const Icon = ICONS[value];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => setTheme(value)}
      className={cn(
        "group rounded-2xl border p-2 text-start transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/25",
      )}
    >
      <Preview value={value} />
      <div className="flex items-center gap-2 px-1.5 pt-2.5 pb-1 text-sm">
        <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
        <span className={cn(selected && "font-medium")}>{s.settings.theme[value]}</span>
        {selected && <Check className="ms-auto size-4 text-primary" />}
      </div>
    </button>
  );
}

/** A tiny drawing of the app in each theme. System shows both halves. */
function Preview({ value }: { value: ThemeSetting }) {
  const light = { bg: "#FCF7ED", side: "#F4EBD9", card: "#FFFFFF", line: "#E6DCC8", accent: "#6E9E72" };
  const dark = { bg: "#1C1916", side: "#24201C", card: "#2A2622", line: "#3A3530", accent: "#8DB98F" };
  const half = (c: typeof light, clip?: string) => (
    <g clipPath={clip}>
      <rect width="160" height="96" fill={c.bg} />
      <rect width="38" height="96" fill={c.side} />
      <rect x="8" y="10" width="20" height="4" rx="2" fill={c.line} />
      <rect x="8" y="20" width="16" height="3" rx="1.5" fill={c.line} />
      <rect x="8" y="27" width="18" height="3" rx="1.5" fill={c.line} />
      <rect x="48" y="12" width="102" height="34" rx="7" fill={c.card} />
      <rect x="56" y="20" width="40" height="6" rx="3" fill={c.accent} />
      <rect x="56" y="31" width="64" height="4" rx="2" fill={c.line} />
      <rect x="48" y="54" width="58" height="32" rx="7" fill={c.card} />
      <rect x="112" y="54" width="38" height="32" rx="7" fill={c.card} />
    </g>
  );
  return (
    <svg viewBox="0 0 160 96" className="block w-full overflow-hidden rounded-xl ring-1 ring-border" aria-hidden>
      <defs>
        <clipPath id="theme-preview-left">
          <rect width="80" height="96" />
        </clipPath>
        <clipPath id="theme-preview-right">
          <rect x="80" width="80" height="96" />
        </clipPath>
      </defs>
      {value === "system" ? (
        <>
          {half(light, "url(#theme-preview-left)")}
          {half(dark, "url(#theme-preview-right)")}
        </>
      ) : (
        half(value === "dark" ? dark : light)
      )}
    </svg>
  );
}
