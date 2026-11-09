// One Sync button press: download with self-login, save to the ledger, and
// report each stage to the window. Holds the cancel switch for the running sync.

import { CodedError } from "@shared/errors";
import { isEnabledProvider } from "@shared/providers";
import type { ProviderId, ScrapedAccount, SyncProgress, SyncResult, SyncStage } from "@shared/types";
import type { Db } from "@core/db";
import type { IngestOptions } from "@core/ledger";
import type { SyncDownload, SyncOptions } from "./sync";

export interface SyncServiceDeps {
  /** The open profile's database at the moment of saving (spec 19). */
  getDb(): Db;
  runSync(provider: ProviderId, options: SyncOptions): Promise<SyncDownload>;
  ingest(db: Db, accounts: ScrapedAccount[], options: IngestOptions): SyncResult;
  emit(progress: SyncProgress): void;
  now?: () => Date;
}

export interface SyncService {
  start(provider: ProviderId): Promise<SyncResult>;
  cancel(): void;
  /** True while a sync downloads or saves; switching profiles waits for it. */
  isRunning(): boolean;
}

export function createSyncService(deps: SyncServiceDeps): SyncService {
  let current: AbortController | undefined;
  const now = deps.now ?? (() => new Date());

  return {
    async start(provider) {
      // Only providers self-login can sync (spec 08); anything else from the window is refused.
      if (!isEnabledProvider(provider)) throw new CodedError("BAD_REQUEST");
      if (current) throw new CodedError("SYNC_IN_PROGRESS");
      const controller = new AbortController();
      current = controller;
      const stage = (s: SyncStage): void => deps.emit({ provider, stage: s });
      try {
        const { accounts, since } = await deps.runSync(provider, { signal: controller.signal, onProgress: stage });
        stage("saving");
        const judgePending = trustsPending(provider, accounts);
        const result = deps.ingest(deps.getDb(), accounts, { now: now(), provider, since, judgePending });
        stage("done");
        // Counts only: never row text or amounts in the log.
        console.log(
          `[sync] ${provider}: ${result.accounts} accounts, ${result.newRows} new rows, ${result.updatedRows} updated`,
        );
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
    isRunning() {
      return current !== undefined;
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
