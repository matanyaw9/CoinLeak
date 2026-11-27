// The rule editor's own checks on a pattern condition (review 2026-11-27):
// a pattern that does not compile, and one that could freeze the app, each
// get their own message before anything is sent to core.

import { describe, expect, it } from "vitest";
import { s } from "@/strings";
import { blankCondition, checkForm, formFrom, type FormCondition } from "./rule-form";

function patternProblem(pattern: string): string | undefined {
  const form = formFrom(null);
  const c = { ...blankCondition("text"), mode: "regex", values: [pattern] } as FormCondition;
  return checkForm({ ...form, conditions: [c] }).problems.conditions[c.key];
}

describe("checkForm on a pattern", () => {
  it("says a broken pattern does not work, and a risky one could freeze the app", () => {
    expect(patternProblem("(")).toBe(s.rules.editor.badPattern);
    expect(patternProblem("(\\d+)+$")).toBe(s.rules.editor.riskyPattern);
  });

  it("lets normal patterns and fixed counts through", () => {
    for (const p of ["netflix|spotify", "(\\d{4}-){3}", "^שופרסל (דיל|שלי) "]) expect(patternProblem(p), p).toBeUndefined();
  });
});
