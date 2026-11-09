import { describe, expect, it } from "vitest";
import { IDLE, elapsedMs, formatElapsed, onClock, ticking, type ClockEvent, type SyncClock } from "./sync-clock";

const run = (events: ClockEvent[]): SyncClock => events.reduce(onClock, IDLE);

describe("sync clock", () => {
  it("counts from the start stage while the sync runs", () => {
    const clock = run([{ type: "start", at: 1000 }, { type: "stage", stage: "waiting_for_login", at: 3000 }]);
    expect(ticking(clock)).toBe(true);
    expect(elapsedMs(clock, 1000)).toBe(0);
    expect(elapsedMs(clock, 8500)).toBe(7500);
    expect(elapsedMs(clock, 84_000)).toBe(83_000);
  });

  it.each([
    ["done", { type: "stage", stage: "done", at: 9000 }],
    ["failed", { type: "stage", stage: "failed", at: 9000 }],
    ["cancel", { type: "cancel", at: 9000 }],
  ] as [string, ClockEvent][])("stops on %s and stays frozen", (_, stop) => {
    const clock = run([{ type: "start", at: 1000 }, { type: "stage", stage: "downloading", at: 5000 }, stop]);
    expect(ticking(clock)).toBe(false);
    expect(elapsedMs(clock, 60_000)).toBe(8000);
    // A later event does not restart it.
    expect(elapsedMs(onClock(clock, { type: "stage", stage: "saving", at: 20_000 }), 60_000)).toBe(8000);
  });

  it("shows nothing before a start or after the sync ends", () => {
    expect(elapsedMs(IDLE, 5000)).toBeNull();
    expect(ticking(IDLE)).toBe(false);
    const ended = run([{ type: "start", at: 1000 }, { type: "stage", stage: "done", at: 2000 }, { type: "end" }]);
    expect(elapsedMs(ended, 5000)).toBeNull();
    expect(run([{ type: "cancel", at: 5 }])).toEqual(IDLE);
  });

  it("a new sync starts from zero", () => {
    const clock = run([{ type: "start", at: 1000 }, { type: "stage", stage: "done", at: 5000 }, { type: "start", at: 9000 }]);
    expect(ticking(clock)).toBe(true);
    expect(elapsedMs(clock, 9000)).toBe(0);
  });

  it("formats minutes and seconds", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(7_900)).toBe("0:07");
    expect(formatElapsed(83_000)).toBe("1:23");
    expect(formatElapsed(725_000)).toBe("12:05");
  });
});
