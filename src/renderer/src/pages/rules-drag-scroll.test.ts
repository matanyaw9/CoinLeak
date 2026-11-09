import { describe, expect, it } from "vitest";
import { edgeScrollSpeed } from "./rules-drag-scroll";

// A visible list from y 64 (under the top bar) to y 900.
const speed = (y: number) => edgeScrollSpeed(y, 64, 900);

describe("dragging a rule near an edge scrolls the page", () => {
  it("stays still away from the edges", () => {
    expect(speed(400)).toBe(0);
    expect(speed(64 + 80)).toBe(0);
    expect(speed(900 - 80)).toBe(0);
  });

  it("scrolls up near the top and down near the bottom", () => {
    expect(speed(100)).toBeLessThan(0);
    expect(speed(860)).toBeGreaterThan(0);
  });

  it("goes faster the closer to the edge, up to a top speed", () => {
    expect(Math.abs(speed(70))).toBeGreaterThan(Math.abs(speed(120)));
    expect(speed(890)).toBeGreaterThan(speed(840));
    expect(speed(64)).toBe(-22);
    expect(speed(10)).toBe(-22);
    expect(speed(950)).toBe(22);
  });
});
