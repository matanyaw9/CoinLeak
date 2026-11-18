import { describe, expect, it } from "vitest";
import { axisTicks } from "./net-card";

describe("the saved or overspent axis", () => {
  it("runs through zero to both extremes in round whole-shekel steps", () => {
    expect(axisTicks([484600, 700000, -919200, 367300])).toEqual([-1000000, -500000, 0, 500000, 1000000]);
    expect(axisTicks([300000, 500000])).toEqual([0, 200000, 400000, 600000]);
    expect(axisTicks([-5000, -1000])).toEqual([-6000, -4000, -2000, 0]);
  });

  it("never steps under one shekel, and a flat history is just zero", () => {
    expect(axisTicks([150])).toEqual([0, 100, 200]);
    expect(axisTicks([0, 0])).toEqual([0]);
  });
});
