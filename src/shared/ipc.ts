// The complete list of requests the window can make and events it can hear.
// Adding a channel here (and a handler in main) is the only way to add one.

import type {
  Account,
  AppInfo,
  CardMode,
  Category,
  IsoMonth,
  MonthSummary,
  ProviderId,
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
  "accounts:setCardMode": { args: { accountId: number; mode: CardMode }; result: null };
  "summary:month": { args: { month: IsoMonth }; result: MonthSummary };
  "summary:trend": { args: { months: number }; result: TrendPoint[] };
  "sync:start": { args: { provider: ProviderId }; result: SyncResult };
  "sync:cancel": { args: undefined; result: null };
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
  "accounts:setCardMode",
  "summary:month",
  "summary:trend",
  "sync:start",
  "sync:cancel",
] as const satisfies readonly Channel[];

export const EVENTS = ["sync:progress"] as const satisfies readonly EventName[];

/** What the preload script exposes as `window.coinleak`. */
export interface CoinLeakBridge {
  invoke<C extends Channel>(channel: C, args: Args<C>): Promise<Result<Res<C>>>;
  on<E extends EventName>(event: E, listener: (payload: IpcEvents[E]) => void): () => void;
}
