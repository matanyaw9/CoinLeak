// Settings > Backup and export (spec 39): back up the open profile, restore
// a backup as a new profile (spec 41 B: after choosing what to bring over),
// export transactions as CSV. Main opens the
// dialogs and keeps every path; the window only shows what happened.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArchiveRestore, DatabaseBackup, FileSpreadsheet, LoaderCircle, LockKeyhole, type LucideIcon } from "lucide-react";
import { ERROR_MESSAGES } from "@shared/errors";
import type { FileSaved, RestoreCounts, RestoreKeep } from "@shared/types";
import { s } from "@/strings";
import { call } from "@/lib/api";
import { showFailure } from "@/lib/failure";
import { toIsoDate } from "@/lib/month";
import { useShot } from "@/lib/shot";
import { Card, Label } from "@/components/common/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/misc";
import { useCurrentProfile } from "@/components/layout/use-profiles";

const b = s.backup;
const c = s.restoreChoice;
const PARTS = ["transactions", "rules", "budgets"] as const;
/** What came over, set before the window reloads after a restore; Settings says it once on the new page. */
const RESTORED_KEY = "coinleak.restored";
/** True while that reload is on its way, so this page does not use up the message. */
let reloading = false;
const TOAST_WAIT = 400;

/**
 * Asks main to restore a backup (Settings and the Welcome screen). Main
 * switches to the new profile; the window then reloads on Settings, where
 * the message waits. A refusal is said at once; Cancel says nothing.
 */
export async function restoreBackup(keep: RestoreKeep): Promise<void> {
  try {
    const profile = await call("backup:restore", keep);
    if (!profile) return;
    reloading = true;
    sessionStorage.setItem(RESTORED_KEY, JSON.stringify(profile.brought));
    window.location.hash = "#/settings";
    window.location.reload();
  } catch (e) {
    showFailure(e, b.failed.restore);
  }
}

type Action = "backup" | "restore" | "csv";

export function BackupSection() {
  const profile = useCurrentProfile();
  const [busy, setBusy] = useState<Action | null>(null);
  const [choosing, setChoosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const shot = useShot();
  const profileName = profile?.name;

  // After a restore, the new page says so once. Both effects wait a moment:
  // a toast sent before the toaster is listening on a fresh page is lost.
  useEffect(() => {
    const stored = sessionStorage.getItem(RESTORED_KEY);
    if (reloading || profileName === undefined || stored === null) return;
    const id = setTimeout(() => {
      sessionStorage.removeItem(RESTORED_KEY);
      showRestored(JSON.parse(stored) as RestoreCounts);
    }, TOAST_WAIT);
    return () => clearTimeout(id);
  }, [profileName]);

  // Demo screenshot aids: `?shot=backup` scrolls here, `backup-choose` opens the restore choices; the others
  // fake a result, never opening a file dialog.
  useEffect(() => {
    if (profileName === undefined || !shot?.startsWith("backup")) return;
    const id = setTimeout(() => {
      ref.current?.scrollIntoView({ block: "center" });
      const fileName = `CoinLeak backup ${profileName} ${toIsoDate(new Date())}.coinleak`;
      if (shot === "backup-done") savedToast(b.saved, { fileName, transactions: 4213 }, Infinity);
      if (shot === "backup-refused") toast.error(ERROR_MESSAGES.BACKUP_TOO_NEW, { duration: Infinity });
      if (shot === "backup-restored") showRestored({ transactions: 1234, rules: 12, budgets: true }, Infinity);
      if (shot === "backup-choose") setChoosing(true);
    }, TOAST_WAIT);
    return () => clearTimeout(id);
  }, [shot, profileName]);

  if (!profile) return null;

  const run = (action: Action, work: () => Promise<void>) => {
    setBusy(action);
    void work().finally(() => setBusy(null));
  };

  /** Saves a backup or the CSV where the user picks; Cancel says nothing. */
  const save = (action: "backup" | "csv") =>
    run(action, async () => {
      try {
        const saved = await call(action === "backup" ? "backup:create" : "backup:exportCsv", undefined);
        if (saved) savedToast(action === "backup" ? b.saved : b.exported, saved);
      } catch (e) {
        showFailure(e, action === "backup" ? b.failed.backup : b.failed.csv);
      }
    });

  return (
    <div ref={ref}>
      <Card className="p-7">
        <Label>{b.title}</Label>
        <p className="mt-2 text-sm text-muted-foreground">{b.hint}</p>
        <div className="mt-5 divide-y divide-border rounded-2xl border border-border">
          <Row icon={DatabaseBackup} title={b.backupTitle} body={b.backupBody(profile.name)}>
            <ActionButton busy={busy} action="backup" variant="default" onClick={() => save("backup")}>
              {b.backupButton}
            </ActionButton>
          </Row>
          <Row icon={ArchiveRestore} title={b.restoreTitle} body={b.restoreBody}>
            <ActionButton busy={busy} action="restore" onClick={() => setChoosing(true)}>
              {b.restoreButton}
            </ActionButton>
          </Row>
          <Row icon={FileSpreadsheet} title={b.csvTitle} body={b.csvBody}>
            <ActionButton busy={busy} action="csv" onClick={() => save("csv")}>
              {b.csvButton}
            </ActionButton>
          </Row>
        </div>
        <div className="mt-5 flex gap-3 rounded-2xl bg-primary/[0.06] p-4">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
          <div>
            <div className="text-sm font-medium">{b.plainTitle}</div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.plainBody}</p>
          </div>
        </div>
      </Card>
      {choosing && (
        <RestoreDialog
          onClose={() => setChoosing(false)}
          onContinue={(keep) => {
            setChoosing(false);
            run("restore", () => restoreBackup(keep));
          }}
        />
      )}
    </div>
  );
}

/**
 * "What to bring over" (spec 41 B), before the file picker; Settings and the
 * Welcome screen. Shown only while open, so everything starts ticked. Space
 * or Enter on a tick box ticks it (the dialog rule), Enter on Continue continues,
 * Esc cancels.
 */
export function RestoreDialog(props: { onClose: () => void; onContinue: (keep: RestoreKeep) => void }) {
  const [keep, setKeep] = useState<RestoreKeep>({ transactions: true, rules: true, budgets: true });
  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="max-w-md p-7">
        <DialogTitle>{c.title}</DialogTitle>
        <div className="mt-4 flex flex-col gap-1">
          {PARTS.map((part) => (
            <label key={part} className="flex items-start gap-3 py-1.5 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={keep[part]}
                onClick={() => setKeep({ ...keep, [part]: !keep[part] })}
                aria-label={c.parts[part].label}
              />
              <span className="flex flex-col">
                <span>{c.parts[part].label}</span>
                <span className="text-xs text-muted-foreground">{c.parts[part].hint}</span>
              </span>
            </label>
          ))}
        </div>
        <DialogDescription className="mt-3 leading-relaxed">{c.categories}</DialogDescription>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={props.onClose}>
            {c.cancel}
          </Button>
          <Button disabled={!PARTS.some((part) => keep[part])} onClick={() => props.onContinue(keep)}>
            {c.next}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Backed up 4,213 transactions" with the file's name, never its folder. */
function savedToast(title: (n: number) => string, saved: FileSaved, duration?: number): void {
  toast.success(title(saved.transactions), { description: saved.fileName, duration });
}

function showRestored(brought: RestoreCounts, duration = 12_000): void {
  toast.success(c.done(brought), { description: b.restoredBody, duration });
}

function Row(props: { icon: LucideIcon; title: string; body: string; children: React.ReactNode }) {
  const Icon = props.icon;
  return (
    <div className="flex items-center justify-between gap-6 px-4 py-3.5">
      <div className="flex min-w-0 gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0">
          <div className="text-sm font-medium">{props.title}</div>
          <p className="mt-0.5 text-sm text-muted-foreground">{props.body}</p>
        </div>
      </div>
      <div className="shrink-0">{props.children}</div>
    </div>
  );
}

/** While one action waits on its dialog, all three wait; the running one spins. */
function ActionButton(props: {
  busy: Action | null;
  action: Action;
  variant?: "default" | "outline";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button variant={props.variant ?? "outline"} size="sm" disabled={props.busy !== null} onClick={props.onClick}>
      {props.busy === props.action && <LoaderCircle className="animate-spin" />}
      {props.children}
    </Button>
  );
}
