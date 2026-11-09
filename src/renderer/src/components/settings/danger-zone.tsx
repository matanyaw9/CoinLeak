// Settings > Danger zone (spec 23): delete this profile's data (Reset on the
// Demo profile), or delete everything. Both ask the user to type DELETE; main
// deletes the files and reloads the window.

import { useEffect, useRef, useState } from "react";
import { s } from "@/strings";
import { call } from "@/lib/api";
import { showFailure } from "@/lib/failure";
import { useShot } from "@/lib/shot";
import { Card, Label } from "@/components/common/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/misc";
import { useCurrentProfile } from "@/components/layout/use-profiles";

const d = s.danger;

type Wipe = "profile" | "all";

export function DangerZone() {
  const profile = useCurrentProfile();
  const [confirming, setConfirming] = useState<Wipe | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const shot = useShot();
  const loaded = profile !== undefined;
  // Demo screenshot aid: `?shot=danger` scrolls here, `?shot=delete-all` also opens the dialog.
  useEffect(() => {
    if (!loaded || (shot !== "danger" && shot !== "delete-all")) return;
    const id = setTimeout(() => {
      ref.current?.scrollIntoView({ block: "end" });
      if (shot === "delete-all") setConfirming("all");
    }, 400);
    return () => clearTimeout(id);
  }, [shot, loaded]);
  if (!profile) return null;

  /** Main reloads the window when it is done; on failure we stay and say so. */
  const wipe = (what: Wipe) => {
    setBusy(true);
    call(what === "all" ? "profiles:wipeAll" : "profiles:wipeCurrent", undefined)
      .catch((e: unknown) => {
        showFailure(e, d.failed);
        setConfirming(null);
      })
      .finally(() => setBusy(false));
  };

  return (
    <div ref={ref}>
      <Card className="p-7">
        <Label>{d.title}</Label>
        <p className="mt-2 text-sm text-muted-foreground">{d.hint}</p>
        <div className="mt-5 divide-y divide-border rounded-2xl border border-destructive/30">
          {profile.demo ? (
            <Row title={d.demoTitle} body={d.demoBody}>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => wipe("profile")}>
                {d.demoButton}
              </Button>
            </Row>
          ) : (
            <Row title={d.profileTitle} body={d.profileBody(profile.name)}>
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirming("profile")}>
                {d.profileButton}
              </Button>
            </Row>
          )}
          <Row title={d.allTitle} body={d.allBody}>
            <Button variant="outline" size="sm" className="text-destructive" onClick={() => setConfirming("all")}>
              {d.allButton}
            </Button>
          </Row>
        </div>
        {confirming && (
          <ConfirmDialog
            title={confirming === "all" ? d.confirmAllTitle : d.confirmProfileTitle(profile.name)}
            goes={confirming === "all" ? d.goesAll : d.goesProfile}
            busy={busy}
            onClose={() => setConfirming(null)}
            onConfirm={() => wipe(confirming)}
          />
        )}
      </Card>
    </div>
  );
}

function Row({ title, body, children }: { title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/** Says what goes, that it is for good, and what disks may keep. The button waits for the typed word. */
function ConfirmDialog(props: { title: string; goes: string; busy: boolean; onClose: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState("");
  const ready = typed.trim() === d.typeWord && !props.busy;
  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-w-md p-7">
        <DialogTitle>{props.title}</DialogTitle>
        <DialogDescription className="mt-2 leading-relaxed">{props.goes}</DialogDescription>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{d.noUndo}</p>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{d.disk}</p>
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (ready) props.onConfirm();
          }}
        >
          <label className="block text-sm" htmlFor="danger-confirm">
            {d.typeLabel(d.typeWord)}
          </label>
          <Input
            id="danger-confirm"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="mt-2"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={props.onClose}>
              {d.cancel}
            </Button>
            <Button type="submit" variant="destructive" disabled={!ready}>
              {d.confirm}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
