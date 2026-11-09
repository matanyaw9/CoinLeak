// Month picker logic: stepping, year boundaries, never past today, keys.

import { describe, expect, it } from "vitest";
import {
  canGoNext,
  canStep,
  customDaysProblem,
  daysInMonth,
  monthKeyDelta,
  monthRange,
  periodRange,
  shiftMonth,
  showToday,
  stepMonth,
  stepPeriod,
  type PeriodChoice,
} from "./month";

describe("month picker", () => {
  it("steps across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(shiftMonth("2026-03", -14)).toBe("2025-01");
  });

  it("never goes past the current month", () => {
    expect(canGoNext("2026-11", "2026-11")).toBe(false);
    expect(canGoNext("2026-10", "2026-11")).toBe(true);
    expect(stepMonth("2026-11", 1, "2026-11")).toBe("2026-11");
    expect(stepMonth("2026-10", 1, "2026-11")).toBe("2026-11");
    expect(stepMonth("2026-11", -1, "2026-11")).toBe("2026-10");
  });

  it("knows month lengths and ranges", () => {
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-02")).toBe(28);
    expect(monthRange("2026-04")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });

  it("moves with the arrow keys, but not while typing or with modifiers", () => {
    expect(monthKeyDelta({ key: "ArrowLeft" })).toBe(-1);
    expect(monthKeyDelta({ key: "ArrowRight" })).toBe(1);
    expect(monthKeyDelta({ key: "ArrowUp" })).toBeNull();
    expect(monthKeyDelta({ key: "ArrowLeft", ctrlKey: true })).toBeNull();
    expect(monthKeyDelta({ key: "ArrowLeft", target: { tagName: "INPUT" } as unknown as EventTarget })).toBeNull();
    expect(monthKeyDelta({ key: "ArrowRight", target: { tagName: "DIV", getAttribute: () => "radio" } as unknown as EventTarget })).toBeNull();
    expect(monthKeyDelta({ key: "ArrowRight", target: { tagName: "BUTTON", getAttribute: () => null } as unknown as EventTarget })).toBe(1);
  });

  it("offers Today only away from the current month, and jumps straight there", () => {
    expect(showToday("2026-11", "2026-11")).toBe(false);
    expect(showToday("2026-10", "2026-11")).toBe(true);
    expect(showToday("2024-02", "2026-11")).toBe(true);
  });
});

describe("periods (spec 16)", () => {
  const choice = (kind: PeriodChoice["kind"]): PeriodChoice => ({
    kind,
    month: "2026-03",
    year: 2025,
    custom: { from: "2025-12-20", to: "2026-01-10" },
  });
  const today = "2026-11-09";

  it("turns each choice into its days", () => {
    expect(periodRange(choice("month"), today)).toEqual({ from: "2026-03-01", to: "2026-03-31" });
    expect(periodRange(choice("last7"), today)).toEqual({ from: "2026-11-03", to: "2026-11-09" });
    expect(periodRange(choice("last30"), today)).toEqual({ from: "2026-10-11", to: "2026-11-09" });
    expect(periodRange(choice("last12"), today)).toEqual({ from: "2025-12-01", to: "2026-11-30" });
    expect(periodRange(choice("year"), today)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(periodRange(choice("custom"), today)).toEqual({ from: "2025-12-20", to: "2026-01-10" });
  });

  it("steps a month or a year, never past now; other periods do not step", () => {
    expect(stepPeriod(choice("month"), 1, "2026-11").month).toBe("2026-04");
    expect(stepPeriod({ ...choice("month"), month: "2026-11" }, 1, "2026-11").month).toBe("2026-11");
    expect(stepPeriod(choice("year"), 1, "2026-11").year).toBe(2026);
    expect(stepPeriod({ ...choice("year"), year: 2026 }, 1, "2026-11").year).toBe(2026);
    expect(canStep("last7")).toBe(false);
    expect(canStep("custom")).toBe(false);
    expect(stepPeriod(choice("last30"), -1, "2026-11")).toEqual(choice("last30"));
  });

  it("custom days: both picked by hand; from after to is refused, never swapped", () => {
    expect(customDaysProblem("2025-12-20", "2026-01-10")).toBeNull();
    expect(customDaysProblem("2026-01-10", "2026-01-10")).toBeNull();
    expect(customDaysProblem("2026-01-10", "2025-12-20")).toBe("fromAfterTo");
    expect(customDaysProblem("", "2025-12-20")).toBe("missing");
    expect(customDaysProblem("2025-12-20", "")).toBe("missing");
    const wrong = { ...choice("custom"), custom: { from: "2026-01-10", to: "2025-12-20" } };
    expect(periodRange(wrong, today)).toEqual({ from: "2026-01-10", to: "2025-12-20" });
  });
});
