import { describe, expect, it } from "vitest";
import type { ProviderId } from "@shared/types";
import { LEGACY_ADDED_KEY, loadAddedProviders, type AddedStore } from "./added-providers";

function memoryStore(initial: ProviderId[] = []) {
  let list = initial;
  let writes = 0;
  const store: AddedStore = {
    get: () => Promise.resolve(list),
    set: (next) => {
      writes++;
      list = next;
      return Promise.resolve();
    },
  };
  return { store, list: () => list, writes: () => writes };
}

function memoryStorage(value: string | null) {
  const items = new Map<string, string>();
  if (value !== null) items.set(LEGACY_ADDED_KEY, value);
  return {
    getItem: (k: string) => items.get(k) ?? null,
    removeItem: (k: string) => void items.delete(k),
    has: () => items.has(LEGACY_ADDED_KEY),
  };
}

describe("loadAddedProviders", () => {
  it("reads the database when nothing is left in localStorage", async () => {
    const db = memoryStore(["max"]);
    expect(await loadAddedProviders(db.store, memoryStorage(null))).toEqual(["max"]);
    expect(db.writes()).toBe(0);
  });

  it("moves the localStorage list into the database once", async () => {
    const db = memoryStore(["max"]);
    const storage = memoryStorage(JSON.stringify(["isracard", "max"]));
    expect(await loadAddedProviders(db.store, storage)).toEqual(["max", "isracard"]);
    expect(db.list()).toEqual(["max", "isracard"]);
    expect(storage.has()).toBe(false);
    // A second load finds nothing to move.
    expect(await loadAddedProviders(db.store, storage)).toEqual(["max", "isracard"]);
    expect(db.writes()).toBe(1);
  });

  it("drops unknown or unsupported ids and garbage", async () => {
    const db = memoryStore();
    expect(await loadAddedProviders(db.store, memoryStorage(JSON.stringify(["amex", "nope", "oneZero", 3])))).toEqual([
      "amex",
    ]);
    const broken = memoryStorage("{not json");
    expect(await loadAddedProviders(memoryStore().store, broken)).toEqual([]);
    expect(broken.has()).toBe(false);
  });

  it("keeps the old key when saving fails, to try again next time", async () => {
    const storage = memoryStorage(JSON.stringify(["max"]));
    const failing: AddedStore = { get: () => Promise.resolve([]), set: () => Promise.reject(new Error("x")) };
    await expect(loadAddedProviders(failing, storage)).rejects.toThrow();
    expect(storage.has()).toBe(true);
  });
});
