import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRANSACTIONS_PATH, findAction, isFindKey, onFind, requestFind, takeFindRequest } from "./find";

const key = (patch: Partial<Parameters<typeof isFindKey>[0]>) => ({
  key: "f",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...patch,
});

describe("Ctrl+F", () => {
  beforeEach(() => {
    vi.stubGlobal("window", new EventTarget());
    takeFindRequest();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("is Ctrl+F on Linux and Windows, Cmd+F on Mac, nothing else", () => {
    expect(isFindKey(key({ ctrlKey: true }), false)).toBe(true);
    expect(isFindKey(key({ ctrlKey: true, key: "F" }), false)).toBe(true);
    expect(isFindKey(key({ metaKey: true }), true)).toBe(true);
    expect(isFindKey(key({ metaKey: true }), false)).toBe(false);
    expect(isFindKey(key({ ctrlKey: true }), true)).toBe(false);
    expect(isFindKey(key({}), false)).toBe(false);
    expect(isFindKey(key({ ctrlKey: true, shiftKey: true }), false)).toBe(false);
    expect(isFindKey(key({ ctrlKey: true, key: "g" }), false)).toBe(false);
  });

  it("focuses on Transactions and goes there from Home", () => {
    expect(findAction(TRANSACTIONS_PATH)).toBe("focus");
    expect(findAction("/")).toBe("navigate");
    expect(findAction("/rules")).toBe("navigate");
  });

  it("an open Transactions page focuses at once", () => {
    const focus = vi.fn();
    const stop = onFind(focus);
    requestFind();
    expect(focus).toHaveBeenCalledTimes(1);
    expect(takeFindRequest()).toBe(false);
    stop();
    requestFind();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("a page opened after the request finds it waiting, once", () => {
    requestFind();
    expect(takeFindRequest()).toBe(true);
    expect(takeFindRequest()).toBe(false);
  });
});
