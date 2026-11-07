import { describe, expect, it } from "vitest";
import { CodedError } from "@shared/errors";
import type { ProviderId, ScrapedAccount, ScrapedTransaction, SyncProgress } from "@shared/types";
import { openDatabase } from "@core/db";
import { ingest, listTransactions, type IngestOptions } from "@core/ledger";
import type { SyncDownload, SyncOptions } from "./sync";
import { createSyncService } from "./sync-service";

const SINCE = "2025-05-09";

function row(description: string, status: ScrapedTransaction["status"] = "completed"): ScrapedTransaction {
  return {
    date: "2026-03-01",
    processedDate: status === "completed" ? "2026-03-10" : null,
    amount: -1500,
    originalAmount: null,
    originalCurrency: null,
    description,
    memo: null,
    status,
    installment: null,
    identifier: null,
  };
}

function accounts(provider: ProviderId, ...rows: ScrapedTransaction[][]): ScrapedAccount[] {
  return rows.map((transactions, i) => ({
    provider,
    accountNumber: provider === "visaCal" ? `432${i}` : `100-20030${i}`,
    balance: null,
    transactions,
  }));
}

const download: SyncDownload = { accounts: accounts("visaCal", [row("קפה")]), since: SINCE };

function setup(run: (provider: ProviderId, options: SyncOptions) => Promise<SyncDownload>) {
  const db = openDatabase(":memory:");
  const events: SyncProgress[] = [];
  const saved: IngestOptions[] = [];
  const service = createSyncService({
    db,
    runSync: run,
    ingest: (d, a, options) => {
      saved.push(options);
      return ingest(d, a, options);
    },
    emit: (p) => events.push(p),
  });
  return { db, events, saved, service };
}

describe("sync service", () => {
  it("downloads, saves, and reports every stage", async () => {
    const { db, events, service } = setup(async (_p, o) => {
      o.onProgress?.("opening_browser");
      o.onProgress?.("waiting_for_login");
      o.onProgress?.("downloading");
      return download;
    });
    const result = await service.start("visaCal");
    expect(result).toEqual({ provider: "visaCal", accounts: 1, newRows: 1, updatedRows: 0 });
    expect(listTransactions(db)).toHaveLength(1);
    expect(events.map((e) => e.stage)).toEqual(["opening_browser", "waiting_for_login", "downloading", "saving", "done"]);
  });

  it("reports failed and passes the code through", async () => {
    const { db, events, service } = setup(async () => {
      throw new CodedError("LOGIN_TIMEOUT");
    });
    await expect(service.start("discount")).rejects.toMatchObject({ code: "LOGIN_TIMEOUT" });
    expect(events.at(-1)?.stage).toBe("failed");
    expect(listTransactions(db)).toHaveLength(0);
  });

  it("turns any other failure into a coded error without its text", async () => {
    const { service } = setup(async () => {
      throw new Error("secret bank text");
    });
    const err = await service.start("discount").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CodedError);
    expect(String((err as Error).message)).not.toContain("secret");
  });

  it("refuses a second sync while one runs, and cancel aborts it", async () => {
    let seen: AbortSignal | undefined;
    const { service } = setup(
      (_p, o) =>
        new Promise((_, reject) => {
          seen = o.signal;
          o.signal?.addEventListener("abort", () => reject(new CodedError("LOGIN_CANCELLED")));
        }),
    );
    const first = service.start("visaCal");
    await expect(service.start("discount")).rejects.toMatchObject({ code: "SYNC_IN_PROGRESS" });
    service.cancel();
    await expect(first).rejects.toMatchObject({ code: "LOGIN_CANCELLED" });
    expect(seen?.aborted).toBe(true);
  });

  it("passes the download's first day to the ledger as since", async () => {
    const { saved, service } = setup(async () => download);
    await service.start("visaCal");
    expect(saved).toEqual([expect.objectContaining({ provider: "visaCal", since: SINCE })]);
  });

  it("rejects an unknown provider", async () => {
    const { service } = setup(async () => download);
    await expect(service.start("leumi" as ProviderId)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
