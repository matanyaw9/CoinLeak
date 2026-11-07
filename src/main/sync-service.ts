// One Sync button press: download with self-login, save to the ledger, and
// report each stage to the window. Holds the cancel switch for the running sync.

import { CodedError } from "@shared/errors";
import type { ProviderId, ScrapedAccount, SyncProgress, SyncResult, SyncStage } from "@shared/types";
import type { Db } from "@core/db";
import type { IngestOptions } from "@core/ledger";
import type { SyncDownload, SyncOptions } from "./sync";

const PROVIDERS: readonly ProviderId[] = ["discount", "visaCal"];

export interface SyncServiceDeps {
  db: Db;
  runSync(provider: ProviderId, options: SyncOptions): Promise<SyncDownload>;
  ingest(db: Db, accounts: ScrapedAccount[], options: IngestOptions): SyncResult;
  emit(progress: SyncProgress): void;
  now?: () => Date;
}

export interface SyncService {
  start(provider: ProviderId): Promise<SyncResult>;
  cancel(): void;
}

export function createSyncService(deps: SyncServiceDeps): SyncService {
  let current: AbortController | undefined;
  const now = deps.now ?? (() => new Date());

  return {
    async start(provider) {
      if (!PROVIDERS.includes(provider)) throw new CodedError("BAD_REQUEST");
      if (current) throw new CodedError("SYNC_IN_PROGRESS");
      const controller = new AbortController();
      current = controller;
      const stage = (s: SyncStage): void => deps.emit({ provider, stage: s });
      try {
        const { accounts, since } = await deps.runSync(provider, { signal: controller.signal, onProgress: stage });
        stage("saving");
        const judgePending = trustsPending(provider, accounts);
        const result = deps.ingest(deps.db, accounts, { now: now(), provider, since, judgePending });
        stage("done");
        return result;
      } catch (e) {
        stage("failed");
        throw e instanceof CodedError ? e : new CodedError("DATABASE");
      } finally {
        current = undefined;
      }
    },
    cancel() {
      current?.abort();
    },
  };
}

/**
 * Whether the download's pending rows can be judged complete. When Cal's
 * pending request fails the library just returns no pending rows
 * (visa-cal.js L366-372), which would turn every stored Cal pending row gone.
 */
function trustsPending(provider: ProviderId, accounts: ScrapedAccount[]): boolean {
  return provider !== "visaCal" || accounts.some((a) => a.transactions.some((t) => t.status === "pending"));
}
