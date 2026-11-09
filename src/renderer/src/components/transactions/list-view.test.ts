import { describe, expect, it } from "vitest";
import type { Account, Category } from "@shared/types";
import { indexCategories } from "@/lib/categories";
import { chipsFor, clearFilters, hasFilters, onlyCategory, readView, toFilter, writeView } from "./list-view";

const cat = (id: number, name: string, parentId: number | null = null): Category => ({
  id,
  parentId,
  name,
  kind: "expense",
  emoji: null,
  color: null,
  archived: false,
  rowCount: 0,
  ruleCount: 0,
});
const index = indexCategories([cat(1, "Food"), cat(2, "Groceries", 1), cat(3, "Coffee", 1), cat(4, "Shopping")]);
const account: Account = {
  id: 7,
  provider: "visaCal",
  kind: "card",
  accountNumber: "4321",
  name: "My card",
  cardMode: "credit",
  lastSyncedAt: null,
  syncEnabled: true,
};
const month = { from: "2026-11-01", to: "2026-11-30" };
const view = (query: string) => readView(new URLSearchParams(query));

describe("list view", () => {
  it("reads Home's category links and every filter from the URL, ignoring junk", () => {
    expect(view("category=4")).toMatchObject({ categories: [4], sort: "date" });
    expect(view("category=none")).toMatchObject({ categories: [null] });
    expect(view("category=none,2,x,-1&account=7,7&flow=spending,nope&pending=1&review=1&sort=amount_desc")).toEqual({
      categories: [null, 2],
      accounts: [7],
      flows: ["spending"],
      pending: true,
      review: true,
      sort: "amount_desc",
    });
    expect(view("sort=random").sort).toBe("date");
  });

  it("writes the view back and keeps other params", () => {
    const v = view("category=2&flow=income&sort=name");
    const out = writeView(new URLSearchParams("shot=hover&review=1"), v);
    expect(out.get("shot")).toBe("hover");
    expect(out.get("review")).toBeNull();
    expect(readView(out)).toEqual(v);
    expect(writeView(new URLSearchParams(), view("")).toString()).toBe("");
  });

  it("turns the view into one core filter", () => {
    expect(toFilter(view(""), index, { ...month, showBills: false })).toEqual({ ...month, hideInternal: true });
    expect(
      toFilter(view("category=1,none&account=7&flow=spending,savings&pending=1&review=1&sort=name"), index, {
        ...month,
        search: "cafe",
        showBills: false,
      }),
    ).toEqual({
      ...month,
      search: "cafe",
      categoryIds: [1, 2, 3, null],
      accountIds: [7],
      flows: ["spending", "refund", "transfer"],
      pending: true,
      needsReview: true,
      hideInternal: true,
      sort: "name",
    });
  });

  it("shows card bills when toggled or asked for as a kind", () => {
    expect(toFilter(view(""), index, { ...month, showBills: true }).hideInternal).toBeUndefined();
    expect(toFilter(view("flow=card_bills"), index, { ...month, showBills: false })).toMatchObject({ flows: ["internal"] });
    expect(toFilter(view("flow=card_bills"), index, { ...month, showBills: false }).hideInternal).toBeUndefined();
  });

  it("a click on a category sets exactly that filter, and clearing restores the list", () => {
    const start = view("category=2,4&flow=spending&sort=amount_asc");
    const only = onlyCategory(start, 3);
    expect(only).toEqual({ ...start, categories: [3] });
    expect(toFilter(only, index, { ...month, showBills: false }).categoryIds).toEqual([3]);
    expect(onlyCategory(view(""), 1).categories).toEqual([1]);
    const cleared = clearFilters(only);
    expect(hasFilters(cleared)).toBe(false);
    expect(cleared.sort).toBe("amount_asc");
    const { sort, ...rest } = toFilter(cleared, index, { ...month, showBills: false });
    expect(sort).toBe("amount_asc");
    expect(rest).toEqual(toFilter(view(""), index, { ...month, showBills: false }));
  });

  it("makes one chip per filter, each removing only itself", () => {
    const v = view("category=none,2&account=7&flow=ignored&pending=1&review=1");
    const chips = chipsFor(v, index, new Map([[7, account]]));
    expect(chips.map((c) => c.text)).toEqual(["Uncategorized", "Groceries", "My card", "Ignored", "Pending"]);
    expect(chips[1]?.remove.categories).toEqual([null]);
    expect(chips[2]?.remove.accounts).toEqual([]);
    expect(chips[4]?.remove).toEqual({ ...v, pending: false });
    expect(chipsFor(view("review=1"), index, new Map())).toEqual([]);
  });
});
