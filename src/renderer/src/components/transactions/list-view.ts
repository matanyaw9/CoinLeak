// What the Transactions list shows (spec 17): sort and filters, kept in the
// URL so Home links and Back work. Turns them into one core filter; core
// does the sorting and filtering.

import type { Account, Category, Flow, TransactionFilter, TransactionSort } from "@shared/types";
import { s } from "@/strings";
import { idsUnder, type CategoryIndex } from "@/lib/categories";
import { accountLabel } from "@/components/common/chips";

/** The flows a person thinks in, each one or more core flows. */
export type FlowChoice = "spending" | "income" | "savings" | "ignored" | "card_bills";

export const FLOW_CHOICES: Record<FlowChoice, Flow[]> = {
  spending: ["spending", "refund"],
  income: ["income"],
  savings: ["transfer"],
  ignored: ["excluded"],
  card_bills: ["internal"],
};

export const SORTS: TransactionSort[] = ["date", "amount_desc", "amount_asc", "name"];

export interface ListView {
  /** As picked: a parent stands for its children too. `null` is uncategorized. */
  categories: (number | null)[];
  accounts: number[];
  flows: FlowChoice[];
  pending: boolean;
  review: boolean;
  sort: TransactionSort;
}

const isFlowChoice = (v: string): v is FlowChoice => v in FLOW_CHOICES;
const isSort = (v: string | null): v is TransactionSort => SORTS.includes(v as TransactionSort);
const ids = (raw: string | null): number[] =>
  (raw ?? "")
    .split(",")
    .map(Number)
    .filter((n) => Number.isSafeInteger(n) && n > 0);
const unique = <T>(xs: T[]): T[] => [...new Set(xs)];

export function readView(params: URLSearchParams): ListView {
  const cats = (params.get("category") ?? "").split(",").filter(Boolean);
  const sort = params.get("sort");
  return {
    categories: unique(cats.map((c) => (c === "none" ? null : Number(c))).filter((c) => c === null || (Number.isSafeInteger(c) && c > 0))),
    accounts: unique(ids(params.get("account"))),
    flows: unique((params.get("flow") ?? "").split(",").filter(isFlowChoice)),
    pending: params.get("pending") === "1",
    review: params.get("review") === "1",
    sort: isSort(sort) ? sort : "date",
  };
}

/** The same params with the view written in; anything else is kept. */
export function writeView(params: URLSearchParams, view: ListView): URLSearchParams {
  const next = new URLSearchParams(params);
  const put = (key: string, value: string | null) => (value ? next.set(key, value) : next.delete(key));
  put("category", view.categories.map((c) => (c === null ? "none" : String(c))).join(","));
  put("account", view.accounts.join(","));
  put("flow", view.flows.join(","));
  put("pending", view.pending ? "1" : null);
  put("review", view.review ? "1" : null);
  put("sort", view.sort === "date" ? null : view.sort);
  return next;
}

/** Clicking a row's category: show exactly that category, keep the rest. */
export function onlyCategory(view: ListView, id: number | null): ListView {
  return { ...view, categories: [id] };
}

export function toggle<T>(xs: T[], x: T): T[] {
  return xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x];
}

/** Every filter off; the sort stays. */
export function clearFilters(view: ListView): ListView {
  return { ...view, categories: [], accounts: [], flows: [], pending: false, review: false };
}

export function hasFilters(view: ListView): boolean {
  return view.categories.length + view.accounts.length + view.flows.length > 0 || view.pending || view.review;
}

/** Card bills show when asked for, by the toggle or the card bills flow. */
export function showsCardBills(view: ListView, toggled: boolean): boolean {
  return toggled || view.flows.includes("card_bills");
}

export interface FilterChip {
  key: string;
  text: string;
  /** Category chips carry their category (null: uncategorized) for the dot. */
  category?: Category | null;
  /** The view with this filter taken off. */
  remove: ListView;
}

/** The active filters, one chip each. Needs review shows in its own switch. */
export function chipsFor(view: ListView, index: CategoryIndex, accountById: Map<number, Account>): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const id of view.categories) {
    const category = id === null ? null : (index.byId.get(id) ?? null);
    chips.push({
      key: `c${id ?? "none"}`,
      text: category ? category.name : s.common.uncategorized,
      category,
      remove: { ...view, categories: view.categories.filter((x) => x !== id) },
    });
  }
  for (const id of view.accounts) {
    const a = accountById.get(id);
    chips.push({ key: `a${id}`, text: a ? accountLabel(a) : String(id), remove: { ...view, accounts: view.accounts.filter((x) => x !== id) } });
  }
  for (const flow of view.flows) {
    chips.push({ key: `f${flow}`, text: s.txTools.flows[flow] ?? flow, remove: { ...view, flows: view.flows.filter((x) => x !== flow) } });
  }
  if (view.pending) chips.push({ key: "pending", text: s.txTools.filter.pending, remove: { ...view, pending: false } });
  return chips;
}

export function toFilter(
  view: ListView,
  index: CategoryIndex,
  base: { from: string; to: string; search?: string; showBills: boolean },
): TransactionFilter {
  const f: TransactionFilter = { from: base.from, to: base.to };
  if (base.search) f.search = base.search;
  if (view.review) f.needsReview = true;
  if (view.pending) f.pending = true;
  if (view.categories.length) {
    f.categoryIds = unique(view.categories.flatMap((c) => (c === null ? [null] : idsUnder(index, c))));
  }
  if (view.accounts.length) f.accountIds = [...view.accounts];
  if (view.flows.length) f.flows = unique(view.flows.flatMap((c) => FLOW_CHOICES[c]));
  if (!showsCardBills(view, base.showBills)) f.hideInternal = true;
  if (view.sort !== "date") f.sort = view.sort;
  return f;
}
