// The rule editor's form and the calls behind the rules screen: amounts in
// shekels, suggestions opt-in, and Undo putting a rule back in its place.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Rule, RuleInput } from "@shared/types";
import {
  addValues,
  amountText,
  blankCondition,
  checkForm,
  formFrom,
  readAmount,
  splitValues,
  type FormCondition,
  type RuleForm,
} from "./rule-form";
import { moveId, placeAfterMove, restoreRule, toInput } from "./rules";

const draft: RuleInput = {
  name: "שופרסל",
  enabled: true,
  join: "all",
  conditions: [
    { kind: "text", field: "description", mode: "starts_with", values: ["שופרסל"] },
    { kind: "account", accountId: 2 },
    { kind: "amount", min: 5800, max: 64050 },
  ],
  setCategoryId: 11,
  setExcluded: null,
};

describe("rule form", () => {
  it("reads and writes amount limits in shekels as agorot, empty meaning no limit", () => {
    expect([amountText(5800), amountText(64050), amountText(5), amountText(0), amountText(null)]).toEqual(["58", "640.50", "0.05", "0", ""]);
    expect([readAmount("58"), readAmount("₪1,200.5"), readAmount("0"), readAmount(" "), readAmount("12.345"), readAmount("-3")]).toEqual([
      5800, 120050, 0, null, undefined, undefined,
    ]);
  });

  it("sets a suggestion's account and amount aside until the user adds them", () => {
    const form = formFrom(draft, { optIn: true });
    expect(form.conditions.map((c) => c.kind)).toEqual(["text"]);
    expect(form.suggested.map((c) => c.kind)).toEqual(["account", "amount"]);
    expect(checkForm(form).rule).toEqual({ ...draft, conditions: [draft.conditions[0]] });
    expect(checkForm({ ...form, conditions: [...form.conditions, ...form.suggested] }).rule).toEqual(draft);
  });

  it("round-trips a saved rule, and names it after its names when the name is empty", () => {
    const saved: RuleInput = { ...draft, join: "any", setExcluded: false, enabled: false };
    expect(checkForm(formFrom(saved)).rule).toEqual(saved);
    const list: RuleInput = { ...draft, conditions: [{ kind: "text", field: "description", mode: "contains", values: ["Aroma", "Cofix"] }] };
    expect(checkForm({ ...formFrom(list), name: "  " }).rule?.name).toBe("Aroma, Cofix");
  });

  it("takes several names as chips, counting what is still typed, without repeats", () => {
    expect(splitValues(" Aroma, Cofix\nקפה  קפה ,, ")).toEqual(["Aroma", "Cofix", "קפה קפה"]);
    expect(addValues(["Aroma"], ["aroma", "Cofix"])).toEqual(["Aroma", "Cofix"]);
    const form = formFrom(null);
    const [text] = form.conditions;
    if (text?.kind !== "text") throw new Error("expected a text condition");
    const typed = { ...form, setCategoryId: 13, conditions: [{ ...text, values: ["Aroma"], draft: "Cofix, aroma" }] };
    expect(checkForm(typed).rule?.conditions).toEqual([{ kind: "text", field: "description", mode: "contains", values: ["Aroma", "Cofix"] }]);
  });

  it("explains what is missing per condition, and previews the finished ones", () => {
    const blank = checkForm(formFrom(null));
    expect(blank.rule).toBeNull();
    expect(blank.preview).toBeNull();
    expect(Object.values(blank.problems.conditions)).toHaveLength(1);
    expect(blank.problems.action).toBeDefined();

    const form = formFrom(null);
    const [text] = form.conditions;
    if (text?.kind !== "text") throw new Error("expected a text condition");
    const half = { ...form, conditions: [{ ...text, draft: " wolt " }, blankCondition("account")] };
    const check = checkForm(half);
    expect(check.rule).toBeNull();
    expect(check.preview?.conditions).toEqual([{ kind: "text", field: "description", mode: "contains", values: ["wolt"] }]);
    expect(Object.keys(check.problems.conditions)).toEqual([String(half.conditions[1]?.key)]);

    const amount = { ...blankCondition("amount"), min: "700", max: "1" } as FormCondition;
    expect(Object.values(checkForm({ ...half, conditions: [amount] }).problems.conditions)).toHaveLength(1);
  });

  it("builds an any rule from conditions of every kind", () => {
    const form: RuleForm = {
      ...formFrom(null),
      join: "any",
      setCategoryId: 21,
      conditions: [
        { key: 1, kind: "text", field: "memo", mode: "regex", values: [], draft: "paz|sonol" },
        { key: 2, kind: "account", accountId: 3 },
        { key: 3, kind: "amount", min: "", max: "60" },
        { key: 4, kind: "direction", direction: "in" },
      ],
    };
    expect(checkForm(form).rule).toMatchObject({
      join: "any",
      conditions: [
        { kind: "text", field: "memo", mode: "regex", values: ["paz|sonol"] },
        { kind: "account", accountId: 3 },
        { kind: "amount", min: null, max: 6000 },
        { kind: "direction", direction: "in" },
      ],
    });
  });
});

describe("rules calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("moves a rule within the order", () => {
    expect(moveId([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
    expect(moveId([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveId([1, 2], 5, 0)).toEqual([1, 2]);
  });

  it("says where a moved rule landed and which rule now runs after it (spec 21)", () => {
    expect(placeAfterMove([4, 1, 2, 3], 4)).toEqual({ place: 1, nextId: 1 });
    expect(placeAfterMove([1, 2, 4, 3], 4)).toEqual({ place: 3, nextId: 3 });
    expect(placeAfterMove([1, 2, 3, 4], 4)).toEqual({ place: 4, nextId: null });
  });

  it("sends no overlap counts back when a listed rule is saved again", () => {
    const listed: Rule = { ...draft, id: 2, position: 2, overlaps: [{ action: "category", count: 3, winnerId: 1 }] };
    expect(toInput(listed)).toEqual(draft);
  });

  it("Undo recreates a deleted rule and moves it back to its old place", async () => {
    const deleted: Rule = { ...draft, id: 2, position: 2 };
    const invoke = vi.fn(async (channel: string) => {
      if (channel === "rules:create") return { ok: true, value: { ...deleted, id: 9, position: 4 } };
      if (channel === "rules:list") return { ok: true, value: [{ id: 1 }, { id: 3 }, { id: 4 }, { id: 9 }] };
      return { ok: true, value: null };
    });
    vi.stubGlobal("window", { coinleak: { invoke, on: vi.fn() } });

    await restoreRule(deleted);
    expect(invoke.mock.calls).toEqual([
      ["rules:create", toInput(deleted)],
      ["rules:list", undefined],
      ["rules:reorder", { ids: [1, 9, 3, 4] }],
    ]);
  });
});
