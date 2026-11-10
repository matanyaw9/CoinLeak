import { describe, expect, it } from "vitest";
import { firstRun } from "./hooks";

const loaded = <T>(data: T) => ({ data, isError: false });
const loading = { data: undefined, isError: false };
const failed = { data: undefined, isError: true };

describe("firstRun", () => {
  it("greets only with no money account and no cash wallet", () => {
    expect(firstRun(loaded([]), loaded(null))).toBe(true);
    expect(firstRun(loaded([{ id: 1 }]), loaded(null))).toBe(false);
  });

  it("a profile with only a cash wallet is not a first run", () => {
    expect(firstRun(loaded([]), loaded({ id: 5, rowCount: 2 }))).toBe(false);
  });

  it("waits while either is loading, unless an account already answers", () => {
    expect(firstRun(loading, loaded(null))).toBeUndefined();
    expect(firstRun(loaded([]), loading)).toBeUndefined();
    expect(firstRun(loaded([{ id: 1 }]), loading)).toBe(false);
  });

  it("never greets when a read failed", () => {
    expect(firstRun(failed, loaded(null))).toBe(false);
    expect(firstRun(loaded([]), failed)).toBe(false);
  });
});
