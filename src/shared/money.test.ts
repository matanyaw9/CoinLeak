import { describe, expect, it } from "vitest";
import { formatIls, toAgorot } from "./money";

describe("toAgorot", () => {
  it("rounds float shekels to integer agorot", () => {
    expect(toAgorot(-123.45)).toBe(-12345);
    expect(toAgorot(0.1 + 0.2)).toBe(30);
    expect(toAgorot(19.999)).toBe(2000);
  });

  it("rejects non-finite input", () => {
    expect(() => toAgorot(Number.NaN)).toThrow();
    expect(() => toAgorot(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("formatIls", () => {
  it("puts the shekel sign first, like Spent", () => {
    expect(formatIls(935350)).toBe("₪9,353.50");
    expect(formatIls(-935350, { decimals: false })).toBe("-₪9,354");
    expect(formatIls(123400, { sign: true })).toBe("+₪1,234.00");
  });
});
