// The sidebar's bottom card: the open profile's name, and a small menu to
// switch to another profile (spec 19). In the Demo profile it says so.

import { useState } from "react";
import { toast } from "sonner";
import { Link } from "react-router";
import { Check, ChevronsUpDown, FlaskConical, Lock, Settings } from "lucide-react";
import type { Profile } from "@shared/types";
import { s } from "@/strings";
import { cn } from "@/lib/utils";
import { ApiError, call } from "@/lib/api";
import { useShot } from "@/lib/shot";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentProfile, useProfiles } from "./use-profiles";

/** Asks main to switch; main reloads the window when it is done. */
export function switchProfile(id: string): void {
  call("profiles:switch", { id }).catch((e: unknown) => toast.error(e instanceof ApiError ? e.message : s.errors.crashBody));
}

export function ProfileSwitcher() {
  const profiles = useProfiles().data?.profiles ?? [];
  const current = useCurrentProfile();
  // Screenshot aid: `?shot=profiles` shows the menu open.
  const [open, setOpen] = useState(useShot() === "profiles");
  if (!current) return <div className="h-[66px]" />;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-3 text-start transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/50",
          current.demo
            ? "border border-status-heads-up/30 bg-status-heads-up/10 hover:bg-status-heads-up/15"
            : "bg-sidebar-accent/60 hover:bg-sidebar-accent",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            {current.demo ? (
              <FlaskConical className="size-4 shrink-0 text-status-heads-up" strokeWidth={1.75} />
            ) : (
              <Lock className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
            )}
            <span className="min-w-0 leading-snug break-words">{current.demo ? s.profiles.demoName : current.name}</span>
          </div>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            {current.demo ? s.profiles.demoHint : s.app.localOnlyHint}
          </p>
        </div>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 p-1.5">
        <p className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{s.profiles.switchTo}</p>
        {profiles.map((p) => (
          <ProfileItem key={p.id} profile={p} isCurrent={p.id === current.id} onPick={() => setOpen(false)} />
        ))}
        <div className="my-1 h-px bg-border" />
        <Link
          to="/settings"
          onClick={() => setOpen(false)}
          className="flex h-9 items-center gap-2.5 rounded-xl px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:bg-accent"
        >
          <Settings className="size-4" strokeWidth={1.75} />
          {s.profiles.manage}
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function ProfileItem({ profile, isCurrent, onPick }: { profile: Profile; isCurrent: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      disabled={isCurrent}
      onClick={() => {
        onPick();
        switchProfile(profile.id);
      }}
      className="flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-start text-sm transition-colors outline-none hover:bg-accent focus-visible:bg-accent disabled:hover:bg-transparent"
    >
      <span className="min-w-0 flex-1 truncate">{profile.name}</span>
      {profile.demo && <FlaskConical className="size-3.5 text-status-heads-up" strokeWidth={1.75} />}
      {isCurrent && <Check className="size-4 text-primary" />}
    </button>
  );
}
