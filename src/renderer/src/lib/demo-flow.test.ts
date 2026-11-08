import { describe, expect, it } from "vitest";
import type { MoneyFlow } from "@shared/types";
import { createDemo } from "./demo";
import { shiftMonth, toIsoMonth } from "./month";

const TODAY = new Date(2026, 10, 7, 12);

async function value<T>(p: Promise<{ ok: true; value: T } | { ok: false }>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error("demo refused");
  return r.value;
}

describe("demo money flow (spec 14)", () => {
  it("balances every month and agrees with the month summary", async () => {
    const demo = createDemo(TODAY);
    const kinds = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const month = shiftMonth(toIsoMonth(TODAY), -i);
      const flow: MoneyFlow = await value(demo.invoke("summary:flow", { month }));
      const summary = await value(demo.invoke("summary:month", { month }));
      expect(flow).toMatchObject({ income: summary.income, spending: summary.spending, transfers: summary.transfers });
      const hub = flow.nodes.findIndex((n) => n.kind === "hub");
      const into = flow.links.filter((l) => l.target === hub).reduce((a, l) => a + l.amount, 0);
      const out = flow.links.filter((l) => l.source === hub).reduce((a, l) => a + l.amount, 0);
      expect(into).toBe(out);
      for (const n of flow.nodes) kinds.add(n.kind);
    }
    // Savings each month, and one month with money back out of savings.
    expect(kinds).toEqual(new Set(["income", "from_savings", "hub", "spending", "transfer", "left"]));
  });

  it("keeps transfers out of spending and income", async () => {
    const demo = createDemo(TODAY);
    const month = toIsoMonth(TODAY);
    const summary = await value(demo.invoke("summary:month", { month }));
    expect(summary.transfers).toBe(150000);
    const rows = await value(demo.invoke("transactions:list", { flows: ["transfer"] }));
    expect(rows.length).toBeGreaterThan(12);
    expect(rows.every((r) => r.flags.length === 0)).toBe(true);
  });
});
