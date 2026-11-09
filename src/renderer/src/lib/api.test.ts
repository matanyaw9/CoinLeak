// The api layer turns an error answer into an ApiError carrying the code
// and the fixed message, and passes good answers through untouched.

import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@shared/errors";
import { ApiError, call, isNotBuilt } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("api", () => {
  it("throws ApiError with the code on failure", async () => {
    const invoke = vi.fn().mockResolvedValue({ ok: false, error: { code: "DATABASE", message: ERROR_MESSAGES.DATABASE } });
    vi.stubGlobal("window", { coinleak: { invoke, on: vi.fn() } });

    const err = await call("accounts:list", undefined).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe("DATABASE");
    expect((err as ApiError).message).toBe(ERROR_MESSAGES.DATABASE);
    expect(invoke).toHaveBeenCalledWith("accounts:list", undefined);
  });

  it("returns the value on success", async () => {
    const info = { version: "1.0.0", dataDir: "/tmp/x", dev: true };
    vi.stubGlobal("window", { coinleak: { invoke: vi.fn().mockResolvedValue({ ok: true, value: info }), on: vi.fn() } });
    await expect(call("app:info", undefined)).resolves.toEqual(info);
  });

  it("recognizes 'not built yet' so screens can show an empty state", async () => {
    const error = { code: "NOT_IMPLEMENTED", message: ERROR_MESSAGES.NOT_IMPLEMENTED };
    vi.stubGlobal("window", { coinleak: { invoke: vi.fn().mockResolvedValue({ ok: false, error }), on: vi.fn() } });
    const err = await call("summary:thisMonth", undefined).catch((e: unknown) => e);
    expect(isNotBuilt(err)).toBe(true);
    expect(isNotBuilt(new Error("x"))).toBe(false);
  });
});
