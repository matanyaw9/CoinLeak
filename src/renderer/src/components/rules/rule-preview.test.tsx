// Spec 35: the preview lists every row with a tick box, the box above the
// list, the count, a "set by you" mark on hand-set rows, and the line on
// what unticking does. The tick logic itself is tested in rule-ticks.test.ts.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Category, RulePreview as Preview, TransactionRow } from "@shared/types";
import { s } from "@/strings";
import { indexCategories } from "@/lib/categories";
import { RulePreview, type PreviewTicks } from "./rule-preview";

const gifts: Category = {
  id: 7,
  parentId: null,
  name: "Gifts",
  kind: "expense",
  emoji: "🎁",
  color: "#E3A6B4",
  archived: false,
};

function row(id: number, description: string, categorySource: TransactionRow["categorySource"]): TransactionRow {
  return {
    id,
    accountId: 1,
    date: "2026-10-05",
    processedDate: "2026-10-05",
    amount: -12000,
    originalAmount: null,
    originalCurrency: null,
    description,
    memo: null,
    status: "completed",
    installment: null,
    categoryId: gifts.id,
    categorySource,
    note: null,
    excluded: false,
    flow: "spending",
    flags: [],
    ruleId: null,
  };
}

function render(data: Preview, ticks: Partial<PreviewTicks>) {
  const all: PreviewTicks = { ticked: new Set(), movesHandSet: 0, onToggle: () => {}, onToggleAll: () => {}, ...ticks };
  return renderToStaticMarkup(
    <RulePreview waiting={false} data={data} loading={false} broken={false} index={indexCategories([gifts])} ticks={all}>
      sentence
    </RulePreview>,
  );
}

const preview = (sample: TransactionRow[], more = 0, fixed: Pick<Preview, "alreadyHere" | "higherRule"> = { alreadyHere: [], higherRule: [] }): Preview => ({
  matches: sample.length + more,
  sample,
  more,
  exceptions: [],
  handSet: [],
  ...fixed,
});

describe("the rule preview's tick boxes", () => {
  it("shows one box per row, the box above, the count and the unticking line", () => {
    const rows = [row(3, "PAYBOX", "rule"), row(9, "העברה ב-BIT", "user"), row(14, "PAYBOX", null)];
    const html = render(preview(rows), { ticked: new Set([3, 9]), movesHandSet: 1 });
    expect(html.match(/role="checkbox"/g)).toHaveLength(4);
    expect(html).toContain('aria-checked="mixed"');
    expect(html).toContain(s.ruleTicks.count(2, 3));
    expect(html).toContain(s.ruleTicks.setByYou);
    expect(html.split(s.ruleTicks.setByYou)).toHaveLength(2);
    expect(html).toContain("data-hand-set");
    expect(html).toContain("1 ticked transaction is one you categorized by hand");
    expect(html).toContain(s.ruleTicks.hint);
  });

  it("makes the rows one Tab stop (F83): the first row is in the Tab order, the others are reached by arrow keys", () => {
    const rows = [row(3, "PAYBOX", "rule"), row(9, "העברה ב-BIT", "user"), row(14, "PAYBOX", null)];
    const html = render(preview(rows), { ticked: new Set([3]) });
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(2);
  });

  it("says how many more match past the list, and nothing about hand-set rows when none move", () => {
    const html = render(preview([row(3, "PAYBOX", "rule")], 12), { ticked: new Set([3]) });
    expect(html).toContain(s.ruleTicks.more(12));
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain("data-hand-set");
  });

  it("shows no boxes when nothing matches", () => {
    const html = render(preview([]), {});
    expect(html).not.toContain('role="checkbox"');
    expect(html).not.toContain(s.ruleTicks.hint);
  });
});

describe("hints about other rules (spec 41)", () => {
  it("names the rules that decide rows and each rule overridden, three at most before the rest", () => {
    const data: Preview = {
      ...preview([row(3, "PAYBOX", "rule")]),
      decidedHigher: 2,
      higherNames: ["Cafes"],
      overrides: ["Bakery", "Brunch", "Lunch", "Dinner", "Snacks"].map((name, i) => ({ name, rows: i + 1 })),
    };
    const html = render(data, {});
    expect(html).toContain("Cafes decides 2 of these rows");
    expect(html).toContain("Overrides Bakery on 1 row");
    expect(html).toContain("Overrides Lunch on 3 rows");
    expect(html).not.toContain("Overrides Dinner");
    expect(html).toContain("And 2 more rules");
    expect(html).toContain('title="Dinner, Snacks"');
  });

  it("a row ignored by hand under an ignore rule says Set by you, has no box and is not counted", () => {
    const data = { ...preview([row(3, "PAYBOX", "rule"), row(9, "BIT", null)]), setByYou: [3] };
    const html = render(data, { ticked: new Set([9]) });
    expect(html).toContain('data-fixed="byYou"');
    expect(html).toContain(s.ruleTicks.setByYou);
    expect(html).toContain(s.ruleTicks.count(1, 1));
    // The one row left, and the box above.
    expect(html.match(/role="checkbox"/g)).toHaveLength(2);
  });
});

describe("rows the rule would not change (wave 14 review)", () => {
  it("show a label instead of a box, and the count, the box above and the Tab order leave them out", () => {
    const rows = [row(3, "PAYBOX", "user"), row(9, "העברה ב-BIT", "rule"), row(14, "PAYBOX", null), row(20, "BIT", "rule")];
    const html = render(preview(rows, 0, { alreadyHere: [3], higherRule: [9] }), { ticked: new Set([14]) });
    expect(html).toContain(s.ruleTicks.alreadyHere);
    expect(html).toContain(s.ruleTicks.higherRule);
    // Rows 14 and 20 have boxes, plus the box above; 14 is ticked, 20 is not.
    expect(html.match(/role="checkbox"/g)).toHaveLength(3);
    expect(html).toContain(s.ruleTicks.count(1, 2));
    expect(html).toContain('aria-checked="mixed"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(1);
    // The row "Already here" was sorted by hand, but its label replaces the "Set by you" mark.
    expect(html).not.toContain(s.ruleTicks.setByYou);
  });

  it("shows no box above and no unticking line when no row has a box", () => {
    const rows = [row(3, "PAYBOX", "user")];
    const html = render(preview(rows, 0, { alreadyHere: [3], higherRule: [] }), {});
    expect(html).not.toContain('role="checkbox"');
    expect(html).not.toContain(s.ruleTicks.hint);
    expect(html).toContain(s.ruleTicks.alreadyHere);
  });
});
