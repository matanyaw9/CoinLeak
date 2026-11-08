import { describe, expect, it } from "vitest";
import { syncedText } from "./sync-time";

// Local times, so the test reads the same in any time zone.
const now = new Date(2026, 10, 8, 10, 30);
const at = (...parts: [number, number, number, number, number]) => new Date(...parts).toISOString();

describe("syncedText", () => {
  it("says today with the time", () => {
    expect(syncedText(at(2026, 10, 8, 9, 14), now)).toBe("synced today 09:14");
    expect(syncedText(at(2026, 10, 8, 0, 5), now)).toBe("synced today 00:05");
  });

  it("says yesterday by calendar day, not by 24 hours", () => {
    expect(syncedText(at(2026, 10, 7, 23, 50), now)).toBe("synced yesterday 23:50");
    expect(syncedText(at(2026, 10, 7, 8, 0), now)).toBe("synced yesterday 08:00");
  });

  it("gives a short date for anything older, with the year only when it differs", () => {
    expect(syncedText(at(2026, 10, 3, 12, 0), now)).toBe("synced 3 Nov");
    expect(syncedText(at(2025, 11, 30, 12, 0), now)).toBe("synced 30 Dec 2025");
  });

  it("says never synced when there is no time", () => {
    expect(syncedText(null, now)).toBe("never synced");
    expect(syncedText(undefined, now)).toBe("never synced");
    expect(syncedText("not a date", now)).toBe("never synced");
  });
});
