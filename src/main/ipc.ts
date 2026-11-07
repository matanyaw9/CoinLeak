// Wires the typed channel list to handlers. Every request is checked to come
// from our own page, and every failure becomes a fixed error code.

import { ipcMain, type WebContents } from "electron";
import { CodedError, toAppError, type Result } from "@shared/errors";
import { CHANNELS, type Args, type Channel, type EventName, type IpcEvents, type Res } from "@shared/ipc";

export type Handlers = { [C in Channel]: (args: Args<C>) => Res<C> | Promise<Res<C>> };

export function registerIpc(handlers: Handlers, isTrustedUrl: (url: string) => boolean): void {
  for (const channel of CHANNELS) {
    ipcMain.handle(channel, async (event, args): Promise<Result<unknown>> => {
      if (!isTrustedUrl(event.senderFrame?.url ?? "")) {
        return { ok: false, error: toAppError(new CodedError("FORBIDDEN")) };
      }
      try {
        const handler = handlers[channel] as (a: unknown) => unknown;
        return { ok: true, value: await handler(args) };
      } catch (e) {
        // Log the code only: library errors can carry bank text or secrets.
        console.error(`[ipc] ${channel} failed: ${e instanceof CodedError ? e.code : "UNKNOWN"}`);
        return { ok: false, error: toAppError(e) };
      }
    });
  }
}

export function emit<E extends EventName>(target: WebContents, event: E, payload: IpcEvents[E]): void {
  if (!target.isDestroyed()) target.send(event, payload);
}
