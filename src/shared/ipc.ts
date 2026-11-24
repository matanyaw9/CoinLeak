// The complete list of requests the window can make and events it can hear.
// Adding a channel here (and a handler in main) is the only way to add one.

import type {
  Account,
  Agorot,
  AppInfo,
  BudgetStatus,
  IsoMonth,
  BalanceCheck,
  CardMode,
  CashWallet,
  AppSettings,
  Category,
  CategoryChange,
  CategoryDeleteResult,
  CategoryInput,
  CategoryPatch,
  DateRange,
  EssentialFilter,
  ExclusionState,
  GroupFlow,
  PeriodCurve,
  PeriodFlow,
  PeriodSummary,
  KnownPlaceAdded,
  KnownPlaces,
  ManualTransactionInput,
  ProviderId,
  Rule,
  RuleInput,
  RulePreview,
  RulePreviewArgs,
  SettingEntry,
  SettingKey,
  RuleSaved,
  RulesApplied,
  StarterPreview,
  StartersAdded,
  Profile,
  ProfileList,
  SyncProgress,
  SyncRange,
  SyncResult,
  SyncMode,
  TransactionFilter,
  TransactionPatch,
  TransactionList,
  ThisMonth,
  PeriodTrend,
  MonthNet,
  PaidBackResult,
  TransactionRow,
} from "./types";
import type { Result } from "./errors";

export interface IpcContract {
  "app:info": { args: undefined; result: AppInfo };
  "accounts:list": { args: undefined; result: Account[] };
  "categories:list": { args: undefined; result: Category[] };
  /** The rows, plus each of their days' spending and income for the day headers. */
  "transactions:list": { args: TransactionFilter; result: TransactionList };
  /** With `excluded` in the patch, `before` holds each named row's exclusion as it was, for Undo (spec 13). */
  "transactions:update": {
    args: { ids: number[]; patch: TransactionPatch };
    result: { updated: number; before?: ExclusionState[] };
  };
  /** Undo of Ignore or Count again: puts back each row's exclusion from `before`, in one step. */
  "transactions:restoreExclusions": { args: { states: ExclusionState[] }; result: { updated: number } };
  /** The user's word on card bills: true internal, false spending, null back to automatic. */
  "transactions:setInternal": { args: { ids: number[]; internal: boolean | null }; result: { updated: number } };
  /** Only rows with status `gone` can be deleted. */
  "transactions:deleteGone": { args: { ids: number[] }; result: { deleted: number } };
  /** Trash (spec 11): trashed rows count nowhere and leave every list until restored. */
  "transactions:trash": { args: { ids: number[] }; result: { updated: number } };
  "transactions:restore": { args: { ids: number[] }; result: { updated: number } };
  /** Deletes every trashed row for good. The window asks the user first. */
  "transactions:emptyTrash": { args: undefined; result: { deleted: number } };
  "accounts:setCardMode": { args: { accountId: number; mode: CardMode }; result: null };
  // ---- Summaries for any range of days (spec 16) ----
  /** With `essential`, every spending number is essentials or extras only (spec 22). */
  "summary:period": { args: DateRange & EssentialFilter; result: PeriodSummary };
  /** Spending above income shows as `beyond_income`, never as savings. */
  "summary:periodFlow": { args: DateRange; result: PeriodFlow };
  /** One spending group opened up, for the Sankey drill-down. */
  "summary:groupFlow": { args: DateRange & { categoryId: number }; result: GroupFlow };
  /**
   * The calendar months the range covers (at least 3, never past this month).
   * `essential: null` is spending that is neither essential nor extra.
   * With `categoryIds`, `byCategory` has one entry per id in that order, each
   * with its subcategories (null: uncategorized), and `spending` is their sum.
   * `average` is the average month over the full months shown (spec 26).
   */
  "summary:periodTrend": {
    args: DateRange & EssentialFilter & { categoryIds?: (number | null)[] };
    result: PeriodTrend;
  };
  "summary:periodCurves": { args: DateRange & EssentialFilter & { categoryIds: (number | null)[] }; result: PeriodCurve[] };
  /** Money left this calendar month (Israel time) and per day until its end (spec 22). */
  "summary:thisMonth": { args: undefined; result: ThisMonth };
  /**
   * Saved or overspent (spec 30): income minus spending per calendar month, the
   * same months as the month-by-month bars, from the first transaction's month on.
   */
  "summary:monthlyNet": { args: DateRange; result: MonthNet[] };
  /** `mode` defaults to quick (spec 32). */
  "sync:start": { args: { provider: ProviderId; mode?: SyncMode }; result: SyncResult };
  "sync:cancel": { args: undefined; result: null };
  /** Rules in evaluation order. Every change below reapplies all rules to all rows. */
  "rules:list": { args: undefined; result: Rule[] };
  "rules:create": { args: RuleInput; result: Rule };
  "rules:update": { args: { id: number; rule: RuleInput }; result: Rule };
  "rules:delete": { args: { id: number }; result: null };
  /** `ids` is every rule id in the new order. */
  "rules:reorder": { args: { ids: number[] }; result: null };
  /** Checks the conditions against today's rows without saving anything. */
  "rules:preview": { args: RulePreviewArgs; result: RulePreview };
  /** A draft rule from the rows the user selected. */
  "rules:suggest": { args: { ids: number[] }; result: RuleInput };
  /** Categories editor (spec 15). Refusals come back as a fixed problem code. */
  "categories:create": { args: CategoryInput; result: CategoryChange };
  "categories:update": { args: { id: number; patch: CategoryPatch }; result: CategoryChange };
  /** Refused while rows or rules use it, unless `moveTo` names where they go first. */
  "categories:delete": { args: { id: number; moveTo: number | null }; result: CategoryDeleteResult };
  /** Remove money accounts from syncing, or add them back. Rows always stay and count. */
  "accounts:setSyncing": { args: { ids: number[]; enabled: boolean }; result: { updated: number } };
  "settings:get": { args: { key: SettingKey }; result: AppSettings[SettingKey] };
  "settings:set": { args: SettingEntry; result: null };
  // ---- spec 13 ----
  /**
   * Creates (`id` null) or updates a rule and reapplies all rules. `alsoChange`
   * names rows the user sorted by hand (from the preview's `handSet`) that this
   * rule may take over once; any other row the user set stays as it is.
   */
  "rules:save": { args: { id: number | null; rule: RuleInput; alsoChange?: number[] }; result: RuleSaved };
  /** Reapplies every rule to every row now. */
  "rules:apply": { args: undefined; result: RulesApplied };
  /** Per category, the names in its list rules, in category id order. Only categories that have some. */
  "rules:knownPlaces": { args: undefined; result: KnownPlaces[] };
  /** Appends a name to the category's first list rule, or makes one, then reapplies. */
  "rules:addKnownPlace": { args: { categoryId: number; name: string }; result: KnownPlaceAdded };
  /** The starter lists on offer and what they would sort. Saves nothing. */
  "rules:starters": { args: undefined; result: StarterPreview };
  /** Adds the chosen starter lists as ordinary list rules, then reapplies. */
  "rules:addStarters": { args: { keys: string[] }; result: StartersAdded };
  // ---- spec 19: profiles, each with its own database file ----
  "profiles:list": { args: undefined; result: ProfileList };
  "profiles:add": { args: { name: string }; result: Profile };
  "profiles:rename": { args: { id: string; name: string }; result: null };
  /** Deletes the profile's database file too. Refused for the open profile and the last real one. */
  "profiles:delete": { args: { id: string }; result: null };
  /** Opens the other profile's database and reloads the window. Refused while a sync runs. */
  "profiles:switch": { args: { id: string }; result: null };
  /** Adds the Demo profile, filled with made-up data. Only when there is none. */
  "profiles:addDemo": { args: undefined; result: Profile };
  /** Throws the Demo data away and makes it fresh. */
  "profiles:resetDemo": { args: undefined; result: null };
  // ---- spec 20: the cash wallet and rows typed by hand ----
  /** The profile's cash wallet, or null before the first row is added. */
  "cash:wallet": { args: undefined; result: CashWallet | null };
  /** Adds a row to the cash wallet, making the wallet on first use. */
  "transactions:addManual": { args: ManualTransactionInput; result: { id: number } };
  /** Changes every field of a row typed by hand. Synced rows are refused. */
  "transactions:editManual": { args: { id: number; input: ManualTransactionInput }; result: { updated: number } };
  // ---- spec 24: balance check ----
  /** One check per bank and card account (not the cash wallet). Read only. */
  "accounts:balanceChecks": { args: undefined; result: BalanceCheck[] };
  // ---- spec 23: delete data, how far back a sync goes ----
  /** Every provider that can sync: its limit and the first day the next sync asks for. */
  "sync:ranges": { args: undefined; result: SyncRange[] };
  /**
   * Deletes the open profile's database files and opens a fresh empty one
   * under the same name, then reloads the window. The Demo profile resets
   * to fresh made-up data instead. Refused while a sync runs.
   */
  "profiles:wipeCurrent": { args: undefined; result: null };
  /**
   * Deletes every profile's database files, profiles.json and the window's
   * stored data, then starts like a fresh install. Refused while a sync runs.
   */
  "profiles:wipeAll": { args: undefined; result: null };
  // ---- spec 27: budgets ----
  /** Every budgeted category's month and week (Sunday to Saturday) spending. Today is Israel time. */
  "budgets:status": { args: { month: IsoMonth }; result: BudgetStatus };
  /** Sets a spending category's monthly budget in agorot, or clears it with null. */
  "budgets:set": { args: { categoryId: number; monthlyBudget: Agorot | null }; result: null };
  // ---- spec 33: paid back for a purchase (F65) ----
  /** Purchases counting as spending from 60 days before to 7 days after the row, newest first, at most 50. */
  "transactions:paidBackCandidates": { args: { rowId: number; text?: string }; result: TransactionRow[] };
  /** The money-in row takes the purchase's category (as set by hand) and remembers it. Refusals are fixed codes. */
  "transactions:markPaidBack": { args: { rowId: number; purchaseId: number }; result: PaidBackResult };
  /** Removes the link and the category: the row is back in Needs review. */
  "transactions:clearPaidBack": { args: { rowId: number }; result: { updated: number } };
}

export interface IpcEvents {
  "sync:progress": SyncProgress;
}

export type Channel = keyof IpcContract;
export type EventName = keyof IpcEvents;
export type Args<C extends Channel> = IpcContract[C]["args"];
export type Res<C extends Channel> = IpcContract[C]["result"];

export const CHANNELS = [
  "app:info",
  "accounts:list",
  "categories:list",
  "transactions:list",
  "transactions:update",
  "transactions:restoreExclusions",
  "transactions:setInternal",
  "transactions:deleteGone",
  "transactions:trash",
  "transactions:restore",
  "transactions:emptyTrash",
  "accounts:setCardMode",
  "summary:period",
  "summary:periodFlow",
  "summary:groupFlow",
  "summary:periodTrend",
  "summary:periodCurves",
  "summary:thisMonth",
  "summary:monthlyNet",
  "sync:start",
  "sync:cancel",
  "rules:list",
  "rules:create",
  "rules:update",
  "rules:delete",
  "rules:reorder",
  "rules:preview",
  "rules:suggest",
  "categories:create",
  "categories:update",
  "categories:delete",
  "accounts:setSyncing",
  "settings:get",
  "settings:set",
  "rules:save",
  "rules:apply",
  "rules:knownPlaces",
  "rules:addKnownPlace",
  "rules:starters",
  "rules:addStarters",
  "profiles:list",
  "profiles:add",
  "profiles:rename",
  "profiles:delete",
  "profiles:switch",
  "profiles:addDemo",
  "profiles:resetDemo",
  "cash:wallet",
  "transactions:addManual",
  "transactions:editManual",
  "accounts:balanceChecks",
  // spec 23
  "sync:ranges",
  "profiles:wipeCurrent",
  "profiles:wipeAll",
  // spec 27
  "budgets:status",
  "budgets:set",
  // spec 33
  "transactions:paidBackCandidates",
  "transactions:markPaidBack",
  "transactions:clearPaidBack",
] as const satisfies readonly Channel[];

// Main and preload register only CHANNELS, so a channel missing here would
// fail only at runtime. This line stops the build instead, naming the
// missing channel in the error.
type Unlisted = Exclude<Channel, (typeof CHANNELS)[number]>;
export const EVERY_CHANNEL_LISTED: [Unlisted] extends [never] ? true : Unlisted = true;

export const EVENTS = ["sync:progress"] as const satisfies readonly EventName[];

/** What the preload script exposes as `window.coinleak`. */
export interface CoinLeakBridge {
  invoke<C extends Channel>(channel: C, args: Args<C>): Promise<Result<Res<C>>>;
  on<E extends EventName>(event: E, listener: (payload: IpcEvents[E]) => void): () => void;
}
