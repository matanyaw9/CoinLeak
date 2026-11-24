import { describe, expect, it } from "vitest";
import type { SyncRange } from "@shared/types";
import { formatRangeDay, groupLimits, scopeText } from "./sync-range";

const ranges: SyncRange[] = [
  { provider: "discount", limitMonths: 12, from: "2025-11-11" },
  { provider: "visaCal", limitMonths: 18, from: "2025-05-10" },
  { provider: "max", limitMonths: 48, from: "2022-11-09" },
  { provider: "hapoalim", limitMonths: 12, from: "2025-11-10" },
];

describe("groupLimits", () => {
  it("groups the shown providers by months, shortest first", () => {
    expect(groupLimits(ranges, ["max", "visaCal", "discount", "hapoalim"])).toEqual([
      { months: 12, providers: ["discount", "hapoalim"] },
      { months: 18, providers: ["visaCal"] },
      { months: 48, providers: ["max"] },
    ]);
  });

  it("skips providers it has no range for", () => {
    expect(groupLimits(ranges, ["yahav"])).toEqual([]);
  });
});

describe("formatRangeDay", () => {
  it("shows the day with its year", () => {
    expect(formatRangeDay("2026-01-05")).toMatch(/5.*Jan.*2026/);
  });
});

describe("scopeText (spec 32)", () => {
  it("names the months of a quick sync, and a full one as slower", () => {
    expect(scopeText({ mode: "quick", months: 2, from: "2026-09-02" })).toBe("Getting the last 2 months");
    expect(scopeText({ mode: "quick", months: 1, from: "2026-10-20" })).toBe("Getting the last month");
    expect(scopeText({ mode: "full", months: null, from: null })).toBe("Getting everything the bank allows (slower)");
    expect(scopeText({ mode: "full", months: null, from: "2026-01-15" })).toBe(
      `Getting everything from ${formatRangeDay("2026-01-15")} (slower)`,
    );
  });
});
