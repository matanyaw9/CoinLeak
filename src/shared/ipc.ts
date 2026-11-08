// The complete list of requests the window can make and events it can hear.
// Adding a channel here (and a handler in main) is the only way to add one.

import type {
  Account,
  AppInfo,
  CardMode,
  AppSettings,
  Category,
  CategoryChange,
  CategoryCurve,
  CategoryDeleteResult,
  CategoryInput,
  CategoryPatch,
  IsoMonth,
  MonthSummary,
  ProviderId,
  Rule,
  RuleInput,
  RulePreview,
  SettingEntry,
  SettingKey,
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
  "transactions:update": { args: { ids: number[]; patch: TransactionPatch }; result: { updated: number } };
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
  /** Categories editor (spec 15). Refusals come back as a fixed problem code. */
  "categories:create": { args: CategoryInput; result: CategoryChange };
  "categories:update": { args: { id: number; patch: CategoryPatch }; result: CategoryChange };
  /** Refused while rows or rules use it, unless `moveTo` names where they go first. */
  "categories:delete": { args: { id: number; moveTo: number | null }; result: CategoryDeleteResult };
  /** Remove money accounts from syncing, or add them back. Rows always stay and count. */
  "accounts:setSyncing": { args: { ids: number[]; enabled: boolean }; result: { updated: number } };
  "settings:get": { args: { key: SettingKey }; result: AppSettings[SettingKey] };
  "settings:set": { args: SettingEntry; result: null };
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
  "categories:create",
  "categories:update",
  "categories:delete",
  "accounts:setSyncing",
  "settings:get",
  "settings:set",
] as const satisfies readonly Channel[];

export const EVENTS = ["sync:progress"] as const satisfies readonly EventName[];

/** What the preload script exposes as `window.coinleak`. */
export interface CoinLeakBridge {
  invoke<C extends Channel>(channel: C, args: Args<C>): Promise<Result<Res<C>>>;
  on<E extends EventName>(event: E, listener: (payload: IpcEvents[E]) => void): () => void;
}
