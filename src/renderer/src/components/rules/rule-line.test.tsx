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
  overlaps: [{ action: "exclude", count: 12, winnerId: 2 }],
};

function line(searching: boolean, armed = true) {
  const noop = () => undefined;
  return renderToStaticMarkup(
    <RuleLine
      rule={rule}
      place={3}
      placeOf={(id) => (id === 2 ? 2 : 3)}
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
  it("shows its place and what a higher rule decides", () => {
    const html = line(false);
    expect(html).toContain(`aria-label="${s.ruleOrder.place(3)}"`);
    expect(html).toContain(s.ruleOrder.alsoFitsExclude(12, 2));
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
