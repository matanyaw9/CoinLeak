// The demo ledger must tell one consistent story: every summary number is
// the sum of the rows the list channel returns.

import { describe, expect, it } from "vitest";
import type { Args, Channel, Res } from "@shared/ipc";
import { createDemo } from "./demo";
import { monthRange, shiftMonth, toIsoMonth } from "./month";

const today = new Date(2026, 10, 7, 12, 0);
const current = toIsoMonth(today);

async function ask<C extends Channel>(demo: ReturnType<typeof createDemo>, channel: C, args: Args<C>): Promise<Res<C>> {
  const r = await demo.invoke(channel, args);
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
}

const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + x.amount, 0);

describe("demo ledger", () => {
  it("has a Discount account, two Cal cards and Hebrew merchants", async () => {
    const demo = createDemo(today);
    const accounts = await ask(demo, "accounts:list", undefined);
    expect(accounts.filter((a) => a.provider === "discount" && a.kind === "bank")).toHaveLength(1);
    expect(accounts.filter((a) => a.provider === "visaCal" && a.kind === "card")).toHaveLength(2);
    const rows = await ask(demo, "transactions:list", {});
    expect(rows.some((r) => /[֐-׿]/.test(r.description))).toBe(true);
    expect(rows.every((r) => Number.isInteger(r.amount))).toBe(true);
  });

  it("covers twelve months with spending in each", async () => {
    const trend = await ask(createDemo(today), "summary:trend", { months: 12 });
    expect(trend.map((t) => t.month)).toEqual(Array.from({ length: 12 }, (_, i) => shiftMonth(current, i - 11)));
    expect(trend.every((t) => t.spending > 0 && t.income > 0)).toBe(true);
  });

  it("marks card bills internal, and each equals its card's cycle", async () => {
    const rows = await ask(createDemo(today), "transactions:list", {});
    const bills = rows.filter((r) => r.flow === "internal");
    expect(bills.length).toBeGreaterThan(0);
    for (const bill of bills) {
      const cycle = rows.filter((r) => r.accountId !== 1 && r.processedDate === bill.date);
      const card = cycle.filter((r) => bill.memo?.endsWith(r.accountId === 2 ? "4821" : "7390"));
      expect(sum(card)).toBe(bill.amount);
    }
  });

  it("flags uncategorized rows and an untracked card bill this month", async () => {
    const demo = createDemo(today);
    const review = await ask(demo, "transactions:list", { ...monthRange(current), needsReview: true });
    expect(review.some((r) => r.flags.includes("uncategorized"))).toBe(true);
    expect(review.some((r) => r.flags.includes("possible_card_bill") && r.flow === "spending")).toBe(true);
  });

  it.each([0, -1, -5, -11])("month %i: summary totals equal the sum of the rows", async (offset) => {
    const demo = createDemo(today);
    const month = shiftMonth(current, offset);
    const range = monthRange(month);
    const summary = await ask(demo, "summary:month", { month });
    const counted = await ask(demo, "transactions:list", { ...range, flows: ["spending", "refund"] });
    const income = await ask(demo, "transactions:list", { ...range, flows: ["income"] });
    const review = await ask(demo, "transactions:list", { ...range, needsReview: true });

    expect(summary.spending).toBe(-sum(counted));
    expect(summary.income).toBe(sum(income));
    expect(sum(summary.byCategory)).toBe(summary.spending);
    expect(summary.byCategory.reduce((a, c) => a + c.count, 0)).toBe(counted.length);
    expect(summary.byDay.at(-1)?.amount).toBe(summary.spending);
    expect(summary.needsReview).toBe(review.length);

    const trend = await ask(demo, "summary:trend", { months: 12 });
    const point = trend.find((t) => t.month === month);
    expect(point?.spending).toBe(summary.spending);
    expect(point?.income).toBe(summary.income);
  });

  it("categorizing a row clears its flag and keeps the totals", async () => {
    const demo = createDemo(today);
    const before = await ask(demo, "summary:month", { month: current });
    const uncategorized = await ask(demo, "transactions:list", { ...monthRange(current), categoryIds: [null], flows: ["spending"] });
    const row = uncategorized.find((r) => r.flags.length === 1);
    if (!row) throw new Error("demo has no plain uncategorized row");
    const res = await ask(demo, "transactions:update", { ids: [row.id], patch: { categoryId: 11 } });
    expect(res.updated).toBe(1);
    const after = await ask(demo, "summary:month", { month: current });
    expect(after.spending).toBe(before.spending);
    expect(after.needsReview).toBe(before.needsReview - 1);
    const [updated] = await ask(demo, "transactions:list", { search: row.description, categoryIds: [11] });
    expect(updated?.categorySource).toBe("user");
  });

  it("answers bad requests with a fixed error code", async () => {
    const demo = createDemo(today);
    const r = await demo.invoke("transactions:update", { ids: [], patch: {} });
    expect(r).toEqual({ ok: false, error: { code: "BAD_REQUEST", message: expect.any(String) } });
  });

  it("reports sync stages in order and refuses a second sync", async () => {
    const demo = createDemo(today, { syncStepMs: 1 });
    const stages: string[] = [];
    demo.on("sync:progress", (p) => stages.push(p.stage));
    const first = demo.invoke("sync:start", { provider: "visaCal" });
    const second = await demo.invoke("sync:start", { provider: "discount" });
    expect(second.ok).toBe(false);
    const done = await first;
    expect(done.ok && done.value.accounts).toBe(2);
    expect(stages).toEqual(["opening_browser", "waiting_for_login", "downloading", "saving", "done"]);
  });
});
