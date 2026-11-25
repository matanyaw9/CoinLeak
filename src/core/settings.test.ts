import { afterEach, describe, expect, it, vi } from "vitest";
import { CodedError } from "@shared/errors";
import type { SettingEntry } from "@shared/types";
import { newDb } from "./testing/ledger";
import { BUDGET_MAX } from "./ledger/budgets";
import { SETTING_KEYS, getSetting, setSetting } from "./settings";

describe("settings", () => {
  it("knows a fixed list of keys", () => {
    expect(SETTING_KEYS).toEqual(["addedProviders", "syncFrom", "homeCurveCompare", "homeCurveCategories", "budgetTotal"]);
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

describe("syncFrom (spec 23)", () => {
  afterEach(() => vi.useRealTimers());

  it("defaults to as far back as each bank allows", () => {
    expect(getSetting(newDb(), "syncFrom")).toBe("max");
  });

  it("keeps a real day from 2000 to today", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 9, 12) });
    const db = newDb();
    for (const value of ["2026-01-01", "2000-01-01", "2026-11-09", "2024-02-29", "max"]) {
      setSetting(db, { key: "syncFrom", value });
      expect(getSetting(db, "syncFrom")).toBe(value);
    }
  });

  it("refuses a day in the future, before 2000, or not a real day", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 9, 12) });
    const db = newDb();
    const bad: unknown[] = ["2026-11-10", "2099-01-01", "1999-12-31", "2025-02-29", "2026-13-01", "2026-1-1", "", "all", 2026, null];
    for (const value of bad) {
      expect(() => setSetting(db, { key: "syncFrom", value } as SettingEntry)).toThrow(CodedError);
    }
    expect(getSetting(db, "syncFrom")).toBe("max");
  });

  it("no longer knows Home's Routine / Treats filter (spec 34, F72)", () => {
    const db = newDb();
    const old = { key: "homeSpendingFilter", value: "all" } as unknown as SettingEntry;
    expect(() => setSetting(db, old)).toThrow(CodedError);
  });

  it("keeps Home's curve choices (spec 26): last month and top 5 until set", () => {
    const db = newDb();
    expect(getSetting(db, "homeCurveCompare")).toBe("previous");
    expect(getSetting(db, "homeCurveCategories")).toEqual([]);
    setSetting(db, { key: "homeCurveCompare", value: "average" });
    setSetting(db, { key: "homeCurveCategories", value: [3, null, 7] });
    expect(getSetting(db, "homeCurveCompare")).toBe("average");
    expect(getSetting(db, "homeCurveCategories")).toEqual([3, null, 7]);
    for (const value of ["last", null, 1]) {
      expect(() => setSetting(db, { key: "homeCurveCompare", value } as SettingEntry)).toThrow(CodedError);
    }
    for (const value of [[1, 1], [0], [1.5], ["2"], Array.from({ length: 501 }, (_, i) => i + 1), null]) {
      expect(() => setSetting(db, { key: "homeCurveCategories", value } as SettingEntry)).toThrow(CodedError);
    }
  });

  it("holds up to 500 chosen categories, a full tree (spec 38)", () => {
    const db = newDb();
    const full = [null, ...Array.from({ length: 499 }, (_, i) => i + 1)];
    setSetting(db, { key: "homeCurveCategories", value: full });
    expect(getSetting(db, "homeCurveCategories")).toEqual(full);
    expect(() => setSetting(db, { key: "homeCurveCategories", value: [...full, 500] })).toThrow(CodedError);
  });
});

describe("budgetTotal (spec 37)", () => {
  it("is none until set, then keeps a whole number of agorot up to BUDGET_MAX", () => {
    const db = newDb();
    expect(getSetting(db, "budgetTotal")).toBeNull();
    for (const value of [1, 1_200_000, BUDGET_MAX]) {
      setSetting(db, { key: "budgetTotal", value });
      expect(getSetting(db, "budgetTotal")).toBe(value);
    }
  });

  it("refuses too big, zero, negative and not a whole number of agorot", () => {
    const db = newDb();
    setSetting(db, { key: "budgetTotal", value: 500_000 });
    for (const value of [BUDGET_MAX + 1, 0, -100, 10.5, Number.NaN, Number.POSITIVE_INFINITY, "500000", [500_000]]) {
      expect(() => setSetting(db, { key: "budgetTotal", value } as SettingEntry)).toThrow(CodedError);
    }
    expect(getSetting(db, "budgetTotal")).toBe(500_000);
  });

  it("clears with null", () => {
    const db = newDb();
    setSetting(db, { key: "budgetTotal", value: 500_000 });
    setSetting(db, { key: "budgetTotal", value: null });
    expect(getSetting(db, "budgetTotal")).toBeNull();
  });
});
