// App settings in the database's `settings` table: a fixed list of keys, each
// with a validator, stored as JSON text. Unknown keys and bad values are
// BAD_REQUEST; a stored value that no longer validates reads as the default.

import { CodedError } from "@shared/errors";
import { isEnabledProvider } from "@shared/providers";
import type { AppSettings, SettingEntry, SettingKey } from "@shared/types";
import type { Db } from "./db";

interface SettingSpec<K extends SettingKey> {
  fallback: AppSettings[K];
  valid: (value: unknown) => value is AppSettings[K];
}

const SPECS: { [K in SettingKey]: SettingSpec<K> } = {
  addedProviders: {
    fallback: [],
    valid: (v): v is AppSettings["addedProviders"] =>
      Array.isArray(v) && v.every(isEnabledProvider) && new Set(v).size === v.length,
  },
};

export const SETTING_KEYS = Object.keys(SPECS) as SettingKey[];

function isKey(key: unknown): key is SettingKey {
  return typeof key === "string" && Object.hasOwn(SPECS, key);
}

export function getSetting<K extends SettingKey>(db: Db, key: K): AppSettings[K] {
  if (!isKey(key)) throw new CodedError("BAD_REQUEST");
  const spec = SPECS[key] as SettingSpec<K>;
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return structuredClone(spec.fallback);
  try {
    const value: unknown = JSON.parse(row.value);
    return spec.valid(value) ? value : structuredClone(spec.fallback);
  } catch {
    return structuredClone(spec.fallback);
  }
}

export function setSetting(db: Db, entry: SettingEntry): void {
  if (typeof entry !== "object" || entry === null || !isKey(entry.key)) throw new CodedError("BAD_REQUEST");
  if (!SPECS[entry.key].valid(entry.value)) throw new CodedError("BAD_REQUEST");
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value").run(
    entry.key,
    JSON.stringify(entry.value),
  );
}
