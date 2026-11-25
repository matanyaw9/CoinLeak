// Budgets (specs 27 and 37): a standing monthly amount per spending category
// and the month's total. Children never add up to more than their nearest
// budgeted parent, top budgets never to more than the total. Also what Home's
// card and the Budgets page show. Weeks run Sunday to Saturday; the weekly
// budget is always the monthly one divided by four, rounded down.

import type {
  Agorot,
  BudgetAverage,
  BudgetChange,
  BudgetLine,
  BudgetPlan,
  BudgetProblem,
  BudgetRaise,
  BudgetStatus,
  DateRange,
  IsoDate,
  IsoMonth,
} from "@shared/types";
import { transaction, type Db } from "../db";
import { getSetting, setSetting } from "../settings";
import { averageMonths, firstMonth } from "./average";
import { addMonths, assertMonth, dayNumber, isIsoDate, monthBounds, toIsoDate } from "./dates";
import { monthRange, spendingByCategory, spendingUnder, totals } from "./period";
import { listCategories } from "./queries";
import { check, isId } from "./validate";

/** Ten million shekels, in agorot: far above any real budget, still a safe integer. */
export const BUDGET_MAX: Agorot = 1_000_000_000;

/** The full months before this one that "usual" and the averages look at. */
const PLAN_MONTHS = 3;

const isBudgetAmount = (v: unknown): v is Agorot =>
  typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v <= BUDGET_MAX;

export function weeklyBudget(monthly: Agorot): Agorot {
  return Math.floor(monthly / 4);
}

/** The Sunday to Saturday week holding `day`. */
export function weekOf(day: IsoDate): DateRange {
  // Day 0 (1970-01-01) was a Thursday, so +4 makes Sunday 0.
  const n = dayNumber(day);
  const sunday = n - ((n + 4) % 7);
  return { from: toIsoDate(sunday), to: toIsoDate(sunday + 6) };
}

/** The week shown for `month`: the one holding today, or the month's last week. */
export function budgetWeek(month: IsoMonth, today: IsoDate): DateRange {
  return weekOf(today.slice(0, 7) === month ? today : monthRange(month).to);
}

// ---- The budget tree ----

interface Node {
  id: number;
  parentId: number | null;
  depth: number;
  budget: Agorot | null;
}

/** Every spending category in tree order, with its depth and budget, and the total. */
interface Tree {
  nodes: Node[];
  byId: Map<number, Node>;
  total: Agorot | null;
}

function budgetTree(db: Db): Tree {
  const budgets = new Map(
    (db.prepare("SELECT id, monthly_budget FROM categories WHERE kind = 'expense'").all() as { id: number; monthly_budget: Agorot | null }[]).map(
      (r) => [r.id, r.monthly_budget],
    ),
  );
  const byId = new Map<number, Node>();
  const nodes: Node[] = [];
  // listCategories puts parents before their children.
  for (const c of listCategories(db)) {
    if (c.kind !== "expense") continue;
    const parent = c.parentId === null ? undefined : byId.get(c.parentId);
    const node = { id: c.id, parentId: c.parentId, depth: (parent?.depth ?? 0) + 1, budget: budgets.get(c.id) ?? null };
    nodes.push(node);
    byId.set(c.id, node);
  }
  return { nodes, byId, total: getSetting(db, "budgetTotal") };
}

/**
 * The nearest category above `id` that has a budget, or that is `also` (a
 * category looked at as if it had one); null when there is none up to the top.
 */
function nearestAbove(tree: Tree, id: number, also?: number): Node | null {
  let parentId = tree.byId.get(id)?.parentId ?? null;
  while (parentId !== null) {
    const n = tree.byId.get(parentId);
    if (!n) return null;
    if (n.budget !== null || n.id === also) return n;
    parentId = n.parentId;
  }
  return null;
}

const sumOf = (nodes: Node[]): Agorot => nodes.reduce((sum, n) => sum + (n.budget ?? 0), 0);

/** The sum of the top budgets: those with no budgeted category above them. */
function splitOf(tree: Tree): Agorot {
  return sumOf(tree.nodes.filter((n) => n.budget !== null && nearestAbove(tree, n.id) === null));
}

/** The sum of the nearest budgeted categories under `id`. */
function insideOf(tree: Tree, id: number): Agorot {
  return sumOf(tree.nodes.filter((n) => n.budget !== null && n.id !== id && nearestAbove(tree, n.id, id)?.id === id));
}

/**
 * The most `id`'s budget may be, with what limits it: its nearest budgeted
 * parent (or the total, `parent` null) minus what else sits right under that
 * parent once `id` has a budget. A budgeted category under `id` then sits
 * inside `id`, so it is not counted. `room` is null when nothing limits it.
 */
function roomOf(tree: Tree, id: number): { parent: Node | null; room: Agorot | null } {
  const parent = nearestAbove(tree, id);
  const cap = parent ? parent.budget : tree.total;
  if (cap === null) return { parent, room: null };
  const beside = tree.nodes.filter(
    (n) => n.budget !== null && n.id !== id && (nearestAbove(tree, n.id, id)?.id ?? null) === (parent?.id ?? null),
  );
  return { parent, room: cap - sumOf(beside) };
}

/** What `raiseParents` sets so `id` can have `value`: each budgeted parent, then the total, just enough. Nearest first. */
function raisesFor(tree: Tree, id: number, value: Agorot): BudgetRaise[] {
  const raises: BudgetRaise[] = [];
  for (let at = id, want = value; ; ) {
    const { parent, room } = roomOf(tree, at);
    if (room === null || want <= room) return raises;
    const to = (parent ? (parent.budget as Agorot) : (tree.total as Agorot)) + want - room;
    raises.push({ categoryId: parent?.id ?? null, to });
    if (!parent) return raises;
    at = parent.id;
    want = to;
  }
}

type CategoryBudgetProblem = Exclude<BudgetProblem, { code: "under_split" }>;

/** Why `id` cannot have `value` as things stand, or null when it can. */
function budgetProblem(tree: Tree, id: number, value: Agorot): CategoryBudgetProblem | null {
  const inside = insideOf(tree, id);
  if (value < inside) return { code: "under_children", inside };
  const { parent, room } = roomOf(tree, id);
  if (room === null || value <= room) return null;
  const raises = raisesFor(tree, id, value);
  return parent ? { code: "over_parent", parentId: parent.id, room, raises } : { code: "over_total", room, raises };
}

// ---- Setting budgets and the total ----

/**
 * Sets or clears (null) a spending category's monthly budget, in agorot.
 * Refused, with a fixed problem, when it does not fit its parent or the
 * total, or is less than the budgets under it. With `raiseParents`, a budget
 * too big for its parent raises each budgeted parent and the total just
 * enough instead, all or nothing. Clearing is always allowed.
 */
export function setBudget(
  db: Db,
  categoryId: number,
  monthlyBudget: Agorot | null,
  opts: { raiseParents?: boolean } = {},
): BudgetChange {
  check(isId(categoryId));
  check(monthlyBudget === null || isBudgetAmount(monthlyBudget));
  check(typeof opts === "object" && opts !== null && (opts.raiseParents === undefined || typeof opts.raiseParents === "boolean"));
  return transaction(db, () => {
    const row = db.prepare("SELECT kind FROM categories WHERE id = ?").get(categoryId) as { kind: string } | undefined;
    check(row !== undefined && row.kind === "expense");
    const problem = monthlyBudget === null ? null : budgetProblem(budgetTree(db), categoryId, monthlyBudget);
    if (problem?.code === "under_children") return { ok: false, problem };
    if (problem && !opts.raiseParents) return { ok: false, problem };
    const raises = problem?.raises ?? [];
    // A raise past the largest budget fails as a whole; nothing is written yet.
    check(raises.every((r) => r.to <= BUDGET_MAX));
    const write = db.prepare("UPDATE categories SET monthly_budget = ? WHERE id = ?");
    for (const r of raises) {
      if (r.categoryId === null) setSetting(db, { key: "budgetTotal", value: r.to });
      else write.run(r.to, r.categoryId);
    }
    write.run(monthlyBudget, categoryId);
    return { ok: true };
  });
}

/** Sets or clears (null) the month's total budget. Refused below what the top budgets add up to. */
export function setBudgetTotal(db: Db, total: Agorot | null): BudgetChange {
  check(total === null || isBudgetAmount(total));
  return transaction(db, () => {
    const split = splitOf(budgetTree(db));
    if (total !== null && total < split) return { ok: false, problem: { code: "under_split", split } };
    setSetting(db, { key: "budgetTotal", value: total });
    return { ok: true };
  });
}

// ---- What the window shows ----

/**
 * Spending in [from, until) for a category and everything under it, by the
 * same rules as Home's category totals (period.ts).
 */
function spentIn(db: Db, categoryId: number, from: IsoDate, until: IsoDate): Agorot {
  return spendingByCategory(db, from, until, categoryId).reduce((sum, r) => sum + r.amount, 0);
}

export function budgetStatus(db: Db, args: { month: IsoMonth; today: IsoDate }): BudgetStatus {
  check(typeof args === "object" && args !== null);
  assertMonth(args.month);
  check(isIsoDate(args.today));
  const { month, today } = args;
  const { from, until } = monthBounds(month);
  const week = budgetWeek(month, today);
  const weekUntil = toIsoDate(dayNumber(week.to) + 1);

  const budgeted = db
    .prepare("SELECT id, monthly_budget FROM categories WHERE monthly_budget IS NOT NULL ORDER BY id")
    .all() as { id: number; monthly_budget: Agorot }[];
  const lines: BudgetLine[] = budgeted.map((c) => ({
    categoryId: c.id,
    monthlyBudget: c.monthly_budget,
    spentMonth: spentIn(db, c.id, from, until),
    weeklyBudget: weeklyBudget(c.monthly_budget),
    spentWeek: spentIn(db, c.id, week.from, weekUntil),
  }));
  return { month, week, currentMonth: today.slice(0, 7) === month, lines };
}

/** The full months before today's month, at most 3, from the first transaction's month on. */
export function planMonths(db: Db, today: IsoDate): IsoMonth[] {
  const thisMonth = today.slice(0, 7);
  const window = Array.from({ length: PLAN_MONTHS }, (_, i) => addMonths(thisMonth, i - PLAN_MONTHS));
  return averageMonths(window, thisMonth, firstMonth(db));
}

/** Everything the Budgets page shows: the total, the split, the averages, and one line per spending category. */
export function budgetPlan(db: Db, args: { month: IsoMonth; today: IsoDate }): BudgetPlan {
  check(typeof args === "object" && args !== null);
  assertMonth(args.month);
  check(isIsoDate(args.today));
  const { month, today } = args;
  const tree = budgetTree(db);
  const split = splitOf(tree);
  const past = pastMonths(db, planMonths(db, today));
  const { from, until } = monthBounds(month);
  const spent = new Map(spendingUnder(db, from, until).map((c) => [c.categoryId, c.amount]));

  return {
    month,
    total: tree.total,
    split,
    left: tree.total === null ? null : tree.total - split,
    averageIncome: past?.income ?? null,
    averageSpending: past?.spending ?? null,
    lines: tree.nodes.map((n) => ({
      categoryId: n.id,
      depth: n.depth,
      budget: n.budget,
      usual: past ? (past.usual.get(n.id) ?? 0) : null,
      spent: spent.get(n.id) ?? 0,
      inside: insideOf(tree, n.id),
      room: roomOf(tree, n.id).room,
    })),
  };
}

/**
 * The average month over `months` (oldest first): income, spending, and each
 * category's spending with everything under it. Null with no months.
 */
function pastMonths(
  db: Db,
  months: IsoMonth[],
): { income: BudgetAverage; spending: BudgetAverage; usual: Map<number, Agorot> } | null {
  const first = months[0];
  const last = months.at(-1);
  if (first === undefined || last === undefined) return null;
  const { from } = monthBounds(first);
  const { until } = monthBounds(last);
  const perMonth = (amount: Agorot): Agorot => Math.round(amount / months.length);
  const average = (amount: Agorot): BudgetAverage => ({ from: first, to: last, count: months.length, amount: perMonth(amount) });
  const t = totals(db, from, until);
  return {
    income: average(t.income),
    spending: average(t.spending),
    usual: new Map(spendingUnder(db, from, until).map((c) => [c.categoryId, perMonth(c.amount)])),
  };
}
