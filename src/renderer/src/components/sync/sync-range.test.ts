import { describe, expect, it } from "vitest";
import type { SyncRange } from "@shared/types";
import { formatRangeDay, groupLimits } from "./sync-range";

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
