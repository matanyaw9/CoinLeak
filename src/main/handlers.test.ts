// The profile channels with real database files in a temp folder: each
// profile sees only its own rows, switching waits for a sync, and the Demo
// profile never syncs.

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openDatabase, type Db } from "@core/db";
import { ingest } from "@core/ledger";
import { bank, NOW, txn } from "@core/testing/ledger";
import type { Args, Channel, Res } from "@shared/ipc";
import { createHandlers } from "./handlers";
import { currentProfile, databasePath, readProfiles } from "./profiles";
import type { SyncService } from "./sync-service";

let dir: string;
let db: Db | undefined;
let syncing = false;
const reloadWindow = vi.fn();
const sync: SyncService = {
  start: vi.fn(() => Promise.reject(new Error("no bank in tests"))),
  cancel: () => undefined,
  isRunning: () => syncing,
};

function getDb(): Db {
  if (!db) throw new Error("no database open");
  return db;
}

function closeDb(): void {
  db?.close();
  db = undefined;
}

function openCurrentDb(): void {
  closeDb();
  db = openDatabase(databasePath(dir, currentProfile(readProfiles(dir))));
}

/** Opens the current profile and returns a way to call any channel, as the window would. */
function setup() {
  openCurrentDb();
  const handlers = createHandlers({
    version: "1",
    dataDir: dir,
    dev: true,
    sync,
    getDb,
    openCurrentDb,
    closeDb,
    reloadWindow,
    now: () => NOW,
  });
  return async <C extends Channel>(channel: C, args: Args<C>): Promise<Res<C>> => await handlers[channel](args);
}

const code = async (p: Promise<unknown>): Promise<string | undefined> => {
  try {
    await p;
  } catch (e) {
    return (e as { code?: string }).code;
  }
  return undefined;
};

beforeEach(() => {
  dir = mkdtempSync(join(process.env["TMPDIR"] ?? tmpdir(), "coinleak-handlers-"));
  syncing = false;
  vi.clearAllMocks();
});
afterEach(closeDb);

describe("profile channels", () => {
  it("two profiles never see each other's transactions", async () => {
    const ask = setup();
    ingest(getDb(), [bank([txn({ date: "2026-03-02", amount: -5000, description: "חנות" })])], { now: NOW });
    expect(await ask("transactions:list", {})).toHaveLength(1);

    const work = await ask("profiles:add", { name: "Work" });
    await ask("profiles:switch", { id: work.id });
    expect(reloadWindow).toHaveBeenCalledTimes(1);
    expect(await ask("transactions:list", {})).toHaveLength(0);
    expect(await ask("accounts:list", undefined)).toHaveLength(0);

    await ask("profiles:switch", { id: "me" });
    expect(await ask("transactions:list", {})).toHaveLength(1);
  });

  it("refuses to switch while a sync runs, and stays put", async () => {
    const ask = setup();
    const work = await ask("profiles:add", { name: "Work" });
    syncing = true;
    expect(await code(ask("profiles:switch", { id: work.id }))).toBe("SYNC_IN_PROGRESS");
    expect((await ask("profiles:list", undefined)).current).toBe("me");
    expect(reloadWindow).not.toHaveBeenCalled();
  });

  it("the Demo profile comes filled and main refuses to sync it", async () => {
    const ask = setup();
    const demo = await ask("profiles:addDemo", undefined);
    await ask("profiles:switch", { id: demo.id });
    expect((await ask("transactions:list", {})).length).toBeGreaterThan(100);

    expect(await code(ask("sync:start", { provider: "discount" }))).toBe("BAD_REQUEST");
    expect(sync.start).not.toHaveBeenCalled();
  });

  it("reset puts the Demo data back as it was", async () => {
    const ask = setup();
    const demo = await ask("profiles:addDemo", undefined);
    await ask("profiles:switch", { id: demo.id });
    const before = await ask("transactions:list", {});
    const rules = await ask("rules:list", undefined);
    await ask("transactions:emptyTrash", undefined);
    await ask("rules:delete", { id: rules[0]?.id ?? 0 });

    await ask("profiles:resetDemo", undefined);
    expect(await ask("transactions:list", {})).toHaveLength(before.length);
    expect(await ask("rules:list", undefined)).toHaveLength(rules.length);
    expect((await ask("transactions:list", { flows: ["trashed"] })).length).toBeGreaterThan(0);
    expect(reloadWindow).toHaveBeenCalledTimes(2);
  });
});
