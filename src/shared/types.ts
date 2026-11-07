// Domain types shared by core, main and the window. This file is a contract
// between modules: change it only when a spec says so.

/** Money in agorot (1 ILS = 100). Always an integer. Negative is money out. */
export type Agorot = number;
/** Calendar day in Israel time, `YYYY-MM-DD`. */
export type IsoDate = string;
/** Month, `YYYY-MM`. */
export type IsoMonth = string;

export type ProviderId = "discount" | "visaCal";
export type AccountKind = "bank" | "card";
export type CardMode = "credit" | "debit";
/** What a download can say about a row. */
export type ScrapedStatus = "pending" | "completed";
/** `gone`: a pending row that a later download no longer contains. */
export type TxnStatus = ScrapedStatus | "gone";
export type CategoryKind = "expense" | "income";
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
 */
export type Flow = "spending" | "income" | "refund" | "internal" | "excluded" | "gone";

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
}

export interface Category {
  id: number;
  parentId: number | null;
  name: string;
  kind: CategoryKind;
  emoji: string | null;
  color: string | null;
  archived: boolean;
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
}

export interface TransactionPatch {
  categoryId?: number | null;
  note?: string | null;
  excluded?: boolean;
}

export interface MonthSummary {
  month: IsoMonth;
  income: Agorot;
  /** Positive number: total money spent after refunds. */
  spending: Agorot;
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

/**
 * A rule as the window writes it. All conditions must hold; at least one
 * action is set. For each action the first enabled matching rule wins, and
 * a field the user set is never changed.
 */
export interface RuleInput {
  name: string;
  enabled: boolean;
  matchField: RuleMatchField;
  matchMode: RuleMatchMode;
  /** At most 200 characters. A `regex` must compile. */
  matchText: string;
  accountId: number | null;
  /** Inclusive bounds on the absolute amount. */
  amountMin: Agorot | null;
  amountMax: Agorot | null;
  direction: RuleDirection | null;
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
}
