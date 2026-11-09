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
  syncFrom: {
    fallback: "max",
    valid: (v): v is AppSettings["syncFrom"] => v === "max" || isSyncStartDay(v),
  },
};

const FIRST_SYNC_DAY = "2000-01-01";

/** A real calendar day from 2000 up to today on this computer's clock. */
function isSyncStartDay(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number) as [number, number, number];
  const day = new Date(Date.UTC(y, m - 1, d));
  if (day.getUTCFullYear() !== y || day.getUTCMonth() !== m - 1 || day.getUTCDate() !== d) return false;
  return v >= FIRST_SYNC_DAY && v <= localToday();
}

function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

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
