// Typed access to the app from the window. Throws ApiError with a fixed,
// user-safe message when the app answers with an error. Builds made with
// VITE_DEMO=1 answer from the synthetic demo ledger instead of the app.

import type { AppError, ErrorCode } from "@shared/errors";
import type { Args, Channel, CoinLeakBridge, EventName, IpcEvents, Res } from "@shared/ipc";

export class ApiError extends Error {
  readonly code: ErrorCode;
  constructor(error: AppError) {
    super(error.message);
    this.code = error.code;
    this.name = "ApiError";
  }
}

export const DEMO = import.meta.env.VITE_DEMO === "1";

type Transport = Pick<CoinLeakBridge, "invoke" | "on">;
let demo: Promise<Transport> | undefined;

function transport(): Transport | Promise<Transport> {
  if (!DEMO) return window.coinleak;
  // Loaded lazily so the demo ledger is not part of real builds at all.
  demo ??= import("./demo").then((m) => m.createDemo(new Date(), { latencyMs: 60 }));
  return demo;
}

export async function call<C extends Channel>(channel: C, args: Args<C>): Promise<Res<C>> {
  const result = await (await transport()).invoke(channel, args);
  if (!result.ok) throw new ApiError(result.error);
  return result.value;
}

export function listen<E extends EventName>(event: E, listener: (payload: IpcEvents[E]) => void): () => void {
  const t = transport();
  if (!(t instanceof Promise)) return t.on(event, listener);
  let off: (() => void) | undefined;
  let stopped = false;
  void t.then((d) => {
    if (!stopped) off = d.on(event, listener);
  });
  return () => {
    stopped = true;
    off?.();
  };
}

/** True when a failure just means "this part is not wired yet". */
export function isNotBuilt(e: unknown): boolean {
  return e instanceof ApiError && e.code === "NOT_IMPLEMENTED";
}
