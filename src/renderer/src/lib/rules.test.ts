// The rule editor's form and the calls behind the rules screen: amounts in
// shekels, suggestions opt-in, and Undo putting a rule back in its place.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { Rule, RuleInput } from "@shared/types";
import { checkForm, formFrom, parseShekels, shekelText } from "./rule-form";
import { moveId, restoreRule, toInput } from "./rules";

const draft: RuleInput = {
  name: "שופרסל",
  enabled: true,
  matchField: "description",
  matchMode: "starts_with",
  matchText: "שופרסל",
  accountId: 2,
  amountMin: 5800,
  amountMax: 64050,
  direction: null,
  setCategoryId: 11,
  setExcluded: null,
};

describe("rule form", () => {
  it("reads and writes shekels as agorot", () => {
    expect([shekelText(5800), shekelText(64050), shekelText(5), shekelText(null)]).toEqual(["58", "640.50", "0.05", ""]);
    expect([parseShekels("58"), parseShekels("₪1,200.5"), parseShekels(" "), parseShekels("12.345"), parseShekels("-3")]).toEqual([
      5800, 120050, null, undefined, undefined,
    ]);
  });

  it("shows a suggestion's account and amount span but leaves them off", () => {
    const form = formFrom(draft, { optIn: true });
    expect(form).toMatchObject({ useAccount: false, accountId: 2, useAmount: false, amountMin: "58", amountMax: "640.50" });
    expect(checkForm(form).rule).toEqual({ ...draft, accountId: null, amountMin: null, amountMax: null });
    expect(checkForm({ ...form, useAccount: true, useAmount: true }).rule).toEqual(draft);
  });

  it("round-trips a saved rule, and names it after its text when the name is empty", () => {
    const saved: RuleInput = { ...draft, direction: "out", setExcluded: false, enabled: false };
    expect(checkForm(formFrom(saved)).rule).toEqual(saved);
    expect(checkForm({ ...formFrom(saved), name: "  " }).rule?.name).toBe("שופרסל");
  });

  it("explains what is missing, and previews before an action is chosen", () => {
    const blank = checkForm(formFrom(null));
    expect(blank.rule).toBeNull();
    expect(blank.preview).toBeNull();
    expect(Object.keys(blank.problems).sort()).toEqual(["action", "text"]);

    const noAction = checkForm({ ...formFrom(null), matchText: " wolt " });
    expect(noAction.preview).toMatchObject({ matchText: "wolt", setCategoryId: null, setExcluded: null });
    expect(noAction.rule).toBeNull();

    const bad = checkForm({ ...formFrom(draft), amountMin: "700" });
    expect(bad.problems.amount).toBeDefined();
    expect(bad.preview).toBeNull();
  });
});

describe("rules calls", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("moves a rule within the order", () => {
    expect(moveId([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
    expect(moveId([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveId([1, 2], 5, 0)).toEqual([1, 2]);
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
