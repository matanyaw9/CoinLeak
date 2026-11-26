import { describe, expect, it } from "vitest";
import { formatIls, parseShekels, shekelText, toAgorot } from "./money";

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

describe("parseShekels", () => {
  it.each([
    ["45", 4500],
    ["12.5", 1250],
    ["12.50", 1250],
    ["12.", 1200],
    ["0.07", 7],
    ["0", 0],
    ["1,200.90", 120090],
    [" ₪ 30 ", 3000],
    ["19.99", 1999],
    // Read digit by digit: no float rounding, even where floats go wrong.
    ["0.29", 29],
    ["1234567.89", 123456789],
  ])("%s is %i agorot", (text, agorot) => {
    expect(parseShekels(text)).toBe(agorot);
  });

  it.each(["", " ", "-5", "1.234", "abc", "1.2.3", "1e3", ".5", "99999999999999999"])("refuses %j", (text) => {
    expect(parseShekels(text)).toBeNull();
  });
});

describe("shekelText", () => {
  it("writes agorot as an amount to edit, without a sign", () => {
    expect([shekelText(5800), shekelText(64050), shekelText(5), shekelText(1250), shekelText(-4500), shekelText(0)]).toEqual([
      "58",
      "640.50",
      "0.05",
      "12.50",
      "45",
      "0",
    ]);
  });

  it("puts a comma every three digits (F89)", () => {
    expect([shekelText(1_600_000), shekelText(100_000), shekelText(99_900), shekelText(123_456_789)]).toEqual([
      "16,000",
      "1,000",
      "999",
      "1,234,567.89",
    ]);
  });

  it("reads back what it wrote", () => {
    for (const agorot of [0, 7, 99, 100, 1250, 64050, 123456789]) expect(parseShekels(shekelText(agorot))).toBe(agorot);
  });
});

describe("formatIls", () => {
  it("puts the shekel sign first, like Spent", () => {
    expect(formatIls(935350)).toBe("₪9,353.50");
    expect(formatIls(-935350, { decimals: false })).toBe("-₪9,354");
    expect(formatIls(123400, { sign: true })).toBe("+₪1,234.00");
  });
});
