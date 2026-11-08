// Demo rules behave like core's: they sort rows a rule fits, never touch a
// row the user set, follow the order, and clean up after edits and deletes.

import { describe, expect, it } from "vitest";
import type { RuleInput } from "@shared/types";
import type { Args, Channel, Res } from "@shared/ipc";
import { createDemo } from "./demo";

type Demo = ReturnType<typeof createDemo>;
const today = new Date(2026, 10, 7, 12, 0);

async function ask<C extends Channel>(demo: Demo, channel: C, args: Args<C>): Promise<Res<C>> {
  const r = await demo.invoke(channel, args);
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
}

const rule = (patch: Partial<RuleInput> & Pick<RuleInput, "matchText">): RuleInput => ({
  name: patch.matchText,
  enabled: true,
  matchField: "description",
  matchMode: "contains",
  accountId: null,
  amountMin: null,
  amountMax: null,
  direction: null,
  setCategoryId: null,
  setExcluded: null,
  ...patch,
});

const rowsOf = async (demo: Demo, prefix: string) =>
  (await ask(demo, "transactions:list", {})).filter((r) => r.description.startsWith(prefix));

describe("demo rules", () => {
  it("start with rules that really sorted their rows; every other sorted row is the user's", async () => {
    const demo = createDemo(today);
    const rules = await ask(demo, "rules:list", undefined);
    expect(rules.map((r) => r.position)).toEqual(rules.map((_, i) => i + 1));
    expect(new Set(rules.map((r) => r.matchMode))).toEqual(new Set(["contains", "starts_with", "equals", "regex"]));
    const shufersal = rules.find((r) => r.name === "Shufersal");
    const rows = await rowsOf(demo, "שופרסל");
    expect(new Set(rows.map((r) => r.description)).size).toBeGreaterThan(1);
    expect(rows.every((r) => r.ruleId === shufersal?.id && r.categorySource === "rule" && r.categoryId === 11)).toBe(true);
    const all = await ask(demo, "transactions:list", {});
    expect(all.filter((r) => r.categorySource === "rule").every((r) => r.ruleId !== null)).toBe(true);
    expect(all.filter((r) => r.categorySource === "user").every((r) => r.ruleId === null)).toBe(true);
    expect(all.some((r) => r.flow === "excluded" && r.ruleId !== null)).toBe(true);
  });

  it("creating a rule sorts matching uncategorized rows and never a row the user set", async () => {
    const demo = createDemo(today);
    const before = await rowsOf(demo, "העברה ב-BIT");
    const open = before.filter((r) => r.categoryId === null);
    const mine = before.filter((r) => r.categorySource === "user");
    expect(open.length).toBeGreaterThan(0);
    expect(mine.length).toBeGreaterThan(1);
    // The user also clears one row by hand: an empty category is still their word.
    const cleared = mine[0];
    if (!cleared) throw new Error("no user row");
    await ask(demo, "transactions:update", { ids: [cleared.id], patch: { categoryId: null } });

    const created = await ask(demo, "rules:create", rule({ matchMode: "starts_with", matchText: "העברה ב-BIT", setCategoryId: 61 }));
    expect(created.position).toBe((await ask(demo, "rules:list", undefined)).length);
    const after = new Map((await rowsOf(demo, "העברה ב-BIT")).map((r) => [r.id, r]));
    for (const r of open) {
      expect(after.get(r.id)).toMatchObject({ categoryId: 61, categorySource: "rule", ruleId: created.id });
      expect(after.get(r.id)?.flags).not.toContain("uncategorized");
    }
    for (const r of mine) {
      expect(after.get(r.id)).toMatchObject({
        categoryId: r.id === cleared.id ? null : r.categoryId,
        categorySource: "user",
        ruleId: null,
      });
    }
  });

  it("the first matching rule wins, and reordering, switching off or deleting re-sorts rows", async () => {
    const demo = createDemo(today);
    const shufersal = (await ask(demo, "rules:list", undefined)).find((r) => r.name === "Shufersal");
    if (!shufersal) throw new Error("no Shufersal rule");
    const later = await ask(demo, "rules:create", rule({ matchText: "שופרסל", setCategoryId: 41 }));
    expect((await rowsOf(demo, "שופרסל")).every((r) => r.categoryId === 11)).toBe(true);

    const ids = (await ask(demo, "rules:list", undefined)).map((r) => r.id);
    await ask(demo, "rules:reorder", { ids: [later.id, ...ids.filter((id) => id !== later.id)] });
    expect((await rowsOf(demo, "שופרסל")).every((r) => r.categoryId === 41 && r.ruleId === later.id)).toBe(true);

    await ask(demo, "rules:delete", { id: later.id });
    await ask(demo, "rules:update", { id: shufersal.id, rule: { ...shufersal, enabled: false } });
    const rows = await rowsOf(demo, "שופרסל");
    expect(rows.every((r) => r.categoryId === null && r.ruleId === null && r.flags.includes("uncategorized"))).toBe(true);
  });

  it("an exclude rule never undoes the user's choice to count a row", async () => {
    const demo = createDemo(today);
    const [savings] = await rowsOf(demo, "העברה לחשבון חיסכון");
    if (!savings) throw new Error("no savings row");
    expect(savings).toMatchObject({ flow: "excluded" });
    await ask(demo, "transactions:update", { ids: [savings.id], patch: { excluded: false } });
    await ask(demo, "rules:create", rule({ matchText: "חיסכון", setExcluded: true }));
    const [after] = await rowsOf(demo, "העברה לחשבון חיסכון");
    expect(after).toMatchObject({ excluded: false, flow: "spending" });
  });

  it("previews without saving, and suggests a starts-with rule from selected rows", async () => {
    const demo = createDemo(today);
    const rows = await rowsOf(demo, "שופרסל");
    const preview = await ask(demo, "rules:preview", rule({ matchMode: "starts_with", matchText: "  שופרסל " }));
    expect(preview.matches).toBe(rows.length);
    expect(preview.sample.map((r) => r.id)).toEqual(rows.slice(0, 20).map((r) => r.id));
    expect(await ask(demo, "rules:list", undefined)).toHaveLength(8);

    const picked = [...new Map(rows.map((r) => [r.description, r])).values()];
    const draft = await ask(demo, "rules:suggest", { ids: picked.map((r) => r.id) });
    expect(draft).toMatchObject({ matchMode: "starts_with", matchText: "שופרסל", accountId: 2, setCategoryId: 11, direction: null });
    expect(draft.amountMin).toBe(Math.min(...picked.map((r) => -r.amount)));
    expect(draft.amountMax).toBe(Math.max(...picked.map((r) => -r.amount)));
  });

  it("rejects a broken pattern or a rule with nothing to do, and saves nothing", async () => {
    const demo = createDemo(today);
    expect((await demo.invoke("rules:preview", rule({ matchMode: "regex", matchText: "(" }))).ok).toBe(false);
    expect((await demo.invoke("rules:create", rule({ matchText: "wolt" }))).ok).toBe(false);
    expect((await demo.invoke("rules:create", rule({ matchText: "x".repeat(201), setCategoryId: 11 }))).ok).toBe(false);
    expect(await ask(demo, "rules:list", undefined)).toHaveLength(8);
  });
});
