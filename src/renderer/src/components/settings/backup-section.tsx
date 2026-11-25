// Settings > Backup and export (spec 39): back up the open profile, restore
// a backup as a new profile, export transactions as CSV. Main opens the
// dialogs and keeps every path; the window only shows what happened.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArchiveRestore, DatabaseBackup, FileSpreadsheet, LoaderCircle, LockKeyhole, type LucideIcon } from "lucide-react";
import { ERROR_MESSAGES } from "@shared/errors";
import type { FileSaved } from "@shared/types";
import { s } from "@/strings";
import { call } from "@/lib/api";
import { showFailure } from "@/lib/failure";
import { toIsoDate } from "@/lib/month";
import { useShot } from "@/lib/shot";
import { Card, Label } from "@/components/common/card";
import { Button } from "@/components/ui/button";
import { useCurrentProfile } from "@/components/layout/use-profiles";

const b = s.backup;
/** Set before the window reloads after a restore; Settings says "Restored" once on the new page. */
const RESTORED_KEY = "coinleak.restored";
/** True while that reload is on its way, so this page does not use up the message. */
let reloading = false;
const TOAST_WAIT = 400;

/**
 * Asks main to restore a backup (Settings and the Welcome screen). Main
 * switches to the new profile; the window then reloads on Settings, where
 * the message waits. A refusal is said at once; Cancel says nothing.
 */
export async function restoreBackup(): Promise<void> {
  try {
    const profile = await call("backup:restore", undefined);
    if (!profile) return;
    reloading = true;
    sessionStorage.setItem(RESTORED_KEY, "1");
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
  const ref = useRef<HTMLDivElement>(null);
  const shot = useShot();
  const profileName = profile?.name;

  // After a restore, the new page says so once. Both effects wait a moment:
  // a toast sent before the toaster is listening on a fresh page is lost.
  useEffect(() => {
    if (reloading || profileName === undefined || sessionStorage.getItem(RESTORED_KEY) === null) return;
    const id = setTimeout(() => {
      sessionStorage.removeItem(RESTORED_KEY);
      showRestored();
    }, TOAST_WAIT);
    return () => clearTimeout(id);
  }, [profileName]);

  // Demo screenshot aids: `?shot=backup` scrolls here; the others fake a result, never opening a dialog.
  useEffect(() => {
    if (profileName === undefined || !shot?.startsWith("backup")) return;
    const id = setTimeout(() => {
      ref.current?.scrollIntoView({ block: "center" });
      const fileName = `CoinLeak backup ${profileName} ${toIsoDate(new Date())}.coinleak`;
      if (shot === "backup-done") savedToast(b.saved, { fileName, transactions: 4213 }, Infinity);
      if (shot === "backup-refused") toast.error(ERROR_MESSAGES.BACKUP_TOO_NEW, { duration: Infinity });
      if (shot === "backup-restored") showRestored(Infinity);
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
            <ActionButton busy={busy} action="restore" onClick={() => run("restore", restoreBackup)}>
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
    </div>
  );
}

/** "Backed up 4,213 transactions" with the file's name, never its folder. */
function savedToast(title: (n: number) => string, saved: FileSaved, duration?: number): void {
  toast.success(title(saved.transactions), { description: saved.fileName, duration });
}

function showRestored(duration = 12_000): void {
  toast.success(b.restored, { description: b.restoredBody, duration });
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
