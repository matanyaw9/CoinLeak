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

  it("has one gone row that counts nowhere, is in review, and can be deleted", async () => {
    const demo = createDemo(today);
    const range = monthRange(current);
    const gone = await ask(demo, "transactions:list", { ...range, flows: ["gone"] });
    expect(gone).toHaveLength(1);
    const [row] = gone;
    if (!row) throw new Error("no gone row");
    expect(row.status).toBe("gone");
    expect(row.flags).toEqual(["gone"]);

    const review = await ask(demo, "transactions:list", { ...range, needsReview: true });
    expect(review.map((r) => r.id)).toContain(row.id);
    const counted = await ask(demo, "transactions:list", { ...range, flows: ["spending", "refund", "income"] });
    expect(counted.map((r) => r.id)).not.toContain(row.id);

    const before = await ask(demo, "summary:month", { month: current });
    const notGone = counted[0];
    if (!notGone) throw new Error("no counted row");
    expect(await ask(demo, "transactions:deleteGone", { ids: [row.id, notGone.id] })).toEqual({ deleted: 1 });
    const after = await ask(demo, "summary:month", { month: current });
    expect(after.spending).toBe(before.spending);
    expect(after.income).toBe(before.income);
    expect(after.needsReview).toBe(before.needsReview - 1);
    expect(await ask(demo, "transactions:list", { ...range, flows: ["gone"] })).toEqual([]);
    expect(await ask(demo, "transactions:list", { search: notGone.description, from: notGone.date, to: notGone.date })).not.toEqual([]);
  });

  it("trash: hidden from lists and totals, restored exactly, emptied for good (spec 11)", async () => {
    const demo = createDemo(today);
    const range = monthRange(current);
    const seeded = await ask(demo, "transactions:list", { flows: ["trashed"] });
    expect(seeded.length).toBeGreaterThan(0);
    const all = await ask(demo, "transactions:list", {});
    expect(all.some((r) => r.flow === "trashed")).toBe(false);

    const before = await ask(demo, "summary:month", { month: current });
    const rows = await ask(demo, "transactions:list", { ...range, flows: ["spending"] });
    const victim = rows[0];
    if (!victim) throw new Error("no spending row");
    expect(await ask(demo, "transactions:trash", { ids: [victim.id] })).toEqual({ updated: 1 });
    const trashed = await ask(demo, "summary:month", { month: current });
    expect(trashed.spending).toBe(before.spending + victim.amount);
    expect((await ask(demo, "transactions:list", range)).map((r) => r.id)).not.toContain(victim.id);

    expect(await ask(demo, "transactions:restore", { ids: [victim.id] })).toEqual({ updated: 1 });
    expect(await ask(demo, "summary:month", { month: current })).toEqual(before);

    const total = (await ask(demo, "transactions:list", {})).length;
    expect(await ask(demo, "transactions:emptyTrash", undefined)).toEqual({ deleted: seeded.length });
    expect(await ask(demo, "transactions:list", { flows: ["trashed"] })).toEqual([]);
    expect((await ask(demo, "transactions:list", {})).length).toBe(total);
  });

  it("hides card bills when asked", async () => {
    const demo = createDemo(today);
    const all = await ask(demo, "transactions:list", {});
    const hidden = await ask(demo, "transactions:list", { hideInternal: true });
    const bills = all.filter((r) => r.flow === "internal").length;
    expect(bills).toBeGreaterThan(0);
    expect(hidden).toHaveLength(all.length - bills);
  });

  it("has a pending purchase abroad with no shekel amount yet, which adds 0 everywhere", async () => {
    const demo = createDemo(today);
    const rows = await ask(demo, "transactions:list", monthRange(current));
    const abroad = rows.filter((r) => r.status === "pending" && r.amount === 0 && r.originalCurrency === "USD");
    expect(abroad).toHaveLength(1);
    expect(abroad[0]?.originalAmount).toBeLessThan(0);
    expect(abroad[0]?.flags).toEqual([]);
  });

  it("answers a possible card bill with setInternal, and null hands it back", async () => {
    const demo = createDemo(today);
    const range = monthRange(current);
    const review = await ask(demo, "transactions:list", { ...range, needsReview: true });
    const bill = review.find((r) => r.flags.includes("possible_card_bill"));
    if (!bill) throw new Error("no possible card bill");
    const before = await ask(demo, "summary:month", { month: current });
    const find = async () => (await ask(demo, "transactions:list", range)).find((r) => r.id === bill.id);

    await ask(demo, "transactions:setInternal", { ids: [bill.id], internal: true });
    expect(await find()).toMatchObject({ flow: "internal", flags: [] });
    const internal = await ask(demo, "summary:month", { month: current });
    expect(internal.spending).toBe(before.spending + bill.amount);
    expect(internal.needsReview).toBe(before.needsReview - 1);

    await ask(demo, "transactions:setInternal", { ids: [bill.id], internal: false });
    expect(await find()).toMatchObject({ flow: "spending", flags: ["uncategorized"] });

    await ask(demo, "transactions:setInternal", { ids: [bill.id], internal: null });
    expect((await find())?.flags).toContain("possible_card_bill");
    expect(await ask(demo, "summary:month", { month: current })).toEqual(before);
  });

  it("switches a card's mode and refuses a bank account", async () => {
    const demo = createDemo(today);
    expect(await ask(demo, "accounts:setCardMode", { accountId: 2, mode: "debit" })).toBeNull();
    const accounts = await ask(demo, "accounts:list", undefined);
    expect(accounts.find((a) => a.id === 2)?.cardMode).toBe("debit");
    const bank = await demo.invoke("accounts:setCardMode", { accountId: 1, mode: "debit" });
    expect(bank.ok).toBe(false);
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

describe("demo list order and filters (spec 17)", () => {
  const range = monthRange(current);

  it("sorts by amount size, by name, and by date like core", async () => {
    const demo = createDemo(today);
    const size = (r: { amount: number }) => Math.abs(r.amount);
    const desc = await ask(demo, "transactions:list", { ...range, sort: "amount_desc" });
    expect(desc.length).toBeGreaterThan(5);
    expect(desc.map(size)).toEqual(desc.map(size).sort((a, b) => b - a));
    const asc = await ask(demo, "transactions:list", { ...range, sort: "amount_asc" });
    expect(asc.map(size)).toEqual(asc.map(size).sort((a, b) => a - b));
    const names = (await ask(demo, "transactions:list", { ...range, sort: "name" })).map((r) => r.description.trim());
    const collator = new Intl.Collator(["he", "en"], { numeric: true, sensitivity: "base" });
    expect(names).toEqual([...names].sort(collator.compare));
    expect(await ask(demo, "transactions:list", { ...range, sort: "date" })).toEqual(
      await ask(demo, "transactions:list", range),
    );
  });

  it("filters pending rows and combines them with search", async () => {
    const demo = createDemo(today);
    const pending = await ask(demo, "transactions:list", { pending: true });
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((r) => r.status === "pending")).toBe(true);
    const settled = await ask(demo, "transactions:list", { pending: false });
    expect(settled.some((r) => r.status === "pending")).toBe(false);
    const word = pending[0]!.description.trim().split(" ")[0]!;
    const both = await ask(demo, "transactions:list", { pending: true, search: word });
    expect(both.length).toBeGreaterThan(0);
    expect(both.every((r) => r.status === "pending" && r.description.includes(word))).toBe(true);
  });
});
