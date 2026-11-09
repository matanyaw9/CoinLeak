// The sync range: each bank's limit in months, the first day asked for,
// and the start date the library gets.

import { describe, expect, it } from "vitest";
import { startDateFor, syncRanges } from "./sync-range";
import { requestStart } from "./sync/history";

const NOW = new Date("2026-11-09T10:00:00Z");

const range = (syncFrom: Parameters<typeof syncRanges>[0], provider: string) =>
  syncRanges(syncFrom, NOW).find((r) => r.provider === provider);

describe("syncRanges", () => {
  it("knows each bank's limit in whole months", () => {
    const months = Object.fromEntries(syncRanges("max", NOW).map((r) => [r.provider, r.limitMonths]));
    expect(months).toMatchObject({ discount: 12, visaCal: 18, max: 48, leumi: 36, yahav: 3, beinleumi: 12 });
  });

  it("with max, starts at each bank's earliest day", () => {
    expect(range("max", "discount")?.from).toBe("2025-11-11");
    expect(range("max", "max")?.from).toBe("2022-11-09");
  });

  it("with a day, starts there unless the bank cannot go that far", () => {
    expect(range("2026-06-01", "discount")?.from).toBe("2026-06-01");
    expect(range("2020-01-01", "discount")?.from).toBe("2025-11-11");
    expect(range("2024-01-01", "max")?.from).toBe("2024-01-01");
  });
});

describe("startDateFor", () => {
  it("max asks for no date: the library's own limit, as before", () => {
    expect(startDateFor("max")).toBeUndefined();
    expect(requestStart("discount", startDateFor("max"), () => NOW).toISOString()).toBe("2000-01-01T00:00:00.000Z");
  });

  it("a day reaches requestStart as that day", () => {
    const start = startDateFor("2026-06-01");
    expect(start?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(requestStart("discount", start, () => NOW)).toEqual(start);
    // A library without its own clamp still gets our floor for an earlier day.
    expect(requestStart("beinleumi", startDateFor("2020-01-01"), () => NOW).toISOString()).toBe("2025-11-10T00:00:00.000Z");
    expect(requestStart("beinleumi", start, () => NOW)).toEqual(start);
  });
});
