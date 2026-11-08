// Month picker logic: stepping, year boundaries, never past today, keys.

import { describe, expect, it } from "vitest";
import { canGoNext, daysInMonth, monthKeyDelta, monthRange, shiftMonth, showToday, stepMonth } from "./month";

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
