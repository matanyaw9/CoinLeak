// F45: the rule editor lists hand-set rows the rule matches, and saving
// hands every one of them to the rule. With none, nothing extra shows.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RuleInput } from "@shared/types";
import type { Args, Channel, Res } from "@shared/ipc";
import { s } from "@/strings";
import { createDemo } from "@/lib/demo";
import { indexCategories } from "@/lib/categories";
import { HandSetList, handSetIds } from "./hand-set";

type Demo = ReturnType<typeof createDemo>;

async function ask<C extends Channel>(demo: Demo, channel: C, args: Args<C>): Promise<Res<C>> {
  const r = await demo.invoke(channel, args);
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
}

const bitToCash: RuleInput = {
  name: "BIT",
  enabled: true,
  join: "all",
  conditions: [{ kind: "text", field: "description", mode: "starts_with", values: ["העברה ב-BIT"] }],
  setCategoryId: 61,
  setExcluded: null,
};

describe("hand-set rows in the rule editor", () => {
  it("lists them, and saving sends every id so all of them change", async () => {
    const demo = createDemo(new Date(2026, 10, 7, 12, 0));
    const index = indexCategories(await ask(demo, "categories:list", undefined));
    const handSet = (await ask(demo, "rules:preview", bitToCash)).handSet;
    expect(handSet.length).toBeGreaterThan(1);

    const html = renderToStaticMarkup(<HandSetList rows={handSet} index={index} />);
    expect(html).toContain(s.rulesV2.handSet.willChange(handSet.length));
    expect(html).not.toContain("checkbox");

    const ids = handSetIds(handSet);
    expect(ids).toEqual(handSet.map((r) => r.id));
    await ask(demo, "rules:save", { id: null, rule: bitToCash, alsoChange: ids });

    const rows = await ask(demo, "transactions:list", {});
    for (const id of ids) expect(rows.find((r) => r.id === id)).toMatchObject({ categoryId: 61, categorySource: "rule" });
    expect((await ask(demo, "rules:preview", bitToCash)).handSet).toEqual([]);
  });

  it("shows nothing when the rule matches no hand-set rows", () => {
    expect(renderToStaticMarkup(<HandSetList rows={[]} index={indexCategories([])} />)).toBe("");
    expect(handSetIds([])).toEqual([]);
  });
});
