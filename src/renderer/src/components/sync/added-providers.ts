// The providers the user added in the picker live in the database settings
// (spec 15). Older builds kept them in this window's localStorage; the first
// load after the update moves that list into the database once and forgets it.

import type { ProviderId } from "@shared/types";
import { isEnabledProvider } from "@shared/providers";

export const LEGACY_ADDED_KEY = "coinleak.addedProviders";

export interface AddedStore {
  /** The saved list. Typed loosely: the settings channel returns any key's value (spec 23). */
  get: () => Promise<unknown>;
  set: (list: ProviderId[]) => Promise<void>;
}

type LegacyStorage = Pick<Storage, "getItem" | "removeItem">;

function readLegacy(storage: LegacyStorage): ProviderId[] | null {
  try {
    const raw = storage.getItem(LEGACY_ADDED_KEY);
    if (raw == null) return null;
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter(isEnabledProvider) : [];
  } catch {
    return [];
  }
}

/**
 * The saved list, after moving any list still in localStorage into the
 * database. The old key is removed only once the database has the merge,
 * so a failed save tries again next time and nothing is lost.
 */
export async function loadAddedProviders(store: AddedStore, storage: LegacyStorage | null): Promise<ProviderId[]> {
  const stored = await store.get();
  const saved = Array.isArray(stored) ? stored.filter(isEnabledProvider) : [];
  const legacy = storage ? readLegacy(storage) : null;
  if (legacy === null || !storage) return saved;
  const merged = [...new Set([...saved, ...legacy])];
  if (merged.length !== saved.length) await store.set(merged);
  try {
    storage.removeItem(LEGACY_ADDED_KEY);
  } catch {
    // Storage blocked: the database already has the list.
  }
  return merged;
}
