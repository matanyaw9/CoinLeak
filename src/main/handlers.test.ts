// The profile channels with real database files in a temp folder: each
// profile sees only its own rows, switching waits for a sync, and the Demo
// profile never syncs.

import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
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
const clearWindowStorage = vi.fn(() => Promise.resolve());
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
    clearWindowStorage,
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
    expect((await ask("transactions:list", {})).rows).toHaveLength(1);

    const work = await ask("profiles:add", { name: "Work" });
    await ask("profiles:switch", { id: work.id });
    expect(reloadWindow).toHaveBeenCalledTimes(1);
    expect((await ask("transactions:list", {})).rows).toHaveLength(0);
    expect(await ask("accounts:list", undefined)).toHaveLength(0);

    await ask("profiles:switch", { id: "me" });
    expect((await ask("transactions:list", {})).rows).toHaveLength(1);
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
    expect((await ask("transactions:list", {})).rows.length).toBeGreaterThan(100);

    expect(await code(ask("sync:start", { provider: "discount" }))).toBe("BAD_REQUEST");
    expect(sync.start).not.toHaveBeenCalled();
  });

  it("reset puts the Demo data back as it was", async () => {
    const ask = setup();
    const demo = await ask("profiles:addDemo", undefined);
    await ask("profiles:switch", { id: demo.id });
    const before = (await ask("transactions:list", {})).rows;
    const rules = await ask("rules:list", undefined);
    await ask("transactions:emptyTrash", undefined);
    await ask("rules:delete", { id: rules[0]?.id ?? 0 });

    await ask("profiles:resetDemo", undefined);
    expect((await ask("transactions:list", {})).rows).toHaveLength(before.length);
    expect(await ask("rules:list", undefined)).toHaveLength(rules.length);
    expect((await ask("transactions:list", { flows: ["trashed"] })).rows.length).toBeGreaterThan(0);
    expect(reloadWindow).toHaveBeenCalledTimes(2);
  });

  // spec 28
  it("deleting the open profile opens the next one and removes its file", async () => {
    const ask = setup();
    ingest(getDb(), [bank([txn({ date: "2026-03-02", amount: -5000, description: "חנות" })])], { now: NOW });
    const work = await ask("profiles:add", { name: "Work" });

    await ask("profiles:delete", { id: "me" });
    expect((await ask("profiles:list", undefined)).current).toBe(work.id);
    expect((await ask("transactions:list", {})).rows).toHaveLength(0);
    expect(existsSync(join(dir, "coinleak.db"))).toBe(false);
    expect(reloadWindow).toHaveBeenCalledTimes(1);
  });

  it("deleting the last real profile opens a fresh, empty Me", async () => {
    const ask = setup();
    ingest(getDb(), [bank([txn({ date: "2026-03-02", amount: -5000, description: "חנות" })])], { now: NOW });
    await ask("profiles:delete", { id: "me" });
    const list = await ask("profiles:list", undefined);
    expect(list.profiles.map((p) => p.name)).toEqual(["Me"]);
    expect(list.current).not.toBe("me");
    expect((await ask("transactions:list", {})).rows).toHaveLength(0);
  });

  it("refuses to delete the open profile while a sync runs", async () => {
    const ask = setup();
    syncing = true;
    expect(await code(ask("profiles:delete", { id: "me" }))).toBe("SYNC_IN_PROGRESS");
    expect((await ask("profiles:list", undefined)).profiles).toHaveLength(1);
  });

  it("deleting another profile leaves the open one alone", async () => {
    const ask = setup();
    const work = await ask("profiles:add", { name: "Work" });
    await ask("profiles:delete", { id: work.id });
    expect((await ask("profiles:list", undefined)).current).toBe("me");
    expect(reloadWindow).not.toHaveBeenCalled();
  });
});

describe("delete data (spec 23)", () => {
  const files = () => readdirSync(dir).filter((f) => !f.endsWith("-wal") && !f.endsWith("-shm")).sort();

  it("deletes this profile's data, even the only profile, and opens it fresh and empty", async () => {
    const ask = setup();
    ingest(getDb(), [bank([txn({ date: "2026-03-02", amount: -5000, description: "חנות" })])], { now: NOW });
    await ask("settings:set", { key: "syncFrom", value: "2026-01-01" });

    await ask("profiles:wipeCurrent", undefined);
    expect((await ask("transactions:list", {})).rows).toHaveLength(0);
    expect(await ask("accounts:list", undefined)).toHaveLength(0);
    expect(await ask("settings:get", { key: "syncFrom" })).toBe("max");
    expect((await ask("profiles:list", undefined)).profiles).toEqual([{ id: "me", name: "Me", file: "coinleak.db", demo: false }]);
    expect(files()).toEqual(["coinleak.db", "profiles.json"]);
    expect(reloadWindow).toHaveBeenCalledTimes(1);
  });

  it("leaves the other profiles untouched", async () => {
    const ask = setup();
    const work = await ask("profiles:add", { name: "Work" });
    await ask("profiles:switch", { id: work.id });
    ingest(getDb(), [bank([txn({ date: "2026-03-02", amount: -5000, description: "חנות" })])], { now: NOW });
    await ask("profiles:switch", { id: "me" });
    ingest(getDb(), [bank([txn({ date: "2026-03-03", amount: -700, description: "קפה" })])], { now: NOW });

    await ask("profiles:wipeCurrent", undefined);
    expect((await ask("transactions:list", {})).rows).toHaveLength(0);
    await ask("profiles:switch", { id: work.id });
    expect((await ask("transactions:list", {})).rows).toHaveLength(1);
  });

  it("on the Demo profile, resets the made-up data instead", async () => {
    const ask = setup();
    const demo = await ask("profiles:addDemo", undefined);
    await ask("profiles:switch", { id: demo.id });
    const before = (await ask("transactions:list", {})).rows;
    await ask("transactions:trash", { ids: before.map((t) => t.id) });
    await ask("transactions:emptyTrash", undefined);
    expect((await ask("transactions:list", {})).rows).toHaveLength(0);

    await ask("profiles:wipeCurrent", undefined);
    expect((await ask("transactions:list", {})).rows).toHaveLength(before.length);
  });

  it("deletes everything: no profile database and no profile list left; it starts with one empty Me", async () => {
    const ask = setup();
    ingest(getDb(), [bank([txn({ date: "2026-03-02", amount: -5000, description: "חנות" })])], { now: NOW });
    const work = await ask("profiles:add", { name: "Work" });
    await ask("profiles:switch", { id: work.id });
    await ask("profiles:addDemo", undefined);
    writeFileSync(join(dir, "not-ours.txt"), "x");
    expect(files()).toEqual(["coinleak.db", "demo.db", "not-ours.txt", "profile-p2.db", "profiles.json"]);

    await ask("profiles:wipeAll", undefined);
    expect(clearWindowStorage).toHaveBeenCalledTimes(1);
    expect(files()).toEqual(["coinleak.db", "not-ours.txt", "profiles.json"]);
    expect(await ask("profiles:list", undefined)).toEqual({
      current: "me",
      profiles: [{ id: "me", name: "Me", file: "coinleak.db", demo: false }],
    });
    expect((await ask("transactions:list", {})).rows).toHaveLength(0);
    expect(reloadWindow).toHaveBeenCalledTimes(2);
  });

  it("deletes everything even when profiles.json is broken", async () => {
    const ask = setup();
    await ask("profiles:add", { name: "Work" });
    writeFileSync(join(dir, "profile-p2.db"), "old");
    writeFileSync(join(dir, "profiles.json"), "{broken");
    await ask("profiles:wipeAll", undefined);
    expect(files()).toEqual(["coinleak.db", "profiles.json"]);
  });

  it("refuses both while a sync runs and keeps the data", async () => {
    const ask = setup();
    ingest(getDb(), [bank([txn({ date: "2026-03-02", amount: -5000, description: "חנות" })])], { now: NOW });
    syncing = true;
    expect(await code(ask("profiles:wipeCurrent", undefined))).toBe("SYNC_IN_PROGRESS");
    expect(await code(ask("profiles:wipeAll", undefined))).toBe("SYNC_IN_PROGRESS");
    expect((await ask("transactions:list", {})).rows).toHaveLength(1);
    expect(clearWindowStorage).not.toHaveBeenCalled();
  });
});

describe("sync range (spec 23)", () => {
  it("lists each provider's first day, following the saved syncFrom", async () => {
    const ask = setup();
    const discount = async () => (await ask("sync:ranges", undefined)).find((r) => r.provider === "discount");
    expect(await discount()).toMatchObject({ limitMonths: 12, from: "2025-04-02" });
    await ask("settings:set", { key: "syncFrom", value: "2025-09-01" });
    expect((await discount())?.from).toBe("2025-09-01");
    expect(await code(ask("settings:set", { key: "syncFrom", value: "1999-01-01" }))).toBe("BAD_REQUEST");
    // The budget total only goes through budgets:setTotal (wave 15 review).
    expect(await code(ask("settings:set", { key: "budgetTotal", value: 100 }))).toBe("BAD_REQUEST");
  });
});

describe("saved or overspent (spec 30)", () => {
  it("answers per month and rejects bad ranges like the other summary channels", async () => {
    const ask = setup();
    ingest(getDb(), [bank([txn({ date: "2026-03-02", amount: -5000, description: "חנות" })])], { now: NOW });
    expect(await ask("summary:monthlyNet", { from: "2026-03-01", to: "2026-03-31" })).toEqual([
      { month: "2026-03", income: 0, spending: 5000, transfers: 0, net: -5000, partial: true },
    ]);
    const bad = [
      { from: "2026-03-31", to: "2026-03-01" },
      { from: "2026-03", to: "2026-03-31" },
      { from: "1900-01-01", to: "2026-03-31" },
    ];
    for (const range of bad) {
      expect(await code(ask("summary:monthlyNet", range))).toBe("BAD_REQUEST");
      expect(await code(ask("summary:periodTrend", range))).toBe("BAD_REQUEST");
    }
  });
});
