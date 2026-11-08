import { describe, expect, it } from "vitest";
import { CodedError } from "@shared/errors";
import type { SettingEntry } from "@shared/types";
import { newDb } from "./testing/ledger";
import { SETTING_KEYS, getSetting, setSetting } from "./settings";

describe("settings", () => {
  it("knows a fixed list of keys", () => {
    expect(SETTING_KEYS).toEqual(["addedProviders"]);
  });

  it("returns the default until set, then the saved value", () => {
    const db = newDb();
    expect(getSetting(db, "addedProviders")).toEqual([]);
    setSetting(db, { key: "addedProviders", value: ["max", "isracard"] });
    expect(getSetting(db, "addedProviders")).toEqual(["max", "isracard"]);
    setSetting(db, { key: "addedProviders", value: ["max"] });
    expect(getSetting(db, "addedProviders")).toEqual(["max"]);
  });

  it("refuses unknown keys", () => {
    const db = newDb();
    expect(() => getSetting(db, "theme" as never)).toThrow(CodedError);
    expect(() => setSetting(db, { key: "theme", value: "dark" } as unknown as SettingEntry)).toThrow(CodedError);
    expect(() => setSetting(db, null as never)).toThrow(CodedError);
    expect(db.prepare("SELECT COUNT(*) AS n FROM settings").get()).toEqual({ n: 0 });
  });

  it("validates values", () => {
    const db = newDb();
    const bad: unknown[] = ["max", ["notABank"], ["max", "max"], [1], null, { max: true }];
    for (const value of bad) {
      expect(() => setSetting(db, { key: "addedProviders", value } as SettingEntry)).toThrow(CodedError);
    }
    expect(getSetting(db, "addedProviders")).toEqual([]);
  });

  it("reads a stored value that no longer validates as the default", () => {
    const db = newDb();
    db.prepare("INSERT INTO settings (key, value) VALUES ('addedProviders', ?)").run("{not json");
    expect(getSetting(db, "addedProviders")).toEqual([]);
    db.prepare("UPDATE settings SET value = ? WHERE key = 'addedProviders'").run('["gone"]');
    expect(getSetting(db, "addedProviders")).toEqual([]);
  });
});
