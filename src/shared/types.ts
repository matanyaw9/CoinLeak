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
export type TxnStatus = "pending" | "completed";
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
 */
export type Flow = "spending" | "income" | "refund" | "internal" | "excluded";

/** Why a row needs a human look. */
export type ReviewFlag = "uncategorized" | "possible_card_bill";

// ---- Scraper output (sync module produces, ledger consumes) ----

export interface ScrapedTransaction {
  date: IsoDate;
  processedDate: IsoDate | null;
  amount: Agorot;
  originalAmount: Agorot | null;
  originalCurrency: string | null;
  description: string;
  memo: string | null;
  status: TxnStatus;
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
