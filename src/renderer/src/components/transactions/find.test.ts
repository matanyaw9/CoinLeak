import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onFind, requestFind, takeFindRequest } from "./find";

describe("Ctrl+F", () => {
  beforeEach(() => {
    vi.stubGlobal("window", new EventTarget());
    takeFindRequest();
  });
  afterEach(() => vi.unstubAllGlobals());

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
