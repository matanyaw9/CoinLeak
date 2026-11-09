// The demo's period channels add up like core's (spec 16).

import { describe, expect, it } from "vitest";
import { createDemo } from "./demo";
import { addDays, monthRange, shiftMonth, toIsoMonth } from "./month";

const TODAY = new Date(2026, 10, 7, 12);
const current = toIsoMonth(TODAY);
const FOOD = 1;

async function value<T>(p: Promise<{ ok: true; value: T } | { ok: false }>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error("demo refused");
  return r.value;
}

describe("demo periods (spec 16)", () => {
  it("a month's range gives the month summary's numbers", async () => {
    const demo = createDemo(TODAY);
    for (const month of [current, shiftMonth(current, -1), shiftMonth(current, -3)]) {
      const m = await value(demo.invoke("summary:month", { month }));
      const p = await value(demo.invoke("summary:period", monthRange(month)));
      expect(p).toMatchObject({ income: m.income, spending: m.spending, transfers: m.transfers, needsReview: m.needsReview });
      expect(p.byParent).toEqual(m.byParent);
      expect(p.bucket).toBe("day");
    }
  });

  it("three months back spends beyond income, with no savings node", async () => {
    const demo = createDemo(TODAY);
    const flow = await value(demo.invoke("summary:periodFlow", monthRange(shiftMonth(current, -3))));
    expect(flow.shortfall).toBe(flow.spending + flow.transfers - flow.income);
    expect(flow.shortfall).toBeGreaterThan(0);
    expect(flow.nodes.find((n) => n.kind === "beyond_income")?.amount).toBe(flow.shortfall);
    expect(flow.nodes.some((n) => n.kind === "from_savings")).toBe(false);
    const balanced = await value(demo.invoke("summary:periodFlow", monthRange(shiftMonth(current, -1))));
    expect(balanced.shortfall).toBe(0);
  });

  it("a group's categories add up to its node in the main flow", async () => {
    const demo = createDemo(TODAY);
    const range = { from: addDays(`${current}-01`, -60), to: `${current}-07` };
    const flow = await value(demo.invoke("summary:periodFlow", range));
    const food = flow.nodes.find((n) => n.kind === "spending" && n.categoryId === FOOD);
    const group = await value(demo.invoke("summary:groupFlow", { ...range, categoryId: FOOD }));
    expect(group.total).toBe(food?.amount);
    const right = group.nodes.filter((n) => n.kind === "spending").reduce((a, n) => a + n.amount, 0);
    const refunds = group.nodes.filter((n) => n.kind === "refund").reduce((a, n) => a + n.amount, 0);
    expect(right - refunds).toBe(group.total);
  });

  it("the trend for chosen categories matches each month's totals", async () => {
    const demo = createDemo(TODAY);
    const ids = [2, 3];
    const points = await value(demo.invoke("summary:periodTrend", { ...monthRange(current), categoryIds: ids }));
    expect(points).toHaveLength(3);
    for (const p of points) {
      const m = await value(demo.invoke("summary:month", { month: p.month }));
      const expected = ids.map((id) => m.byParent.find((x) => x.categoryId === id)?.amount ?? 0);
      expect(p.byCategory.map((c) => c.amount)).toEqual(expected);
      expect(p.spending).toBe(expected.reduce((a, x) => a + x, 0));
    }
  });
});
