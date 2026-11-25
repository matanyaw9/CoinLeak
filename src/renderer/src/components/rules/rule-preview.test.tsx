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

const preview = (sample: TransactionRow[], more = 0): Preview => ({
  matches: sample.length + more,
  sample,
  more,
  exceptions: [],
  handSet: [],
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
