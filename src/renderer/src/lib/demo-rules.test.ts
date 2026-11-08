// Demo rules behave like core's: they sort rows a rule fits, never touch a
// row the user set unless the save names it, follow the order, clean up
// after edits and deletes, and answer known places and starter lists.

import { describe, expect, it } from "vitest";
import type { RuleMatchMode, RuleInput } from "@shared/types";
import type { Args, Channel, Res } from "@shared/ipc";
import { createDemo } from "./demo";

type Demo = ReturnType<typeof createDemo>;
const today = new Date(2026, 10, 7, 12, 0);

async function ask<C extends Channel>(demo: Demo, channel: C, args: Args<C>): Promise<Res<C>> {
  const r = await demo.invoke(channel, args);
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
}

type Text = { matchText: string; matchMode?: RuleMatchMode };
const rule = ({ matchText, matchMode = "contains", ...patch }: Partial<RuleInput> & Text): RuleInput => ({
  name: matchText,
  enabled: true,
  join: "all",
  conditions: [{ kind: "text", field: "description", mode: matchMode, values: [matchText] }],
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
    const modes = rules.flatMap((r) => r.conditions.flatMap((c) => (c.kind === "text" ? [c.mode] : [])));
    expect(new Set(modes)).toEqual(new Set(["contains", "starts_with", "equals", "regex"]));
    expect(rules.some((r) => r.conditions.length > 1)).toBe(true);
    const shufersal = rules.find((r) => r.name === "Groceries");
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
    const shufersal = (await ask(demo, "rules:list", undefined)).find((r) => r.name === "Groceries");
    if (!shufersal) throw new Error("no Groceries rule");
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
    expect(draft).toMatchObject({ join: "all", setCategoryId: 11 });
    expect(draft.conditions).toEqual([
      { kind: "text", field: "description", mode: "starts_with", values: ["שופרסל"] },
      { kind: "account", accountId: 2 },
      { kind: "amount", min: Math.min(...picked.map((r) => -r.amount)), max: Math.max(...picked.map((r) => -r.amount)) },
    ]);
  });

  it("rejects a broken pattern or a rule with nothing to do, and saves nothing", async () => {
    const demo = createDemo(today);
    expect((await demo.invoke("rules:preview", rule({ matchMode: "regex", matchText: "(" }))).ok).toBe(false);
    expect((await demo.invoke("rules:create", rule({ matchText: "wolt" }))).ok).toBe(false);
    expect((await demo.invoke("rules:create", rule({ matchText: "x".repeat(201), setCategoryId: 11 }))).ok).toBe(false);
    expect(await ask(demo, "rules:list", undefined)).toHaveLength(8);
  });

  it("saving says how many rows the rule sorts; Apply now says what changed", async () => {
    const demo = createDemo(today);
    const open = (await rowsOf(demo, "העברה ב-BIT")).filter((r) => r.categoryId === null);
    const saved = await ask(demo, "rules:save", { id: null, rule: rule({ matchMode: "starts_with", matchText: "העברה ב-BIT", setCategoryId: 61 }) });
    expect(saved.applied).toBe(open.length);
    expect(saved.changed).toBe(open.length);
    expect(await ask(demo, "rules:apply", undefined)).toMatchObject({ changed: 0 });
  });

  it("hand-sorted rows change only when the save names them", async () => {
    const demo = createDemo(today);
    const draft = rule({ matchMode: "starts_with", matchText: "העברה ב-BIT", setCategoryId: 61 });
    const preview = await ask(demo, "rules:preview", draft);
    const mine = preview.handSet;
    expect(mine.length).toBeGreaterThan(1);
    expect(mine.every((r) => r.categorySource === "user" && r.categoryId !== 61)).toBe(true);

    await ask(demo, "rules:save", { id: null, rule: draft });
    const kept = new Map((await rowsOf(demo, "העברה ב-BIT")).map((r) => [r.id, r]));
    for (const r of mine) expect(kept.get(r.id)).toMatchObject({ categoryId: r.categoryId, categorySource: "user" });

    const [first] = mine;
    if (!first) throw new Error("no hand-set row");
    const id = (await ask(demo, "rules:list", undefined)).at(-1)?.id ?? 0;
    await ask(demo, "rules:save", { id, rule: draft, alsoChange: [first.id] });
    const after = new Map((await rowsOf(demo, "העברה ב-BIT")).map((r) => [r.id, r]));
    expect(after.get(first.id)).toMatchObject({ categoryId: 61, categorySource: "rule", ruleId: id });
    for (const r of mine.slice(1)) expect(after.get(r.id)).toMatchObject({ categoryId: r.categoryId, categorySource: "user" });
  });

  it("lists known places, appends a name, and makes a list rule when a category has none", async () => {
    const demo = createDemo(today);
    const places = await ask(demo, "rules:knownPlaces", undefined);
    expect(places.find((p) => p.categoryId === 13)?.names).toContain("ארומה");

    const added = await ask(demo, "rules:addKnownPlace", { categoryId: 13, name: " Cafe  Nero " });
    expect(added).toMatchObject({ created: false, added: true });
    const again = await ask(demo, "rules:addKnownPlace", { categoryId: 13, name: "cafe nero" });
    expect(again).toMatchObject({ ruleId: added.ruleId, added: false });
    expect((await ask(demo, "rules:knownPlaces", undefined)).find((p) => p.categoryId === 13)?.names.at(-1)).toBe("Cafe Nero");

    const made = await ask(demo, "rules:addKnownPlace", { categoryId: 41, name: "IKEA" });
    expect(made).toMatchObject({ created: true, added: true });
    const rules = await ask(demo, "rules:list", undefined);
    expect(rules.at(-1)).toMatchObject({ id: made.ruleId, setCategoryId: 41, conditions: [{ kind: "text", values: ["IKEA"] }] });
  });

  it("offers starter lists without adding them, then adds the chosen ones as ordinary rules", async () => {
    const demo = createDemo(today);
    const before = await ask(demo, "rules:list", undefined);
    const offer = await ask(demo, "rules:starters", undefined);
    expect(offer.lists.length).toBeGreaterThan(2);
    expect(offer.sorts).toBeGreaterThan(0);
    expect(offer.lists.find((l) => l.key === "cafes")?.names).not.toContain("ארומה");
    expect(await ask(demo, "rules:list", undefined)).toEqual(before);

    const keys = offer.lists.map((l) => l.key);
    const added = await ask(demo, "rules:addStarters", { keys });
    expect(added.rules).toBeGreaterThan(0);
    expect(added.changed).toBe(offer.sorts);
    expect((await ask(demo, "rules:starters", undefined)).lists).toEqual([]);
  });
});
