import { describe, expect, it } from "vitest";
import { txn } from "../testing/ledger";
import { SequenceCounter, dedupHash } from "./dedup";

const coffee = txn({ date: "2026-03-02", amount: -1800, description: "קפה השכונה" });

describe("dedupHash", () => {
  it("is stable for the same content", () => {
    expect(dedupHash("visaCal", "4321", coffee)).toBe(dedupHash("visaCal", "4321", { ...coffee }));
  });

  it("ignores status, processed date and identifier, which change when a row settles", () => {
    const settled = { ...coffee, status: "completed" as const, processedDate: "2026-03-10", identifier: "77" };
    expect(dedupHash("visaCal", "4321", settled)).toBe(dedupHash("visaCal", "4321", coffee));
  });

  it("ignores whitespace differences in the description", () => {
    expect(dedupHash("visaCal", "4321", { ...coffee, description: "  קפה   השכונה " })).toBe(
      dedupHash("visaCal", "4321", coffee),
    );
  });

  it("changes with account, date, amount, description and installment", () => {
    const base = dedupHash("visaCal", "4321", coffee);
    expect(dedupHash("visaCal", "8765", coffee)).not.toBe(base);
    expect(dedupHash("discount", "4321", coffee)).not.toBe(base);
    expect(dedupHash("visaCal", "4321", { ...coffee, date: "2026-03-03" })).not.toBe(base);
    expect(dedupHash("visaCal", "4321", { ...coffee, amount: -1801 })).not.toBe(base);
    expect(dedupHash("visaCal", "4321", { ...coffee, description: "קפה אחר" })).not.toBe(base);
    const first = dedupHash("visaCal", "4321", { ...coffee, installment: { number: 1, total: 3 } });
    const second = dedupHash("visaCal", "4321", { ...coffee, installment: { number: 2, total: 3 } });
    expect(first).not.toBe(base);
    expect(second).not.toBe(first);
  });
});

describe("SequenceCounter", () => {
  it("numbers copies of the same key 0, 1, 2 and keys independently", () => {
    const c = new SequenceCounter();
    expect([c.next("a"), c.next("a"), c.next("b"), c.next("a")]).toEqual([0, 1, 0, 2]);
  });
});
