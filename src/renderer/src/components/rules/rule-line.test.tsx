// spec 21: a rule line shows its place and the "also fits" counts from core,
// and while a search is on it cannot be dragged or moved.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Rule } from "@shared/types";
import { s } from "@/strings";
import { indexCategories } from "@/lib/categories";
import { RuleLine } from "./rule-line";

const rule: Rule = {
  id: 5,
  position: 3,
  name: "Cafes",
  enabled: true,
  join: "all",
  conditions: [{ kind: "text", field: "description", mode: "contains", values: ["קפה"] }],
  setCategoryId: null,
  setExcluded: true,
  overlaps: [{ action: "exclude", count: 12, winnerId: 2, winnerNames: ["Fees"] }],
  overrides: { names: ["Bakery", "Brunch"], rows: 3 },
};

function line(searching: boolean, armed = true) {
  const noop = () => undefined;
  return renderToStaticMarkup(
    <RuleLine
      rule={rule}
      place={3}
      query={searching ? "קפה" : ""}
      index={indexCategories([])}
      context={{ category: () => undefined, account: () => undefined }}
      searching={searching}
      first={false}
      last={false}
      dragging={false}
      draggable={!searching && armed}
      onArm={noop}
      onDragStart={noop}
      onDragOver={noop}
      onDragEnd={noop}
      onMove={noop}
      onOpen={noop}
      onToggle={noop}
      onDelete={noop}
    />,
  );
}

describe("a rule line", () => {
  it("shows its place, which rule decides rows here, and which rules it overrides", () => {
    const html = line(false);
    expect(html).toContain(`aria-label="${s.ruleOrder.place(3)}"`);
    expect(html).toContain("Fees decides whether 12 of these rows count");
    // Several rules: a count in the line, the names in its title.
    expect(html).toContain("Overrides 2 rules on 3 rows");
    expect(html).toContain('title="Bakery, Brunch"');
  });

  it("can be dragged and moved without a search", () => {
    const html = line(false);
    expect(html).toContain('draggable="true"');
    expect(html).toContain(`aria-label="${s.rules.drag}"`);
    expect(html).toContain(`aria-label="${s.rules.moveUp}"`);
  });

  it("has no grip, no arrows and no dragging while searching", () => {
    const html = line(true);
    expect(html).not.toContain('draggable="true"');
    expect(html).not.toContain(`aria-label="${s.rules.drag}"`);
    expect(html).not.toContain(`aria-label="${s.rules.moveUp}"`);
    expect(html).not.toContain(`aria-label="${s.rules.moveDown}"`);
    expect(html).toContain("<mark");
  });
});
