import { describe, expect, it } from "vitest";
import type { Db } from "../db";
import { NOW, bank, card, charge, idOf, newDb, stored, txn } from "../testing/ledger";
import { createRule } from "../rules";
import { ruleInput } from "../testing/rules";
import { restoreExclusions } from "./exclusions";
import { ingest } from "./ingest";
import { updateTransactions } from "./edits";
import { listTransactions } from "./queries";

const exclusion = (db: Db, id: number) => {
  const r = stored(db, id);
  return { excluded: r.excluded, excluded_source: r.excluded_source, rule_id: r.rule_id };
};

/** Four rows: never touched, counted by a rule, excluded by a rule, counted by the user. */
function fourRows(): { db: Db; ids: number[] } {
  const db = newDb();
  ingest(
    db,
    [
      bank([
        txn({ date: "2026-03-01", amount: -100, description: "never excluded" }),
        txn({ date: "2026-03-02", amount: -200, description: "counted by a rule" }),
        txn({ date: "2026-03-03", amount: -300, description: "skipped by a rule" }),
        txn({ date: "2026-03-04", amount: -400, description: "counted by the user" }),
      ]),
    ],
    { now: NOW },
  );
  createRule(db, ruleInput({ matchText: "counted by a rule", setExcluded: false }));
  createRule(db, ruleInput({ matchText: "skipped by a rule", setExcluded: true }));
  const ids = ["never excluded", "counted by a rule", "skipped by a rule", "counted by the user"].map((d) => idOf(db, d));
  updateTransactions(db, [ids[3] as number], { excluded: false });
  return { db, ids };
}

describe("restoreExclusions (undo of Ignore, spec 25)", () => {
  it("puts back rule-set and user-set exclusions exactly after Ignore, in one call", () => {
    const { db, ids } = fourRows();
    const before = ids.map((id) => exclusion(db, id));
    expect(before.map((b) => b.excluded_source)).toEqual([null, "rule", "rule", "user"]);

    const ignore = updateTransactions(db, ids, { excluded: true }, NOW);
    expect(ids.map((id) => exclusion(db, id).excluded_source)).toEqual(["user", "user", "user", "user"]);
    expect(restoreExclusions(db, ignore.before ?? [], NOW)).toEqual({ updated: 4 });
    expect(ids.map((id) => exclusion(db, id))).toEqual(before);
  });

  it("puts back exclusions exactly after Count again", () => {
    const { db, ids } = fourRows();
    updateTransactions(db, [ids[0] as number], { excluded: true }, NOW);
    const before = ids.map((id) => exclusion(db, id));
    const count = updateTransactions(db, ids, { excluded: false }, NOW);
    restoreExclusions(db, count.before ?? [], NOW);
    expect(ids.map((id) => exclusion(db, id))).toEqual(before);
  });

  it("hands rows back to the rules, so a rule made later can exclude them", () => {
    const { db, ids } = fourRows();
    const plain = ids[0] as number;
    const ignore = updateTransactions(db, [plain], { excluded: true }, NOW);
    restoreExclusions(db, ignore.before ?? [], NOW);
    const rule = createRule(db, ruleInput({ matchText: "never excluded", setExcluded: true }));
    expect(exclusion(db, plain)).toEqual({ excluded: 1, excluded_source: "rule", rule_id: rule.id });
  });

  it("rematches card bills when an ignored bill counts again", () => {
    const db = newDb();
    ingest(db, [card("4321", [charge("2026-03-01", -10000, "shop", "2026-03-10")])], { now: NOW });
    ingest(db, [bank([txn({ date: "2026-03-10", amount: -10000, description: "חיוב לכרטיס ויזה 4321" })])], { now: NOW });
    const bill = idOf(db, "חיוב לכרטיס ויזה 4321");
    const flowOf = () => listTransactions(db).find((r) => r.id === bill)?.flow;
    expect(flowOf()).toBe("internal");
    const ignore = updateTransactions(db, [bill], { excluded: true }, NOW);
    expect(flowOf()).toBe("excluded");
    restoreExclusions(db, ignore.before ?? [], NOW);
    expect(flowOf()).toBe("internal");
  });

  it("refuses a malformed list and changes nothing", () => {
    const { db, ids } = fourRows();
    const id = ids[0] as number;
    const before = exclusion(db, id);
    for (const bad of [
      null,
      [{ id, excluded: "yes", excludedSource: null }],
      [{ id, excluded: true, excludedSource: "bank" }],
      [{ id: 0, excluded: true, excludedSource: null }],
      [{ id, excluded: true }],
      [
        { id, excluded: true, excludedSource: "user" },
        { id, excluded: false, excludedSource: null },
      ],
    ]) {
      expect(() => restoreExclusions(db, bad as never, NOW)).toThrow("BAD_REQUEST");
    }
    expect(exclusion(db, id)).toEqual(before);
    expect(restoreExclusions(db, [], NOW)).toEqual({ updated: 0 });
  });
});
