// Settings > Profiles (spec 19): the list, Add (a name only), Rename, Delete
// (type the name to confirm), and the Demo profile's Add and Reset.

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FlaskConical, Plus } from "lucide-react";
import type { Profile } from "@shared/types";
import { s } from "@/strings";
import { ApiError, call } from "@/lib/api";
import { Card, Label } from "@/components/common/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/misc";
import { switchProfile } from "./profile-switcher";
import { useProfiles } from "./use-profiles";

type Open = { kind: "add" } | { kind: "rename"; profile: Profile } | { kind: "delete"; profile: Profile } | null;

const p = s.profiles;

function showError(e: unknown): void {
  toast.error(e instanceof ApiError ? e.message : s.errors.crashBody);
}

export function ProfilesSection() {
  const list = useProfiles().data;
  const client = useQueryClient();
  const [open, setOpen] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  if (!list) return null;

  const realCount = list.profiles.filter((x) => !x.demo).length;
  const hasDemo = list.profiles.some((x) => x.demo);

  /** Runs a change, refreshes the list, and closes the dialog. */
  const change = (action: () => Promise<unknown>, done?: () => void) => {
    setBusy(true);
    action()
      .then(() => {
        setOpen(null);
        done?.();
        return client.invalidateQueries({ queryKey: ["profiles:list"] });
      })
      .catch(showError)
      .finally(() => setBusy(false));
  };

  return (
    <Card className="p-7">
      <Label>{p.title}</Label>
      <p className="mt-2 text-sm text-muted-foreground">{p.hint}</p>
      <ul className="mt-5 divide-y divide-border rounded-2xl border border-border">
        {list.profiles.map((profile) => {
          const isCurrent = profile.id === list.current;
          const canDelete = !isCurrent && (profile.demo || realCount > 1);
          return (
            <li key={profile.id} className="flex items-center gap-3 px-4 py-3">
              {profile.demo && <FlaskConical className="size-4 shrink-0 text-status-heads-up" strokeWidth={1.75} />}
              <span className="min-w-0 truncate text-sm font-medium">{profile.name}</span>
              {isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{p.current}</span>}
              <div className="ms-auto flex shrink-0 items-center gap-1">
                {profile.demo && (
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => change(() => call("profiles:resetDemo", undefined), () => toast.success(p.resetDone))}>
                    {p.resetDemo}
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setOpen({ kind: "rename", profile })}>
                  {p.rename}
                </Button>
                {canDelete && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setOpen({ kind: "delete", profile })}>
                    {p.delete}
                  </Button>
                )}
                {!isCurrent && (
                  <Button variant="outline" size="sm" onClick={() => switchProfile(profile.id)}>
                    {p.open}
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen({ kind: "add" })}>
          <Plus className="size-3.5" />
          {p.add}
        </Button>
        {!hasDemo && (
          <Button variant="ghost" size="sm" disabled={busy} title={p.addDemoHint} onClick={() => change(() => call("profiles:addDemo", undefined))}>
            <FlaskConical className="size-3.5" />
            {p.addDemo}
          </Button>
        )}
      </div>

      {open?.kind === "add" && (
        <NameDialog
          title={p.addTitle}
          action={p.create}
          initial=""
          busy={busy}
          onClose={() => setOpen(null)}
          onSave={(name) => change(() => call("profiles:add", { name }))}
        />
      )}
      {open?.kind === "rename" && (
        <NameDialog
          title={p.renameTitle}
          action={p.save}
          initial={open.profile.name}
          busy={busy}
          onClose={() => setOpen(null)}
          onSave={(name) => change(() => call("profiles:rename", { id: open.profile.id, name }))}
        />
      )}
      {open?.kind === "delete" && (
        <DeleteDialog
          profile={open.profile}
          busy={busy}
          onClose={() => setOpen(null)}
          onDelete={() => change(() => call("profiles:delete", { id: open.profile.id }))}
        />
      )}
    </Card>
  );
}

function NameDialog(props: {
  title: string;
  action: string;
  initial: string;
  busy: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState(props.initial);
  const ok = name.trim().length > 0 && name.trim().length <= 40;
  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-md p-7">
        <DialogTitle>{props.title}</DialogTitle>
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (ok) props.onSave(name);
          }}
        >
          <label className="text-sm font-medium" htmlFor="profile-name">
            {p.name}
          </label>
          <Input id="profile-name" autoFocus className="mt-2" maxLength={40} placeholder={p.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={props.onClose}>
              {p.cancel}
            </Button>
            <Button type="submit" disabled={!ok || props.busy}>
              {props.action}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ profile, busy, onClose, onDelete }: { profile: Profile; busy: boolean; onClose: () => void; onDelete: () => void }) {
  const [typed, setTyped] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-7">
        <DialogTitle>{p.deleteTitle(profile.name)}</DialogTitle>
        <DialogDescription className="mt-2 leading-relaxed">{p.deleteBody}</DialogDescription>
        <label className="mt-5 block text-sm" htmlFor="profile-delete">
          {p.deleteType(profile.name)}
        </label>
        <Input id="profile-delete" autoFocus className="mt-2" value={typed} onChange={(e) => setTyped(e.target.value)} />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {p.cancel}
          </Button>
          <Button variant="destructive" disabled={typed !== profile.name || busy} onClick={onDelete}>
            {p.delete}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
