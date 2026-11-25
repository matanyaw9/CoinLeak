import { describe, expect, it } from "vitest";
import type { Account, Category } from "@shared/types";
import { indexCategories } from "@/lib/categories";
import { chipsFor, clearFilters, clickColumn, columnOf, groupsByDay, hasFilters, onlyCategory, readView, sortArrow, toFilter, writeView } from "./list-view";

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

  it("picking a category means it and everything under it, three levels down (spec 34)", () => {
    const deep = indexCategories([cat(1, "Food"), cat(2, "Groceries", 1), cat(5, "Weekly shop", 2), cat(3, "Coffee", 1)]);
    const filter = (q: string) => toFilter(view(q), deep, { ...month, showBills: false }).categoryIds;
    expect(filter("category=1")).toEqual([1, 2, 5, 3]);
    expect(filter("category=2")).toEqual([2, 5]);
    expect(filter("category=5")).toEqual([5]);
    expect(filter("category=2,5")).toEqual([2, 5]);
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

  it("names the cash wallet Cash, and filters it by its account id", () => {
    const v = view("account=7,9");
    expect(chipsFor(v, index, new Map([[7, account]]), 9).map((c) => c.text)).toEqual(["My card", "Cash"]);
    expect(toFilter(v, index, { ...month, showBills: false }).accountIds).toEqual([7, 9]);
  });
});

describe("sorting from the column headers (spec 31)", () => {
  it("a click on another column sorts by it; on the active one it flips", () => {
    expect(clickColumn("date", "date")).toBe("date_asc");
    expect(clickColumn("date_asc", "date")).toBe("date");
    expect(clickColumn("date", "amount")).toBe("amount_desc");
    expect(clickColumn("amount_desc", "amount")).toBe("amount_asc");
    expect(clickColumn("amount_asc", "amount")).toBe("amount_desc");
    expect(clickColumn("amount_asc", "name")).toBe("name");
    expect(clickColumn("name", "name")).toBe("name_desc");
    expect(clickColumn("name_desc", "name")).toBe("name");
    expect(clickColumn("name_desc", "date")).toBe("date");
  });

  it("marks the active column and its direction, and groups by day for either date order", () => {
    expect((["date", "date_asc", "name", "name_desc", "amount_desc", "amount_asc"] as const).map((s) => columnOf(s))).toEqual([
      "date",
      "date",
      "name",
      "name",
      "amount",
      "amount",
    ]);
    expect(sortArrow("date")).toBe("down");
    expect(sortArrow("date_asc")).toBe("up");
    expect(sortArrow("amount_desc")).toBe("down");
    expect(sortArrow("name")).toBe("up");
    expect(groupsByDay("date")).toBe(true);
    expect(groupsByDay("date_asc")).toBe(true);
    expect(groupsByDay("amount_desc")).toBe(false);
    expect(groupsByDay("name")).toBe(false);
  });

  it("every header order survives the URL round trip and reaches core", () => {
    for (const sort of ["date", "date_asc", "name", "name_desc", "amount_desc", "amount_asc"] as const) {
      const out = writeView(new URLSearchParams("category=4"), { ...view("category=4"), sort });
      expect(readView(out).sort).toBe(sort);
      expect(out.get("sort")).toBe(sort === "date" ? null : sort);
      expect(toFilter(readView(out), index, { ...month, showBills: false }).sort).toBe(sort === "date" ? undefined : sort);
    }
  });
});
