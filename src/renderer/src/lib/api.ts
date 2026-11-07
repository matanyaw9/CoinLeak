// Typed access to the app from the window. Throws ApiError with a fixed,
// user-safe message when the app answers with an error.

import type { AppError, ErrorCode } from "@shared/errors";
import type { Args, Channel, EventName, IpcEvents, Res } from "@shared/ipc";

export class ApiError extends Error {
  readonly code: ErrorCode;
  constructor(error: AppError) {
    super(error.message);
    this.code = error.code;
    this.name = "ApiError";
  }
}

export async function call<C extends Channel>(channel: C, args: Args<C>): Promise<Res<C>> {
  const result = await window.coinleak.invoke(channel, args);
  if (!result.ok) throw new ApiError(result.error);
  return result.value;
}

export function listen<E extends EventName>(event: E, listener: (payload: IpcEvents[E]) => void): () => void {
  return window.coinleak.on(event, listener);
}
