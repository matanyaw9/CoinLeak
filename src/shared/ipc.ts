// The complete list of requests the window can make and events it can hear.
// Adding a channel here (and a handler in main) is the only way to add one.

import type {
  Account,
  AppInfo,
  CardMode,
  Category,
  CategoryCurve,
  ExclusionState,
  IsoMonth,
  KnownPlaceAdded,
  KnownPlaces,
  MonthSummary,
  ProviderId,
  Rule,
  RuleInput,
  RulePreview,
  RuleSaved,
  RulesApplied,
  StarterPreview,
  StartersAdded,
  SyncProgress,
  SyncResult,
  TransactionFilter,
  TransactionPatch,
  TransactionRow,
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
  "sync:start",
  "sync:cancel",
  "rules:list",
  "rules:create",
  "rules:update",
  "rules:delete",
  "rules:reorder",
  "rules:preview",
  "rules:suggest",
  "rules:save",
  "rules:apply",
  "rules:knownPlaces",
  "rules:addKnownPlace",
  "rules:starters",
  "rules:addStarters",
] as const satisfies readonly Channel[];

export const EVENTS = ["sync:progress"] as const satisfies readonly EventName[];

/** What the preload script exposes as `window.coinleak`. */
export interface CoinLeakBridge {
  invoke<C extends Channel>(channel: C, args: Args<C>): Promise<Result<Res<C>>>;
  on<E extends EventName>(event: E, listener: (payload: IpcEvents[E]) => void): () => void;
}
