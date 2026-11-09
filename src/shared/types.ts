// Domain types shared by core, main and the window. This file is a contract
// between modules: change it only when a spec says so.

import type { ProviderId } from "./providers";

/** Every provider of the registry in `providers.ts` (spec 08). */
export type { ProviderId };

/** Money in agorot (1 ILS = 100). Always an integer. Negative is money out. */
export type Agorot = number;
/** Calendar day in Israel time, `YYYY-MM-DD`. */
export type IsoDate = string;
/** Month, `YYYY-MM`. */
export type IsoMonth = string;

export type AccountKind = "bank" | "card";
export type CardMode = "credit" | "debit";
/** What a download can say about a row. */
export type ScrapedStatus = "pending" | "completed";
/** `gone`: a pending row that a later download no longer contains. */
export type TxnStatus = ScrapedStatus | "gone";
/** `transfer`: money moved to savings or investments (spec 14). */
export type CategoryKind = "expense" | "income" | "transfer";
export type CategorySource = "user" | "rule";

/**
 * What a row means for the totals. Derived from the row, never stored.
 * - spending: money out that counts as an expense
 * - income: money in that counts as income
 * - refund: money in on an expense category, reduces that category
 * - internal: moves between my own accounts, e.g. a card bill paid from the
 *   bank when that card's rows are also tracked. Counted zero times here
 *   because the card rows are the spending.
 * - excluded: the user said not to count it
 * - gone: a pending row the bank no longer reports; counts nowhere
 * - trashed: the user moved the row to Trash; counts nowhere, restorable
 * - transfer: a row in a transfer category (savings, investments), either
 *   direction; neither spending nor income
 */
export type Flow = "spending" | "income" | "refund" | "internal" | "excluded" | "gone" | "trashed" | "transfer";

/** Why a row needs a human look. */
export type ReviewFlag = "uncategorized" | "possible_card_bill" | "gone";

// ---- Scraper output (sync module produces, ledger consumes) ----

export interface ScrapedTransaction {
  date: IsoDate;
  processedDate: IsoDate | null;
  /** 0 on a pending foreign row means the shekel amount is not known yet; `originalAmount` holds the real one. */
  amount: Agorot;
  originalAmount: Agorot | null;
  originalCurrency: string | null;
  description: string;
  memo: string | null;
  status: ScrapedStatus;
  installment: { number: number; total: number } | null;
  /** Bank reference number. Stored, never trusted for identity. */
  identifier: string | null;
}

export interface ScrapedAccount {
  provider: ProviderId;
  /** Bank account number, or card last 4 digits. */
  accountNumber: string;
  balance: Agorot | null;
  transactions: ScrapedTransaction[];
}

// ---- Ledger read models (ledger produces, window renders) ----

export interface Account {
  id: number;
  provider: ProviderId;
  kind: AccountKind;
  accountNumber: string;
  name: string | null;
  cardMode: CardMode | null;
  lastSyncedAt: string | null;
  /** False when the user removed it from syncing (spec 15). Its rows stay and
   *  keep counting. Always set by core; absent only in older test fixtures. */
  syncEnabled?: boolean;
}

export interface Category {
  id: number;
  parentId: number | null;
  name: string;
  kind: CategoryKind;
  emoji: string | null;
  color: string | null;
  archived: boolean;
  /** Rows filed under it, trashed ones included (spec 15). Set by core. */
  rowCount?: number;
  /** Rules whose action sets it (spec 15). Set by core. */
  ruleCount?: number;
  /** Spending subcategories: true essential, false extra (spec 18). Null for
   *  groups, income and transfer categories. Set by core. */
  essential?: boolean | null;
}

export interface TransactionRow {
  id: number;
  accountId: number;
  date: IsoDate;
  processedDate: IsoDate | null;
  /** 0 on a pending foreign row means the shekel amount is not known yet; `originalAmount` holds the real one. */
  amount: Agorot;
  originalAmount: Agorot | null;
  originalCurrency: string | null;
  description: string;
  memo: string | null;
  status: TxnStatus;
  installment: { number: number; total: number } | null;
  categoryId: number | null;
  categorySource: CategorySource | null;
  note: string | null;
  excluded: boolean;
  flow: Flow;
  flags: ReviewFlag[];
  /** The last rule, in order, that set this row's category or exclusion. */
  ruleId: number | null;
  /** spec 20: `manual` rows were typed in and can be edited. Set by core. */
  source?: TxnSource;
  /** spec 20: a bank cash withdrawal counted as money moved into the cash wallet. Set by core. */
  movedToCash?: boolean;
}

export interface TransactionFilter {
  from?: IsoDate;
  to?: IsoDate;
  accountIds?: number[];
  /** `null` inside the list means "uncategorized". */
  categoryIds?: (number | null)[];
  flows?: Flow[];
  search?: string;
  needsReview?: boolean;
  /** Leaves out card bills and other internal rows (spec 11). */
  hideInternal?: boolean;
  /** spec 17: true keeps only pending rows, false only settled ones. */
  pending?: boolean;
  /** spec 17: row order. Defaults to `date`. */
  sort?: TransactionSort;
}

/**
 * spec 17. `date`: newest first. `amount_*`: by size (money in or out),
 * then newest. `name`: A to Z, Hebrew then English, numbers in natural
 * order. Ties always fall back to the newest id first.
 */
export type TransactionSort = "date" | "amount_desc" | "amount_asc" | "name";

export interface TransactionPatch {
  categoryId?: number | null;
  note?: string | null;
  excluded?: boolean;
  /**
   * Who `excluded` belongs to, only with `excluded` (spec 13, for Undo).
   * Defaults to the user. `rule` or null hands the row back to the rules,
   * which run on it at once.
   */
  excludedSource?: ExcludedSource | null;
}

export interface MonthSummary {
  month: IsoMonth;
  income: Agorot;
  /** Positive number: total money spent after refunds. */
  spending: Agorot;
  /** Net money moved to savings or investments (positive: moved out). Not spending. */
  transfers: Agorot;
  byCategory: { categoryId: number | null; amount: Agorot; count: number }[];
  /** Same money rolled up to top-level categories (null: uncategorized). */
  byParent: { categoryId: number | null; amount: Agorot; count: number }[];
  /** Cumulative spending per day of the month. */
  byDay: { date: IsoDate; amount: Agorot }[];
  needsReview: number;
}

export interface TrendPoint {
  month: IsoMonth;
  income: Agorot;
  spending: Agorot;
  byCategory: { categoryId: number | null; amount: Agorot }[];
  /** All spending split by the categories' essential tag (spec 22). Only on
   *  unfiltered points; the three add up to `spending`. */
  split?: EssentialSplit;
}

/** Spending by the essential tag: untagged is uncategorized rows and rows on
 *  a category with no tag (a group itself, or an income category). */
export interface EssentialSplit {
  essential: Agorot;
  extra: Agorot;
  untagged: Agorot;
}

/** Cumulative spending per day for one category (its subcategories included;
 *  null is uncategorized), this month and the month before for comparison. */
export interface CategoryCurve {
  categoryId: number | null;
  byDay: { date: IsoDate; amount: Agorot }[];
  previousByDay: { date: IsoDate; amount: Agorot }[];
}

export interface SyncResult {
  provider: ProviderId;
  accounts: number;
  newRows: number;
  updatedRows: number;
}

export type SyncStage =
  | "opening_browser"
  | "waiting_for_login"
  | "downloading"
  | "saving"
  | "done"
  | "failed";

export interface SyncProgress {
  provider: ProviderId;
  stage: SyncStage;
}

export interface AppInfo {
  version: string;
  dataDir: string;
  dev: boolean;
}

// ---- Rules (spec 07) ----

export type RuleMatchField = "description" | "memo";
/** Every mode ignores case and runs of whitespace. */
export type RuleMatchMode = "contains" | "starts_with" | "equals" | "regex";
/** `in`: money in (amount above zero). `out`: everything else, as in the flow. */
export type RuleDirection = "out" | "in";

/** `all`: every condition must hold (AND). `any`: at least one (OR). */
export type RuleJoin = "all" | "any";

/**
 * One test a row is put to. A text condition holds one or more values and
 * holds when any of them fits ("contains Aroma, Cofix or Landwer"). Text
 * compares without case and with whitespace runs collapsed. An amount
 * condition reads the absolute amount, bounds inclusive, at least one set.
 */
export type RuleCondition =
  | { kind: "text"; field: RuleMatchField; mode: RuleMatchMode; values: string[] }
  | { kind: "account"; accountId: number }
  | { kind: "amount"; min: Agorot | null; max: Agorot | null }
  | { kind: "direction"; direction: RuleDirection };

/**
 * A rule as the window writes it: conditions joined by `join`, and at least
 * one action. For each action the first enabled matching rule wins, and a
 * field the user set is never changed (spec 13 changed this shape).
 */
export interface RuleInput {
  name: string;
  enabled: boolean;
  join: RuleJoin;
  /** 1 to 20. Each text value at most 200 characters, at most 200 values; a `regex` value must compile. */
  conditions: RuleCondition[];
  setCategoryId: number | null;
  /** true excludes the row, false counts it (and stops later exclude rules). */
  setExcluded: boolean | null;
}

export interface Rule extends RuleInput {
  id: number;
  /** Order of evaluation, 1 first. */
  position: number;
}

export interface RulePreview {
  /** Rows whose text, account, amount and direction match today. */
  matches: number;
  /** Up to 20 of them, newest first. */
  sample: TransactionRow[];
  /**
   * Matching rows the user sorted by hand into a category other than the
   * rule's, newest first, every one of them (spec 13). Empty when the rule
   * sets no category. The rule leaves them alone unless the save names them.
   */
  handSet: TransactionRow[];
}

// ---- Rules v2 (spec 13) ----

/** What saving a rule did. */
export interface RuleSaved {
  rule: Rule;
  /** Rows this rule sorts now (sets their category or exclusion). */
  applied: number;
  /** Rows whose category, exclusion or rule changed with this save. */
  changed: number;
}

/** What "Apply now" did. */
export interface RulesApplied {
  /** Rows whose category, exclusion or rule changed. */
  changed: number;
  /** Rows the rules sort, all together, after the run. */
  sorted: number;
}

/**
 * A category's known places: the names in its list rules. A list rule is an
 * enabled rule with exactly one condition, a text condition on the
 * description that is not a pattern, and one action: set this category.
 */
export interface KnownPlaces {
  categoryId: number;
  /** Every name, in rule order then list order, repeats (ignoring case) removed. */
  names: string[];
  /** The list rules they come from, in rule order. New names go to the first. */
  ruleIds: number[];
}

export interface KnownPlaceAdded {
  /** The list rule that holds the name. */
  ruleId: number;
  /** True when the category had no list rule and one was made. */
  created: boolean;
  /** False when the name was already on the list. */
  added: boolean;
  /** Rows whose category, exclusion or rule changed. */
  changed: number;
}

/** One starter list the Rules page can offer (never added without the user). */
export interface StarterList {
  /** Stable key, e.g. "supermarkets"; the window names it. */
  key: string;
  categoryId: number;
  /** The names that would be added: those no list rule has yet. */
  names: string[];
  /** Rows this list would sort if added with the others offered. */
  sorts: number;
}

export interface StarterPreview {
  /** Lists for seeded categories the user has not renamed or removed. */
  lists: StarterList[];
  /** Rows all offered lists would sort together. */
  sorts: number;
}

export interface StartersAdded {
  /** List rules made or extended. */
  rules: number;
  /** Rows whose category, exclusion or rule changed. */
  changed: number;
}

export type ExcludedSource = "user" | "rule";

/** A row's exclusion and who set it, so Undo can put both back. */
export interface ExclusionState {
  id: number;
  excluded: boolean;
  excludedSource: ExcludedSource | null;
}

// ---- Money flow (spec 14) ----

/**
 * - income: an income category (top level; null is uncategorized income)
 * - refund: a spending category refunded more than spent this month
 * - from_savings: money taken back out of savings (a net transfer in)
 * - beyond_income: spending and transfers beyond what came in (spec 16)
 * - hub: everything that came in, in the middle
 * - spending: a top-level spending category (null is uncategorized)
 * - transfer: a top-level transfer category, net moved out
 * - left: what stayed after spending and transfers
 * - group: a spending group's total, on the left of its drill-down (spec 16)
 */
export type MoneyFlowNodeKind =
  | "income"
  | "refund"
  | "from_savings"
  | "beyond_income"
  | "hub"
  | "spending"
  | "transfer"
  | "left"
  | "group";

export interface MoneyFlowNode {
  kind: MoneyFlowNodeKind;
  categoryId: number | null;
  /** Positive. The hub holds the sum of the left side, which equals the right. */
  amount: Agorot;
}

/** `source` and `target` index into `nodes`. Every link touches the hub. */
export interface MoneyFlowLink {
  source: number;
  target: number;
  amount: Agorot;
}

/** Where a month's money came from and where it went. Empty when nothing moved. */
export interface MoneyFlow {
  month: IsoMonth;
  income: Agorot;
  /** Same as `MonthSummary.spending`. */
  spending: Agorot;
  /** Same as `MonthSummary.transfers`. */
  transfers: Agorot;
  /** Spending plus transfers minus income, when positive; else 0 (spec 16). */
  shortfall: Agorot;
  nodes: MoneyFlowNode[];
  links: MoneyFlowLink[];
}

// ---- Categories editor, money accounts, settings (spec 15) ----

/** A new category. `parentId` null makes a top-level (meta) category. */
export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  parentId: number | null;
  emoji: string | null;
  /** `#RRGGBB`. */
  color: string | null;
  /** Spending subcategories only (spec 18); left out means essential. */
  essential?: boolean;
}

/** Fields left out stay as they are. The kind never changes after creation. */
export interface CategoryPatch {
  name?: string;
  emoji?: string | null;
  color?: string | null;
  parentId?: number | null;
  /** Spending subcategories only (spec 18). */
  essential?: boolean;
}

/**
 * Why core refused a category change. Fixed codes; the window turns them
 * into friendly text. The two-level and same-kind rules are the database's.
 */
export type CategoryProblem =
  | "name_taken"
  | "parent_not_top_level"
  | "parent_other_kind"
  | "has_children"
  | "in_use"
  | "target_other_kind";

export type CategoryChange = { ok: true; category: Category } | { ok: false; problem: CategoryProblem };

/** Deleting: `moved` rows and rules went to `moveTo` first. */
export type CategoryDeleteResult =
  | { ok: true; movedRows: number; movedRules: number }
  | { ok: false; problem: CategoryProblem };

/** Every setting the app keeps in its database, with its value type. */
export interface AppSettings {
  /** Providers the user added in the picker that may have no money accounts yet. */
  addedProviders: ProviderId[];
}

export type SettingKey = keyof AppSettings;
export type SettingEntry = { [K in SettingKey]: { key: K; value: AppSettings[K] } }[SettingKey];

// ---- Time periods (spec 16) ----

/** Any stretch of days, both ends included. */
export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

/** How a period's series is cut: by day up to 62 days, by week up to a year, by month beyond. */
export type SeriesBucket = "day" | "week" | "month";

/** One bucket of a series: its days, and spending from the period's start through its end. */
export interface SeriesPoint {
  from: IsoDate;
  to: IsoDate;
  amount: Agorot;
}

/**
 * The period before, for comparison: the same number of whole months when
 * the period is whole months, else the same number of days just before.
 */
export interface PreviousPeriod extends DateRange {
  spending: Agorot;
  /** Spent by the same point of the previous period; all of it when the period is over. */
  sameTime: Agorot;
  /** Always full length. */
  series: SeriesPoint[];
}

/** Like `MonthSummary` for any range, with the same rules. */
export interface PeriodSummary extends DateRange {
  income: Agorot;
  spending: Agorot;
  transfers: Agorot;
  needsReview: number;
  byCategory: { categoryId: number | null; amount: Agorot; count: number }[];
  byParent: { categoryId: number | null; amount: Agorot; count: number }[];
  bucket: SeriesBucket;
  /** Cumulative spending per bucket, stopping at today's bucket. */
  series: SeriesPoint[];
  /** True when today falls inside the range. */
  inProgress: boolean;
  previous: PreviousPeriod;
  /** Spending in the range that is neither essential nor extra, whatever the filter (spec 22). */
  untagged: Agorot;
}

/**
 * Essentials or extras only (spec 22): true essential spending, false extra.
 * Left out means all spending. Income lines never change with it.
 */
export interface EssentialFilter {
  essential?: boolean;
}

/** Money left this calendar month in Israel time, whatever period Home shows (spec 22). */
export interface ThisMonth {
  month: IsoMonth;
  today: IsoDate;
  income: Agorot;
  spending: Agorot;
  /** Net money moved to savings or investments this month (positive: moved out). */
  transfers: Agorot;
  /** Income minus spending minus savings moves; negative when they outran income. */
  left: Agorot;
  /** From today to the month's last day, today included. */
  daysLeft: number;
  /** `left / daysLeft` rounded down to whole shekels; null when nothing is left. */
  perDay: Agorot | null;
}

/** `MoneyFlow` for any range. */
export type PeriodFlow = Omit<MoneyFlow, "month"> & DateRange;

/**
 * One spending group opened up: the group's total (a `group` node) on the
 * left, its categories (`spending`, the group's own id for rows set on the
 * group itself) on the right. A category refunded beyond its spending is a
 * `refund` node on the left, and then a `hub` sits in the middle.
 */
export interface GroupFlow extends DateRange {
  categoryId: number;
  /** Same as this group's node in the period's flow. */
  total: Agorot;
  nodes: MoneyFlowNode[];
  links: MoneyFlowLink[];
}

/** A category's cumulative spending through a period and the one before. */
export interface PeriodCurve {
  categoryId: number | null;
  bucket: SeriesBucket;
  series: SeriesPoint[];
  previous: SeriesPoint[];
}

// ---- Profiles (spec 19) ----

/** Separate data for one person or purpose: a name and its own database file. */
export interface Profile {
  id: string;
  name: string;
  /** The database file's name inside the data folder. */
  file: string;
  /** The Demo profile: made-up data, never syncs. */
  demo: boolean;
}

export interface ProfileList {
  /** Id of the profile that is open now. */
  current: string;
  profiles: Profile[];
}

// ---- Cash wallet and rows by hand (spec 20) ----

/** Where a row came from: a bank download, or typed in by the user. */
export type TxnSource = "sync" | "manual";

/**
 * A row the user types into the cash wallet. `amount` is signed agorot,
 * never 0 (negative is money out). `description` 1 to 200 characters after
 * trimming; `note` at most 500, empty means none.
 */
export interface ManualTransactionInput {
  date: IsoDate;
  amount: Agorot;
  description: string;
  categoryId: number | null;
  note: string | null;
}

/** The profile's one cash wallet. It never syncs. */
export interface CashWallet {
  id: number;
  /** Its rows, trashed ones left out. */
  rowCount: number;
}
