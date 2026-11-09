// The complete list of requests the window can make and events it can hear.
// Adding a channel here (and a handler in main) is the only way to add one.

import type {
  Account,
  AppInfo,
  CardMode,
  CashWallet,
  AppSettings,
  Category,
  CategoryChange,
  CategoryCurve,
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
  IsoMonth,
  KnownPlaceAdded,
  KnownPlaces,
  ManualTransactionInput,
  MoneyFlow,
  MonthSummary,
  ProviderId,
  Rule,
  RuleInput,
  RulePreview,
  SettingEntry,
  SettingKey,
  RuleSaved,
  RulesApplied,
  StarterPreview,
  StartersAdded,
  Profile,
  ProfileList,
  SyncProgress,
  SyncResult,
  TransactionFilter,
  TransactionPatch,
  TransactionRow,
  ThisMonth,
  TrendPoint,
} from "./types";
import type { Result } from "./errors";

export interface IpcContract {
  "app:info": { args: undefined; result: AppInfo };
  "accounts:list": { args: undefined; result: Account[] };
  "categories:list": { args: undefined; result: Category[] };
  "transactions:list": { args: TransactionFilter; result: TransactionRow[] };
  /** With `excluded` in the patch, `before` holds each named row's exclusion as it was, for Undo (spec 13). */
  "transactions:update": {
    args: { ids: number[]; patch: TransactionPatch };
    result: { updated: number; before?: ExclusionState[] };
  };
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
  "summary:month": { args: { month: IsoMonth }; result: MonthSummary };
  "summary:trend": { args: { months: number }; result: TrendPoint[] };
  /** One curve per requested category, in the order asked. `null` is uncategorized. */
  "summary:curves": { args: { month: IsoMonth; categoryIds: (number | null)[] }; result: CategoryCurve[] };
  /** Where the month's money came from and went, for the Sankey (spec 14). */
  "summary:flow": { args: { month: IsoMonth }; result: MoneyFlow };
  // ---- spec 16: the same summaries for any range of days ----
  /** With `essential`, every spending number is essentials or extras only (spec 22). */
  "summary:period": { args: DateRange & EssentialFilter; result: PeriodSummary };
  /** Spending above income shows as `beyond_income`, never as savings. */
  "summary:periodFlow": { args: DateRange; result: PeriodFlow };
  /** One spending group opened up, for the Sankey drill-down. */
  "summary:groupFlow": { args: DateRange & { categoryId: number }; result: GroupFlow };
  /**
   * The calendar months the range covers (at least 3, never past this month).
   * With `categoryIds`, `byCategory` has one entry per id in that order, each
   * with its subcategories (null: uncategorized), and `spending` is their sum.
   */
  "summary:periodTrend": {
    args: DateRange & EssentialFilter & { categoryIds?: (number | null)[] };
    result: TrendPoint[];
  };
  "summary:periodCurves": { args: DateRange & EssentialFilter & { categoryIds: (number | null)[] }; result: PeriodCurve[] };
  /** Money left this calendar month (Israel time) and per day until its end (spec 22). */
  "summary:thisMonth": { args: undefined; result: ThisMonth };
  "sync:start": { args: { provider: ProviderId }; result: SyncResult };
  "sync:cancel": { args: undefined; result: null };
  /** Rules in evaluation order. Every change below reapplies all rules to all rows. */
  "rules:list": { args: undefined; result: Rule[] };
  "rules:create": { args: RuleInput; result: Rule };
  "rules:update": { args: { id: number; rule: RuleInput }; result: Rule };
  "rules:delete": { args: { id: number }; result: null };
  /** `ids` is every rule id in the new order. */
  "rules:reorder": { args: { ids: number[] }; result: null };
  /** Checks the conditions against today's rows without saving anything. */
  "rules:preview": { args: RuleInput; result: RulePreview };
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
  "transactions:setInternal",
  "transactions:deleteGone",
  "transactions:trash",
  "transactions:restore",
  "transactions:emptyTrash",
  "accounts:setCardMode",
  "summary:month",
  "summary:trend",
  "summary:curves",
  "summary:flow",
  "summary:period",
  "summary:periodFlow",
  "summary:groupFlow",
  "summary:periodTrend",
  "summary:periodCurves",
  "summary:thisMonth",
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
] as const satisfies readonly Channel[];

export const EVENTS = ["sync:progress"] as const satisfies readonly EventName[];

/** What the preload script exposes as `window.coinleak`. */
export interface CoinLeakBridge {
  invoke<C extends Channel>(channel: C, args: Args<C>): Promise<Result<Res<C>>>;
  on<E extends EventName>(event: E, listener: (payload: IpcEvents[E]) => void): () => void;
}
