// The IPC wiring with Electron mocked: every listed channel is registered,
// only our own page is answered, failures become fixed codes, and the log
// line names the channel and code only.

import { afterEach, describe, expect, it, vi } from "vitest";
import { CodedError, type Result } from "@shared/errors";
import { CHANNELS } from "@shared/ipc";

type Listener = (event: { senderFrame?: { url: string } | null }, args: unknown) => Promise<Result<unknown>>;

const registered = vi.hoisted(() => new Map<string, unknown>());

vi.mock("electron", () => ({
  ipcMain: { handle: (channel: string, listener: unknown) => registered.set(channel, listener) },
}));

const { emit, registerIpc } = await import("./ipc");
const { createHandlers } = await import("./handlers");
type Handlers = Parameters<typeof registerIpc>[0];

const TRUSTED = "app://coinleak/index.html";
const isTrusted = (url: string) => url === TRUSTED;

/** Registers handlers that throw unless the test gives an answer. */
function setup(answers: Partial<Record<string, (args: unknown) => unknown>>): (channel: string) => Listener {
  registered.clear();
  const handlers = Object.fromEntries(
    CHANNELS.map((c) => [c, answers[c] ?? (() => { throw new Error("not in this test"); })]),
  ) as unknown as Handlers;
  registerIpc(handlers, isTrusted);
  return (channel) => registered.get(channel) as Listener;
}

afterEach(() => vi.restoreAllMocks());

describe("registerIpc", () => {
  it("registers every listed channel once, and main has a handler for exactly those", () => {
    setup({});
    expect([...registered.keys()].sort()).toEqual([...CHANNELS].sort());
    const handlers = createHandlers({
      version: "1",
      dataDir: "unused",
      dev: true,
      sync: { start: () => Promise.reject(new Error("no")), cancel: () => undefined, isRunning: () => false },
      getDb: () => {
        throw new Error("no database in this test");
      },
      openCurrentDb: () => undefined,
      closeDb: () => undefined,
      reloadWindow: () => undefined,
    });
    expect(Object.keys(handlers).sort()).toEqual([...CHANNELS].sort());
  });

  it("answers our own page with the handler's value", async () => {
    const listener = setup({ "app:info": (args) => ({ got: args }) })("app:info");
    await expect(listener({ senderFrame: { url: TRUSTED } }, 7)).resolves.toEqual({ ok: true, value: { got: 7 } });
  });

  it("refuses any other sender without calling the handler", async () => {
    const handler = vi.fn(() => "secret");
    const listener = setup({ "accounts:list": handler })("accounts:list");
    for (const frame of [{ url: "https://evil.example/" }, { url: "" }, null, undefined]) {
      const result = await listener({ senderFrame: frame }, undefined);
      expect(result).toEqual({ ok: false, error: { code: "FORBIDDEN", message: "Request refused." } });
    }
    expect(handler).not.toHaveBeenCalled();
  });

  it("turns a coded error into its code and fixed message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const listener = setup({
      "categories:list": () => {
        throw new CodedError("BAD_REQUEST");
      },
    })("categories:list");
    const result = await listener({ senderFrame: { url: TRUSTED } }, undefined);
    expect(result).toEqual({ ok: false, error: { code: "BAD_REQUEST", message: "The app sent an invalid request." } });
  });

  it("hides any other error's text from the window and from the log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const secret = "card 4580-1234 paid 99.90 at SECRET SHOP";
    const listener = setup({
      "transactions:list": () => Promise.reject(new Error(secret)),
    })("transactions:list");
    const result = await listener({ senderFrame: { url: TRUSTED } }, { search: secret });
    expect(result).toEqual({ ok: false, error: { code: "UNKNOWN", message: "Something went wrong." } });
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]).toEqual(["[ipc] transactions:list failed: UNKNOWN"]);
  });
});

describe("emit", () => {
  it("sends to a live window and skips a closed one", () => {
    const send = vi.fn();
    emit({ isDestroyed: () => false, send } as never, "sync:progress", { provider: "discount", stage: "done" } as never);
    expect(send).toHaveBeenCalledWith("sync:progress", { provider: "discount", stage: "done" });
    send.mockClear();
    emit({ isDestroyed: () => true, send } as never, "sync:progress", {} as never);
    expect(send).not.toHaveBeenCalled();
  });
});
